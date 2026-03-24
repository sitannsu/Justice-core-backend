const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Contract = require('../models/Contract');
const ContractClause = require('../models/ContractClause');
const ContractAIFinding = require('../models/ContractAIFinding');
const ContractComplianceRule = require('../models/ContractComplianceRule');
const ContractComplianceResult = require('../models/ContractComplianceResult');
const ContractBenchmark = require('../models/ContractBenchmark');
const OpenAI = require('openai');
const trackTokenUsage = require('../utils/trackTokenUsage');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. AI Draft Contract
router.post('/draft', auth, async (req, res) => {
    try {
        const { contractType, jurisdiction, businessDomain, partyA, partyB, additionalInstructions } = req.body;

        // Fetch relevant clauses from the library
        const clauses = await ContractClause.find({
            contractType,
            $or: [{ jurisdiction }, { jurisdiction: 'International' }, { jurisdiction: 'India' }]
        });

        let clauseTexts = '';
        if (clauses.length > 0) {
            clauseTexts = clauses.map(c => `[${c.title}]: ${c.content}`).join('\n\n');
        }

        const systemPrompt = `You are an expert Indian law specialist and contract drafter.
Prepare a legally binding ${contractType} under ${jurisdiction} jurisdiction for the ${businessDomain} domain.
Applicable laws should map precisely to the contract type (e.g., Indian Contract Act 1872, Employment laws, GST, TDS, etc. where applicable).
You must format the contract using semantic HTML tags (<h1>, <h2>, <p>, <ul>, <li>, <section>, <strong>, etc.).
Include standard numbered sections, fully formed witness blocks, and a stamp duty placeholder.

STRICT INSTRUCTIONS:
- You have access to the following Pre-approved Clauses. You MUST use them exactly as provided if they apply:
${clauseTexts ? clauseTexts : 'No pre-approved clauses mapped.'}
- If any standard required clauses for this contract type are missing from the Pre-approved Clauses above, insert a placeholder marked EXACTLY as [MISSING CLAUSE - <Clause Name>] in the contract body.
- Do NOT output markdown, ONLY output raw HTML.`;

        const userPrompt = `Draft the contract using the following details:
Type: ${contractType}
Jurisdiction/Court: ${jurisdiction}
Domain: ${businessDomain}
Party A: ${partyA?.name} (${partyA?.type})
Party B: ${partyB?.name} (${partyB?.type})
Additional Instructions: ${additionalInstructions || 'None'}

Please provide the full HTML text for this contract.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 4000
        });

        await trackTokenUsage(completion, { userId: req.user.userId, endpoint: '/ai-contracts/draft', feature: 'contract_draft' });
        let htmlContent = completion.choices[0].message.content;

        // Clean up potential markdown blocks if present
        htmlContent = htmlContent.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

        const contract = new Contract({
            title: `${contractType} - ${partyA?.name} & ${partyB?.name}`,
            type: contractType,
            documentType: 'contract',
            uploadedBy: req.user.userId,
            htmlContent: htmlContent,
            isAIGenerated: true,
            status: 'AI Generated',
            parties: [
                { name: partyA?.name, type: 'other', role: 'Party A' },
                { name: partyB?.name, type: 'other', role: 'Party B' }
            ]
        });

        await contract.save();

        res.status(201).json(contract);
    } catch (error) {
        console.error('Error generating AI draft:', error);
        res.status(500).json({ message: 'Failed to generate AI contract draft', error: error.message });
    }
});

// 2. AI Review Contract
router.post('/review/:id', auth, async (req, res) => {
    try {
        const contract = await Contract.findById(req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });

        // Use HTML if generated, otherwise fallback to extracted text
        const textContent = contract.htmlContent || contract.extractedText || contract.ocrText;
        if (!textContent) return res.status(400).json({ message: 'No contract content available for review' });

        // Parse text into logical blocks (rudimentary parsing, since HTML or newline-separated text)
        // We split by standard paragraph markers or double newlines, targeting clauses > 50 chars.
        let rawClauses = textContent.replace(/<[^>]+>/g, '\n').split(/\n\s*\n/);
        let chunks = rawClauses.map(c => c.trim()).filter(c => c.length > 50).slice(0, 30); // Max 30 clauses

        if (chunks.length === 0) return res.status(400).json({ message: 'Could not extract parsable clauses from text' });

        const systemPrompt = `You are a Legal Review AI. Analyze each clause and rate it.
Return ONLY valid JSON in this format:
[
  {
    "clauseText": "Original exact text snippet here",
    "riskScore": 1 to 5,
    "riskType": "legal_risk" | "ambiguity" | "missing_protection" | "compliance" | "unfavorable_terms" | "none",
    "suggestion": "string replacement if risk >= 3, else empty string",
    "explanation": "brief reasoning"
  }
]`;

        const userPrompt = `Review the following clauses:\n\n` + chunks.map((c, i) => `Clause ${i + 1}: ${c}`).join('\n\n---\n\n');

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' } // Need specific json shape if possible, but arrays directly can cause issues with response_format, let's wrap it in an object
        });

        // We'll retry without json_object to let it output the array directly or parse it out
        const completionArray = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt + `\n\nEnsure response is a JSON object with a "findings" array: { "findings": [...] }` },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        await trackTokenUsage(completionArray, { userId: req.user.userId, endpoint: '/ai-contracts/review', feature: 'contract_review' });

        const analysisStr = completionArray.choices[0].message.content;
        const analysisObj = JSON.parse(analysisStr);
        const findings = analysisObj.findings || [];

        // Save Findings
        const savedFindings = await Promise.all(findings.map(async f => {
            const finding = new ContractAIFinding({
                contractId: contract._id,
                clauseText: f.clauseText || 'Unknown',
                riskScore: f.riskScore || 1,
                riskType: f.riskType || 'none',
                suggestion: f.suggestion || '',
                explanation: f.explanation || ''
            });
            return finding.save();
        }));

        // Create new version or mark contract as reviewed
        contract.aiAnalysisStatus = 'analyzed';
        contract.lastAnalyzed = new Date();
        await contract.save();

        res.json({ message: 'Review completed', findings: savedFindings });
    } catch (error) {
        console.error('Error during AI Review:', error);
        res.status(500).json({ message: 'Failed to complete review', error: error.message });
    }
});

// 3. AI Compliance Check
router.post('/compliance/:id', auth, async (req, res) => {
    try {
        const contract = await Contract.findById(req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });

        // Fetch rules
        const rules = await ContractComplianceRule.find({});
        if (rules.length === 0) return res.status(400).json({ message: 'No compliance rules defined in system' });

        const textContent = contract.htmlContent || contract.extractedText || contract.ocrText || '';
        let rawClauses = textContent.replace(/<[^>]+>/g, '\n').split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 50);

        const matchResults = [];
        let violations = 0;
        let warnings = 0;
        let compliant = 0;

        // A simplified keyword-based mapping + AI check
        for (const rule of rules) {
            // Find a clause that might match
            let relevantClause = null;
            if (rule.keywords && rule.keywords.length > 0) {
                relevantClause = rawClauses.find(c => rule.keywords.some(k => c.toLowerCase().includes(k.toLowerCase())));
            }

            if (!relevantClause) {
                if (rule.isRequired) {
                    matchResults.push({
                        ruleId: rule._id,
                        ruleName: rule.name,
                        category: rule.category,
                        status: rule.severity === 'error' ? 'violation' : 'warning',
                        clauseText: 'Missing completely',
                        reasoning: 'Required clause was not found in the contract based on keywords.',
                        severity: rule.severity
                    });
                    if (rule.severity === 'error') violations++; else warnings++;
                }
                continue;
            }

            // Check with AI against rule
            const prompt = `Rule Name: ${rule.name}\nDescription: ${rule.description}\n\nClause to Evaluate:\n"${relevantClause}"\n\nIs this clause compliant with the rule, or does it trigger a warning or violation? Respond in JSON: { "status": "compliant" | "warning" | "violation", "reasoning": "brief reason" }`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: 'You are an AI Compliance Auditor.' }, { role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 200,
                response_format: { type: 'json_object' }
            });
            await trackTokenUsage(completion, { userId: req.user.userId, endpoint: '/ai-contracts/compliance', feature: 'contract_compliance' });

            const aiRes = JSON.parse(completion.choices[0].message.content);

            matchResults.push({
                ruleId: rule._id,
                ruleName: rule.name,
                category: rule.category,
                status: aiRes.status || 'compliant',
                clauseText: relevantClause,
                reasoning: aiRes.reasoning || '',
                severity: rule.severity
            });

            if (aiRes.status === 'violation') violations++;
            else if (aiRes.status === 'warning') warnings++;
            else compliant++;
        }

        const compResult = new ContractComplianceResult({
            contractId: contract._id,
            summary: { violations, warnings, compliant },
            results: matchResults
        });
        await compResult.save();

        res.json({ message: 'Compliance check complete', summary: compResult.summary, results: compResult.results });
    } catch (error) {
        console.error('Error during Compliance Check:', error);
        res.status(500).json({ message: 'Failed to complete compliance check', error: error.message });
    }
});

// 4. AI Benchmark Contract
router.post('/benchmark/:id', auth, async (req, res) => {
    try {
        const contract = await Contract.findById(req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });

        // Find similar contracts (same type, from this user/tenant)
        let query = { uploadedBy: req.user.userId, _id: { $ne: contract._id }, status: { $ne: 'draft' } };
        if (contract.type && contract.type !== 'Contract') {
            query.type = contract.type;
        }
        const benchmarksDocs = await Contract.find(query).limit(10);

        if (benchmarksDocs.length === 0) {
            return res.status(400).json({ message: 'Not enough similar contracts available to benchmark against.' });
        }

        // This is heavily simplified for API limits. We'll ask AI to provide an overall market comparison score based on summary.
        const textContent = contract.htmlContent || contract.extractedText || contract.ocrText || '';
        const contractPreview = textContent.substring(0, 3000); // chunk limits

        const benchmarkTexts = benchmarksDocs.map(b => (b.htmlContent || b.extractedText || b.ocrText || '').substring(0, 1000)).join('\n\n---\n\n');

        const prompt = `You are a Contract Benchmarking AI. Compare the Target Contract against the corpus of Benchmark Contracts provided below.
Provide a similarity score (0-100), assign a marketPosition (on_market, slightly_off, or risky), and note key deviations.
Return ONLY JSON:
{
  "overallScore": number,
  "marketPosition": "on_market" | "slightly_off" | "risky",
  "clauseComparisons": [
    {
      "category": "e.g., Liability",
      "targetClause": "brief summary of target's stance",
      "similarityScore": number (0-100),
      "isAIBased": true,
      "deviations": ["deviation 1"],
      "recommendation": "recommendation"
    }
  ]
}

Target Contract Snippet:
${contractPreview}

Benchmark Corpus Snippets:
${benchmarkTexts}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: 'You evaluate contract standard deviations.' }, { role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });

        await trackTokenUsage(completion, { userId: req.user.userId, endpoint: '/ai-contracts/benchmark', feature: 'contract_benchmark' });

        const aiRes = JSON.parse(completion.choices[0].message.content);

        const benchmarkResult = new ContractBenchmark({
            contractId: contract._id,
            overallScore: aiRes.overallScore || 50,
            marketPosition: aiRes.marketPosition || 'on_market',
            comparisonCount: benchmarksDocs.length,
            clauseComparisons: aiRes.clauseComparisons || []
        });

        await benchmarkResult.save();

        res.json({ message: 'Benchmark complete', result: benchmarkResult });
    } catch (error) {
        console.error('Error Benchmarking Contract:', error);
        res.status(500).json({ message: 'Failed to benchmark contract', error: error.message });
    }
});

module.exports = router;
