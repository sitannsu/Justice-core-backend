const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Contract = require('../models/Contract');
const Document = require('../models/Document');
const OpenAI = require('openai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/contracts/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// GET /api/contracts - Get all contracts for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, practiceArea, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = { uploadedBy: req.user.userId };
    
    // Add search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { extractedText: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add status filter
    if (status) {
      query.status = status;
    }
    
    // Add practice area filter
    if (practiceArea) {
      query.practiceArea = practiceArea;
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const contracts = await Contract.find(query)
      .populate('case', 'caseName caseNumber')
      .populate('client', 'company contactPerson')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Contract.countDocuments(query);
    
    res.json({
      contracts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ message: 'Failed to fetch contracts' });
  }
});

// GET /api/contracts/:id - Get a specific contract
router.get('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('case', 'caseName caseNumber')
      .populate('client', 'company contactPerson')
      .populate('uploadedBy', 'firstName lastName email');
    
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    
    // Check if user has access to this contract
    if (contract.uploadedBy._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ message: 'Failed to fetch contract' });
  }
});

// POST /api/contracts - Upload a new contract
router.post('/', auth, upload.single('contract'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const {
      title,
      description,
      caseId,
      clientId,
      contractValue,
      startDate,
      endDate,
      practiceArea,
      tags
    } = req.body;
    
    // Create contract document
    const contract = new Contract({
      title: title || req.file.originalname,
      description,
      case: caseId || null,
      client: clientId || null,
      uploadedBy: req.user.userId,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      contractValue: contractValue ? parseFloat(contractValue) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      practiceArea,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });
    
    await contract.save();
    
    // Populate references
    await contract.populate('case', 'caseName caseNumber');
    await contract.populate('client', 'company contactPerson');
    
    res.status(201).json(contract);
  } catch (error) {
    console.error('Error uploading contract:', error);
    res.status(500).json({ message: 'Failed to upload contract' });
  }
});

// POST /api/contracts/:id/analyze - Analyze contract with OpenAI
router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    
    // Check if user has access to this contract
    if (contract.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update status to analyzing
    contract.aiAnalysisStatus = 'analyzing';
    await contract.save();
    
    try {
      // Extract text content from file
      let textContent = '';
      
      if (contract.extractedText) {
        textContent = contract.extractedText;
      } else if (contract.ocrText) {
        textContent = contract.ocrText;
      } else {
        // For now, we'll use a placeholder. In production, you'd implement OCR here
        textContent = `[Document content for ${contract.originalName} - OCR processing required]`;
      }
      
      // Prepare OpenAI prompt for contract analysis
      const systemPrompt = `You are an expert contract lawyer specializing in Indian law. Analyze the following contract for:

1. **Key Clauses Identification**: Identify and classify important clauses (Indemnity, Termination, Confidentiality, Payment, Force Majeure, etc.)
2. **Risk Assessment**: Evaluate risk level (Low/Medium/High/Critical) for each clause
3. **Missing Standard Clauses**: Identify standard clauses that should be included but are missing
4. **Legal Compliance Issues**: Check for compliance issues under Indian laws
5. **Recommendations**: Provide specific recommendations for improvements
6. **Overall Risk Score**: Calculate a risk score from 0-100

Return your analysis in the following JSON format:
{
  "clauses": [
    {
      "type": "string",
      "title": "string", 
      "description": "string",
      "risk": "low|medium|high|critical",
      "importance": "low|medium|high|critical"
    }
  ],
  "riskAssessment": {
    "overallRiskScore": number,
    "riskFactors": {
      "high": ["list of high risk factors"],
      "medium": ["list of medium risk factors"],
      "low": ["list of low risk factors"]
    }
  },
  "missingClauses": ["list of missing standard clauses"],
  "complianceIssues": ["list of compliance issues"],
  "recommendations": ["list of specific recommendations"],
  "summary": "brief summary of the analysis"
}`;

      const userPrompt = `Please analyze this contract document: ${contract.title}

Document Content:
${textContent}

Please provide a comprehensive legal analysis following the specified format.`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2000
      });

      const analysisContent = completion.choices[0].message.content;
      
      // Parse the JSON response
      let analysis;
      try {
        analysis = JSON.parse(analysisContent);
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        analysis = {
          clauses: [],
          riskAssessment: { overallRiskScore: 50, riskFactors: { high: [], medium: [], low: [] } },
          missingClauses: ['Unable to parse analysis'],
          complianceIssues: ['Unable to parse analysis'],
          recommendations: ['Please review the contract manually'],
          summary: 'Analysis completed but response format was invalid'
        };
      }
      
      // Update contract with analysis results
      contract.aiKeyClauses = analysis.clauses || [];
      contract.aiRiskFactors = {
        overallRiskScore: analysis.riskAssessment?.overallRiskScore || 50,
        riskAssessment: analysis.riskAssessment?.riskFactors || {},
        missingClauses: analysis.missingClauses || [],
        complianceIssues: analysis.complianceIssues || [],
        recommendations: analysis.recommendations || []
      };
      contract.aiAnalysisStatus = 'analyzed';
      contract.lastAnalyzed = new Date();
      contract.analysisVersion = '1.0';
      
      await contract.save();
      
      res.json({
        message: 'Contract analysis completed successfully',
        analysis: analysis,
        contract: contract
      });
      
    } catch (analysisError) {
      console.error('Error during contract analysis:', analysisError);
      
      // Update status to failed
      contract.aiAnalysisStatus = 'failed';
      await contract.save();
      
      res.status(500).json({ 
        message: 'Contract analysis failed',
        error: analysisError.message 
      });
    }
    
  } catch (error) {
    console.error('Error in contract analysis endpoint:', error);
    res.status(500).json({ message: 'Failed to analyze contract' });
  }
});

// POST /api/contracts/:id/compare - Compare contract with standards
router.post('/:id/compare', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    
    // Check if user has access to this contract
    if (contract.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Prepare OpenAI prompt for comparison
    const systemPrompt = `You are an expert contract lawyer. Compare the following contract against standard legal templates and identify:

1. **Deviations from Standards**: What clauses differ from standard templates
2. **Missing Standard Provisions**: What standard clauses are missing
3. **Non-Standard Terms**: Any unusual or non-standard terms
4. **Industry Best Practices**: How it compares to industry standards
5. **Recommendations**: Specific suggestions for improvement

Return your analysis in JSON format:
{
  "deviations": ["list of deviations from standards"],
  "missingProvisions": ["list of missing standard provisions"],
  "nonStandardTerms": ["list of non-standard terms"],
  "industryComparison": "how it compares to industry standards",
  "recommendations": ["list of recommendations"],
  "overallAssessment": "overall assessment of the contract"
}`;

    const userPrompt = `Please compare this contract against standard legal templates:

Contract: ${contract.title}
Content: ${contract.extractedText || contract.ocrText || '[Content not available]'}

Provide a detailed comparison analysis.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const comparisonContent = completion.choices[0].message.content;
    
    let comparison;
    try {
      comparison = JSON.parse(comparisonContent);
    } catch (parseError) {
      comparison = {
        deviations: ['Unable to parse comparison'],
        missingProvisions: ['Unable to parse comparison'],
        nonStandardTerms: ['Unable to parse comparison'],
        industryComparison: 'Unable to parse comparison',
        recommendations: ['Please review manually'],
        overallAssessment: 'Unable to assess'
      };
    }
    
    res.json({
      message: 'Contract comparison completed',
      comparison: comparison
    });
    
  } catch (error) {
    console.error('Error in contract comparison:', error);
    res.status(500).json({ message: 'Failed to compare contract' });
  }
});

// PUT /api/contracts/:id - Update contract
router.put('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    
    // Check if user has access to this contract
    if (contract.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const updates = req.body;
    
    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.uploadedBy;
    delete updates.createdAt;
    delete updates.updatedAt;
    
    Object.assign(contract, updates);
    await contract.save();
    
    await contract.populate('case', 'caseName caseNumber');
    await contract.populate('client', 'company contactPerson');
    
    res.json(contract);
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ message: 'Failed to update contract' });
  }
});

// DELETE /api/contracts/:id - Delete contract
router.delete('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    
    // Check if user has access to this contract
    if (contract.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Delete the file
    if (contract.filePath && fs.existsSync(contract.filePath)) {
      fs.unlinkSync(contract.filePath);
    }
    
    await Contract.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ message: 'Failed to delete contract' });
  }
});

// GET /api/contracts/stats/summary - Get contract statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const stats = await Contract.aggregate([
      { $match: { uploadedBy: req.user.userId } },
      {
        $group: {
          _id: null,
          totalContracts: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$contractValue', 0] } },
          analyzedContracts: {
            $sum: { $cond: [{ $eq: ['$aiAnalysisStatus', 'analyzed'] }, 1, 0] }
          },
          pendingAnalysis: {
            $sum: { $cond: [{ $eq: ['$aiAnalysisStatus', 'not_analyzed'] }, 1, 0] }
          },
          highRiskContracts: {
            $sum: { $cond: [{ $gte: ['$aiRiskFactors.overallRiskScore', 70] }, 1, 0] }
          }
        }
      }
    ]);
    
    const practiceAreaStats = await Contract.aggregate([
      { $match: { uploadedBy: req.user.userId } },
      {
        $group: {
          _id: '$practiceArea',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      summary: stats[0] || {
        totalContracts: 0,
        totalValue: 0,
        analyzedContracts: 0,
        pendingAnalysis: 0,
        highRiskContracts: 0
      },
      practiceAreas: practiceAreaStats
    });
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    res.status(500).json({ message: 'Failed to fetch contract statistics' });
  }
});

module.exports = router;
