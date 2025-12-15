const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const pdf = require('pdf-parse');
const fs = require('fs');
const auth = require('../middleware/auth');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /ai-file-question
router.post('/ai-file-question', auth, upload.single('file'), async (req, res) => {
  console.log('--- /api/ai-file-question called ---');
  try {
    if (!req.file) {
      console.log('No file uploaded!');
      return res.status(400).json({ error: "No file uploaded" });
    }
    const filePath = req.file.path;
    console.log('File path:', filePath);
    const question = req.body.question || '';
    console.log('Question:', question);
    const dataBuffer = fs.readFileSync(filePath);
    console.log('Read file buffer');
    const pdfData = await pdf(dataBuffer);
    console.log('Parsed PDF');
    const text = pdfData.text.replace(/\n\s*\n/g, "\n");
    fs.unlinkSync(filePath); // Clean up temp file
    console.log('Unlinked temp file');

    // For large PDFs, consider chunking text and summarizing first!
    const prompt = `Given the following document, answer this question: ${question}\nDocument:\n${text}`;
    console.log('Prompt ready, calling OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a legal document assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    });

    console.log('OpenAI response received');
    const answer = response.choices[0].message.content.trim();
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /summarize-pdf
router.post('/summarize-pdf', auth, upload.single('file'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text.replace(/\n\s*\n/g, "\n");
    fs.unlinkSync(filePath); // Clean up temp file

    // Helper: Split text into chunks under a safe token limit (~3000 tokens ≈ ~12k chars)
    function chunkText(text, maxLength = 12000) {
      const chunks = [];
      let start = 0;
      while (start < text.length) {
        chunks.push(text.slice(start, start + maxLength));
        start += maxLength;
      }
      return chunks;
    }
    const chunks = chunkText(text);

    // Step 3: Summarize each chunk
    const partialSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a legal document summarizer." },
          { role: "user", content: `Summarize the following text:\n\n${chunks[i]}` }
        ],
        temperature: 0.3
      });
      partialSummaries.push(response.choices[0].message.content.trim());
    }

    // Step 4: Merge partial summaries into a final summary
    const combinedText = partialSummaries.join("\n\n");
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a concise summarizer." },
        { role: "user", content: "Combine these summaries into one cohesive summary:\n\n" + combinedText }
      ],
      temperature: 0.3
    });
    const finalSummary = finalResponse.choices[0].message.content.trim();
    res.json({ summary: finalSummary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai-document-question - Ask questions about existing documents
router.post('/ai-document-question', auth, async (req, res) => {
  console.log('--- /api/ai-document-question called ---');
  try {
    const { documentId, question } = req.body;
    
    if (!documentId || !question) {
      return res.status(400).json({ error: "Document ID and question are required" });
    }

    // Import Document model (since this is a separate route file)
    const Document = require('../models/Document');
    
    // Get document from database
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Extract document content based on storage type
    let documentContent = '';
    
    if (document.s3Bucket && document.s3Key) {
      // Document is stored in S3
      try {
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = require('../config/s3.config').s3Client;
        
        const getObjectParams = {
          Bucket: document.s3Bucket,
          Key: document.s3Key
        };
        
        const s3Response = await s3Client.send(new GetObjectCommand(getObjectParams));
        const fileBuffer = await s3Response.Body.transformToByteArray();
        const buffer = Buffer.from(fileBuffer);
        
        // Parse content based on file type
        if (document.originalName.toLowerCase().endsWith('.pdf')) {
          const pdfData = await pdf(buffer);
          documentContent = pdfData.text.replace(/\n\s*\n/g, "\n");
        } else if (document.originalName.toLowerCase().endsWith('.txt') || 
                   document.originalName.toLowerCase().endsWith('.md')) {
          // Text files
          documentContent = buffer.toString('utf-8');
        } else if (document.originalName.toLowerCase().endsWith('.docx') || 
                   document.originalName.toLowerCase().endsWith('.doc')) {
          // Word documents - for now, we'll note this limitation
          documentContent = '[Word document content extraction not yet implemented. Please convert to PDF for AI analysis.]';
        } else if (document.originalName.toLowerCase().endsWith('.jpg') || 
                   document.originalName.toLowerCase().endsWith('.jpeg') || 
                   document.originalName.toLowerCase().endsWith('.png')) {
          // Images - note that OCR is not yet implemented
          documentContent = '[Image file detected. OCR (text extraction from images) is not yet implemented. Please provide a text-based document for AI analysis.]';
        } else {
          // Other file types
          documentContent = `[File type ${document.originalName.split('.').pop()} not yet supported for content extraction. Please convert to PDF or text format for AI analysis.]`;
        }
        
        console.log('Document content extracted from S3:', documentContent.substring(0, 200) + '...');
      } catch (s3Error) {
        console.error('Error extracting content from S3:', s3Error);
        documentContent = `[Error extracting content from S3: ${s3Error.message}]`;
      }
    } else if (document.filePath) {
      // Document is stored locally
      try {
        const fs = require('fs');
        const dataBuffer = fs.readFileSync(document.filePath);
        
        if (document.originalName.toLowerCase().endsWith('.pdf')) {
          const pdfData = await pdf(dataBuffer);
          documentContent = pdfData.text.replace(/\n\s*\n/g, "\n");
        } else if (document.originalName.toLowerCase().endsWith('.txt') || 
                   document.originalName.toLowerCase().endsWith('.md')) {
          // Text files
          documentContent = dataBuffer.toString('utf-8');
        } else if (document.originalName.toLowerCase().endsWith('.docx') || 
                   document.originalName.toLowerCase().endsWith('.doc')) {
          // Word documents - for now, we'll note this limitation
          documentContent = '[Word document content extraction not yet implemented. Please convert to PDF for AI analysis.]';
        } else if (document.originalName.toLowerCase().endsWith('.jpg') || 
                   document.originalName.toLowerCase().endsWith('.jpeg') || 
                   document.originalName.toLowerCase().endsWith('.png')) {
          // Images - note that OCR is not yet implemented
          documentContent = '[Image file detected. OCR (text extraction from images) is not yet implemented. Please provide a text-based document for AI analysis.]';
        } else {
          // Other file types
          documentContent = `[File type ${document.originalName.split('.').pop()} not yet supported for content extraction. Please convert to PDF or text format for AI analysis.]`;
        }
        
        console.log('Document content extracted from local file:', documentContent.substring(0, 200) + '...');
      } catch (localError) {
        console.error('Error extracting content from local file:', localError);
        documentContent = `[Error extracting content from local file: ${localError.message}]`;
      }
    } else {
      documentContent = '[Document content not available - no file path or S3 location found]';
    }
    
    // Truncate content if it's too long (OpenAI has token limits)
    const maxContentLength = 8000; // Conservative limit for GPT-4o-mini
    if (documentContent.length > maxContentLength) {
      documentContent = documentContent.substring(0, maxContentLength) + 
        `\n\n[Content truncated due to length. Only the first ${maxContentLength} characters are shown.]`;
    }
    
    const prompt = `Given the following document: ${document.originalName}, answer this question: ${question}\n\nDocument Content:\n${documentContent}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a legal document assistant. Provide helpful, accurate legal information based on the document content." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    });

    console.log('OpenAI response received for document question');
    const answer = response.choices[0].message.content.trim();
    
    // Update document's GPT query count
    document.gptQueries = (document.gptQueries || 0) + 1;
    document.lastGptQuery = new Date();
    document.aiAnalysisStatus = 'analyzed';
    await document.save();
    
    res.json({ 
      answer,
      documentId,
      question,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Error in AI document question:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /contract-analysis
router.post('/contract-analysis', auth, async (req, res) => {
  console.log('--- /api/contract-analysis called ---');
  console.log('Request body:', req.body);
  try {
    const { documentId, analysisType } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Get document from database
    const Document = require('../models/Document');
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    console.log('Document found:', {
      id: document._id,
      filename: document.filename,
      mimeType: document.mimeType,
      fileUrl: document.fileUrl,
      filePath: document.filePath,
      originalName: document.originalName
    });

    // Extract content based on file type
    let content = '';
    if (document.mimeType === 'application/pdf') {
      console.log('Processing PDF document...');
      console.log('fileUrl:', document.fileUrl, 'type:', typeof document.fileUrl);
      console.log('filePath:', document.filePath, 'type:', typeof document.filePath);
      console.log('filePath length:', document.filePath ? document.filePath.length : 'N/A');
      console.log('filePath char codes:', document.filePath ? Array.from(document.filePath).map(c => c.charCodeAt(0)) : 'N/A');
      console.log('fileUrl includes s3.amazonaws.com:', document.fileUrl && document.fileUrl.includes('s3.amazonaws.com'));
      console.log('filePath includes s3.amazonaws.com:', document.filePath && document.filePath.includes('s3.amazonaws.com'));
      console.log('Is S3 URL?', (document.fileUrl && typeof document.fileUrl === 'string' && document.fileUrl.includes('s3.amazonaws.com')) || (document.filePath && typeof document.filePath === 'string' && document.filePath.includes('s3.amazonaws.com')));
      
      // For PDFs stored in S3, download and parse
      const isS3Url = (url) => {
        if (!url || typeof url !== 'string') return false;
        const cleanUrl = url.trim();
        return cleanUrl.includes('s3.amazonaws.com') || 
               cleanUrl.includes('s3.') || 
               cleanUrl.startsWith('https://s3') ||
               cleanUrl.startsWith('http://s3');
      };
      
      if (isS3Url(document.fileUrl) || isS3Url(document.filePath)) {
        console.log('Detected S3 URL, downloading from S3...');
        try {
          const { s3Client, s3Config } = require('../config/s3.config');
          // Use either fileUrl or filePath, whichever contains the S3 URL
          const s3Url = document.fileUrl || document.filePath;
          // Extract the key by removing the bucket name from the path
          const urlParts = s3Url.split('.com/');
          const fullPath = urlParts[1];
          const key = fullPath.replace(`${s3Config.bucket}/`, '');
          console.log('S3 URL:', s3Url);
          console.log('Full Path:', fullPath);
          console.log('Extracted Key:', key);
          console.log('Bucket:', s3Config.bucket);
          
          const command = new GetObjectCommand({
            Bucket: s3Config.bucket,
            Key: key
          });
          const response = await s3Client.send(command);
          const stream = response.Body;
          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          
          // Try to parse PDF with error handling
          try {
            const pdfData = await pdf(buffer);
            content = pdfData.text;
            console.log('Successfully extracted text from S3 PDF, length:', content.length);
          } catch (pdfError) {
            console.error('PDF parsing error:', pdfError);
            
            // If PDF parsing fails, try alternative approaches
            if (pdfError.message.includes('bad XRef entry') || pdfError.message.includes('FormatError')) {
              console.log('PDF appears corrupted, attempting alternative text extraction...');
              
              // TODO: In the future, we could try alternative PDF parsing libraries like:
              // - pdf2pic for image-based extraction
              // - pdf-lib for structural analysis
              // - pdfjs-dist for browser-based parsing
              
              // For now, provide informative fallback content
              content = `[PDF Content Extraction Failed] The uploaded PDF appears to have structural issues (${pdfError.message}). 
              
              This document may be:
              - Corrupted during upload
              - Generated by incompatible software
              - Password protected
              - Using unsupported PDF features
              
              Please try re-uploading the document or contact support if the issue persists.
              
              Document details:
              - Filename: ${document.originalName || document.filename}
              - Size: ${document.fileSize} bytes
              - MIME Type: ${document.mimeType}`;
            } else {
              throw new Error(`PDF parsing failed: ${pdfError.message}`);
            }
          }
        } catch (s3Error) {
          console.error('S3 download error:', s3Error);
          throw new Error(`Failed to download from S3: ${s3Error.message}`);
        }
      } else if (document.filePath && !document.filePath.includes('s3.amazonaws.com')) {
        console.log('Processing local file...');
        // For local files only (not S3 URLs)
        try {
          const dataBuffer = fs.readFileSync(document.filePath);
          const pdfData = await pdf(dataBuffer);
          content = pdfData.text;
        } catch (pdfError) {
          console.error('Local PDF parsing error:', pdfError);
          
          if (pdfError.message.includes('bad XRef entry') || pdfError.message.includes('FormatError')) {
            console.log('Local PDF appears corrupted, providing fallback content...');
            content = `[PDF Content Extraction Failed] The local PDF appears to have structural issues (${pdfError.message}). 
            
            This document may be:
            - Corrupted during file transfer
            - Generated by incompatible software
            - Password protected
            - Using unsupported PDF features
            
            Please try re-uploading the document or contact support if the issue persists.
            
            Document details:
            - Filename: ${document.originalName || document.filename}
            - Size: ${document.fileSize} bytes
            - MIME Type: ${document.mimeType}`;
          } else {
            throw new Error(`Local PDF parsing failed: ${pdfError.message}`);
          }
        }
      } else {
        console.log('No valid file source found');
      }
    } else if (document.mimeType === 'text/plain' || document.mimeType === 'text/markdown') {
      if ((document.fileUrl && document.fileUrl.includes('s3.amazonaws.com')) || 
          (document.filePath && document.filePath.includes('s3.amazonaws.com'))) {
        const s3Client = require('../config/s3');
        const s3Url = document.fileUrl || document.filePath;
        const key = s3Url.split('.com/')[1];
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key
        });
        const response = await s3Client.send(command);
        const stream = response.Body;
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString('utf-8');
      } else if (document.filePath && !document.filePath.includes('s3.amazonaws.com')) {
        content = fs.readFileSync(document.filePath, 'utf-8');
      }
    } else if (document.mimeType && (document.mimeType.includes('word') || document.mimeType.includes('document'))) {
      content = 'Word document content extraction not implemented yet. Please convert to PDF for analysis.';
    } else if (document.mimeType && document.mimeType.includes('image')) {
      content = 'Image content extraction (OCR) not implemented yet. Please convert to PDF for analysis.';
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Could not extract content from document',
        details: 'The document may be corrupted, password protected, or in an unsupported format. Please try re-uploading the document.'
      });
    }

    // Check if content is just an error message
    if (content.includes('[PDF Content Extraction Failed]')) {
      console.log('Content extraction failed, but proceeding with error message for analysis');
      // We'll still proceed with the analysis to show the user what went wrong
    }

    // Truncate content to avoid token limits
    const maxContentLength = 8000;
    if (content.length > maxContentLength) {
      content = content.substring(0, maxContentLength) + '... [Content truncated due to length]';
    }

    // Define analysis prompts based on type
    let systemPrompt = '';
    let userPrompt = '';
    
    switch (analysisType) {
      case 'clause_extraction':
        systemPrompt = `You are a legal contract analysis expert specializing in clause extraction. Analyze the following contract and extract all legally significant clauses.

Format your response as JSON with these exact keys:
{
  "clauses": [
    {
      "type": "string (e.g., 'Confidentiality', 'Termination', 'Indemnity', 'Governing Law', 'Force Majeure', 'Dispute Resolution', 'Payment', 'Liability')",
      "found": true,
      "content": "string (the actual clause text, 2-3 sentences)",
      "riskLevel": "Low|Medium|High",
      "riskExplanation": "string (brief explanation of why this risk level)",
      "complianceStatus": "Compliant|Partially Compliant|Non-Compliant",
      "keyTerms": ["string array of key terms within the clause"],
      "recommendations": ["string array of recommendations for this clause"]
    }
  ],
  "missingClauses": [
    {
      "type": "string (e.g., 'Force Majeure', 'Dispute Resolution', 'Arbitration')",
      "riskLevel": "Low|Medium|High",
      "riskExplanation": "string (why missing this clause is risky)"
    }
  ],
  "summary": {
    "totalClauses": "number",
    "highRiskClauses": "number",
    "mediumRiskClauses": "number",
    "lowRiskClauses": "number",
    "complianceScore": "number (0-100)",
    "overallRisk": "Low|Medium|High"
  }
}`;
        userPrompt = `Extract all legally significant clauses from this contract. Identify what's present and what's missing. For each clause found, provide the actual text and assess risk level. For missing clauses, explain the risk of not having them. Be thorough and accurate.\n\n${content}`;
        break;
        
      case 'risk_assessment':
        systemPrompt = `You are a legal risk assessment expert. Analyze the following contract for potential risks and provide detailed risk scoring.

Format your response as JSON with these exact keys:
{
  "overallRiskScore": "number (1-10)",
  "overallRiskLevel": "Low|Medium|High",
  "riskBreakdown": {
    "financial": {
      "score": "number (1-10)",
      "risks": ["string array of financial risks with brief explanations"],
      "mitigation": ["string array of risk mitigation strategies"]
    },
    "legal": {
      "score": "number (1-10)", 
      "risks": ["string array of legal risks with brief explanations"],
      "mitigation": ["string array of risk mitigation strategies"]
    },
    "operational": {
      "score": "number (1-10)",
      "risks": ["string array of operational risks with brief explanations"], 
      "mitigation": ["string array of risk mitigation strategies"]
    },
    "reputational": {
      "score": "number (1-10)",
      "risks": ["string array of reputational risks with brief explanations"],
      "mitigation": ["string array of risk mitigation strategies"]
    }
  },
  "criticalIssues": ["string array of critical issues requiring immediate attention"],
  "redFlags": ["string array of specific red flags found in the contract"],
  "recommendations": ["string array of overall recommendations"]
}`;
        userPrompt = `Analyze this contract for potential risks. Focus on identifying red flags, unusual terms, missing protections, and areas that could expose the parties to financial, legal, operational, or reputational harm. Be specific about what makes each risk high, medium, or low.\n\n${content}`;
        break;
        
            case 'compliance_check':
        systemPrompt = `You are a legal compliance expert. Analyze the following contract for compliance with legal requirements and regulatory standards.

Format your response as JSON with these exact keys:
{
  "complianceStatus": "Compliant|Partially Compliant|Non-Compliant",
  "complianceScore": "number (0-100)",
  "regulatoryAreas": {
    "dataProtection": {
      "status": "Compliant|Partially Compliant|Non-Compliant",
      "issues": ["string array of compliance issues"],
      "requirements": ["string array of requirements met"]
    },
    "employment": {
      "status": "Compliant|Partially Compliant|Non-Compliant",
      "issues": ["string array of compliance issues"],
      "requirements": ["string array of requirements met"]
    },
    "intellectualProperty": {
      "status": "Compliant|Partially Compliant|Non-Compliant",
      "issues": ["string array of compliance issues"],
      "requirements": ["string array of requirements met"]
    },
    "tax": {
      "status": "Compliant|Partially Compliant|Non-Compliant",
      "issues": ["string array of compliance issues"],
      "requirements": ["string array of requirements met"]
    }
  },
  "missingRequirements": ["string array of missing compliance requirements"],
  "missingClauses": ["string array of commonly expected clauses that are missing"],
  "nonStandardTerms": ["string array of terms that deviate from standard practice"],
  "recommendations": ["string array of compliance recommendations"]
}`;
        userPrompt = `Check this contract for compliance with standard legal requirements. Identify missing clauses, non-standard terms, and areas where the contract may not meet industry standards or regulatory requirements. Compare against standard contract templates.\n\n${content}`;
        break;
        
      case 'comprehensive':
        systemPrompt = `You are a legal contract analysis expert. Provide a comprehensive analysis of the following contract including clause extraction, risk assessment, and compliance check.

Format your response as JSON with these exact keys:
{
  "contractOverview": {
    "type": "string",
    "purpose": "string",
    "parties": ["string array"],
    "effectiveDate": "string",
    "term": "string"
  },
  "clauses": [
    {
      "type": "string",
      "content": "string",
      "riskLevel": "Low|Medium|High",
      "complianceStatus": "Compliant|Partially Compliant|Non-Compliant"
    }
  ],
  "riskAssessment": {
    "overallScore": "number (1-10)",
    "highRiskAreas": ["string array"],
    "riskBreakdown": {
      "financial": "number (1-10)",
      "legal": "number (1-10)", 
      "operational": "number (1-10)",
      "reputational": "number (1-10)"
    }
  },
  "complianceCheck": {
    "overallStatus": "Compliant|Partially Compliant|Non-Compliant",
    "complianceScore": "number (0-100)",
    "regulatoryIssues": ["string array"]
  },
  "recommendations": ["string array"],
  "summary": "string"
}`;
        userPrompt = `Provide comprehensive analysis of this contract:\n\n${content}`;
        break;
        
      default:
        systemPrompt = `You are a legal contract analysis expert. Provide a general analysis of the following contract.`;
        userPrompt = `Analyze this contract:\n\n${content}`;
    }

    // Call OpenAI for analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 3000,
      temperature: 0.3
    });

    const analysisResult = response.choices[0].message.content.trim();
    
    // Try to parse JSON response
    let parsedResult;
    try {
      parsedResult = JSON.parse(analysisResult);
    } catch (parseError) {
      // If JSON parsing fails, return the raw text
      parsedResult = { analysis: analysisResult };
    }

    // Update document with analysis info
    document.aiAnalysisStatus = 'analyzed';
    document.lastAnalyzed = new Date();
    document.analysisVersion = '1.0';
    
    // Store analysis results based on type
    if (analysisType === 'clause_extraction') {
      document.aiClauseExtraction = parsedResult;
    } else if (analysisType === 'risk_assessment') {
      document.aiRiskAssessment = parsedResult;
    } else if (analysisType === 'compliance_check') {
      document.aiComplianceCheck = parsedResult;
    } else if (analysisType === 'comprehensive') {
      document.aiComprehensiveAnalysis = parsedResult;
    }
    
    await document.save();

    res.json({ 
      success: true,
      analysisType,
      result: parsedResult,
      documentId,
      analysisDate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Contract Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze contract', details: error.message });
  }
});

// POST /ai/generate-legal-document - Generate legal document from voice transcript
router.post('/ai/generate-legal-document', auth, async (req, res) => {
  console.log('=== Generate Legal Document Endpoint Hit ===');
  console.log('Request body:', req.body);
  
  try {
    const { transcript, documentType, title, caseId, clientId } = req.body;
    
    if (!transcript || !transcript.trim()) {
      console.log('ERROR: No transcript provided');
      return res.status(400).json({ error: 'Transcript is required' });
    }

    console.log('Generating legal document:', { documentType, title, transcriptLength: transcript.length });

    // Build prompt based on document type
    const documentTypePrompts = {
      engagement_letter: 'Create a professional engagement letter for legal services.',
      nda: 'Draft a comprehensive Non-Disclosure Agreement (NDA).',
      demand_letter: 'Write a formal demand letter.',
      contract: 'Generate a legal contract.',
      memo: 'Prepare a legal memorandum.',
      custom: 'Create a legal document'
    };

    const basePrompt = documentTypePrompts[documentType] || documentTypePrompts.custom;
    
    const systemPrompt = `You are an expert legal document drafter. Generate professional, legally sound documents with proper formatting and structure. Include all necessary clauses, sections, and legal language appropriate for the document type.`;
    
    const userPrompt = `${basePrompt}

Based on the following transcript/notes, create a complete legal document:

"${transcript}"

Document Title: ${title || 'Legal Document'}

Provide a fully formatted document with:
- Proper heading and title
- Introduction/preamble
- Numbered sections and subsections
- All necessary legal clauses
- Signature blocks
- Date placeholders

Format the document professionally and ensure it's ready for review and use.`;

    // Call OpenAI to generate the document
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const generatedContent = response.choices[0].message.content.trim();

    // Save the document to database
    const Document = require('../models/Document');
    
    const document = new Document({
      originalName: `${title || 'Legal Document'}.txt`,
      filename: `ai-generated-${Date.now()}.txt`,
      filePath: '', // Will be set if we upload to S3
      fileSize: Buffer.byteLength(generatedContent, 'utf8'),
      mimeType: 'text/plain',
      uploadedBy: req.user.userId,
      documentType: documentType || 'ai_generated',
      description: `AI-generated legal document from voice transcript`,
      tags: ['ai-generated', 'voice-to-text', documentType],
      status: 'temp', // AI-generated documents start as temp until assigned to a case
      aiGenerated: true,
      sourceTranscript: transcript,
      case: caseId || undefined,
      client: clientId || undefined,
      // Store content directly in DB for text documents
      textContent: generatedContent,
      processingStatus: 'completed'
    });

    await document.save();

    console.log('Legal document generated and saved:', document._id);

    res.status(201).json({
      message: 'Legal document generated successfully',
      documentId: document._id.toString(),
      title: title || 'Legal Document',
      content: generatedContent,
      documentType,
      createdAt: document.createdAt
    });

  } catch (error) {
    console.error('Generate legal document error:', error);
    res.status(500).json({ error: 'Failed to generate legal document', details: error.message });
  }
});

module.exports = router;
