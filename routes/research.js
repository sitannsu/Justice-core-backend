const express = require('express');
const auth = require('../middleware/auth');
const Document = require('../models/Document');
const Case = require('../models/Case');
const OpenAI = require('openai');

const router = express.Router();

function makeSnippet(text = '', query = '') {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 140) + (text.length > 140 ? '…' : '');
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + query.length + 60);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

async function performSearch(userId, q, language = 'en') {
  const query = String(q || '').trim();
  const lang = String(language || 'en');
  if (!query) {
    return {
      query,
      totalResults: 0,
      databases: [],
      results: [],
      resultsByDatabase: {},
      searchTime: 0,
      timestamp: new Date().toISOString()
    };
  }

  const t0 = Date.now();
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const [docs, cases] = await Promise.all([
    Document.find({
      $and: [
        { status: { $ne: 'deleted' } },
        {
          $or: [
            { originalName: regex },
            { description: regex },
            { tags: regex },
            { folder: regex },
            { documentType: regex }
          ]
        }
      ]
    })
      .limit(25)
      .populate('case', 'caseName caseNumber'),
    Case.find({
      lawyer: userId,
      $or: [
        { caseName: regex },
        { description: regex },
        { caseNumber: regex },
        { 'customFields.domain': regex },
        { 'customFields.suggestedStatutes': regex }
      ]
    }).limit(25)
  ]);

  // Map local results to LegalSearchResult shape
  const localResults = [
    ...docs.map((d) => ({
      id: `local_doc_${d._id}`,
      title: d.originalName,
      caseName: d.case ? d.case.caseName || d.case.caseNumber : '',
      court: '',
      date: d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : '',
      summary: makeSnippet(d.description || d.originalName, query),
      relevanceScore: 65,
      database: 'local',
      url: d.fileUrl || d.filePath || '',
      citation: '',
      keywords: [],
      fullText: ''
    })),
    ...cases.map((c) => ({
      id: `local_case_${c._id}`,
      title: c.caseName,
      caseName: c.caseName,
      court: '',
      date: c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : '',
      summary: makeSnippet(c.description || '', query),
      relevanceScore: 60,
      database: 'local',
      url: '',
      citation: c.caseNumber || '',
      keywords: [],
      fullText: ''
    }))
  ];

  // Optional: OpenAI semantic results
  let aiResults = [];
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const system = `You are a UK legal research assistant. Given a user query, return up to 5 relevant UK/Indian case law results in STRICT JSON with this exact shape:
{
  "results": [
    {
      "title": "string",
      "caseName": "string",
      "court": "string",
      "date": "YYYY-MM-DD",
      "citation": "string",
      "summary": "short summary",
      "keywords": ["string", "string"]
    }
  ]
}`;
      const userMsg = `Query: "${query}" (language: ${lang})
Only output JSON as specified. No extra commentary.`;
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.2
      });
      const content = resp.choices?.[0]?.message?.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}$/);
        parsed = m ? JSON.parse(m[0]) : { results: [] };
      }
      aiResults = (parsed.results || []).map((r, idx) => ({
        id: `ai_${Date.now()}_${idx + 1}`,
        title: r.title || r.caseName || 'Judgment',
        caseName: r.caseName || r.title || '',
        court: r.court || '',
        date: r.date || '',
        summary: r.summary || '',
        relevanceScore: 80 - idx * 5,
        database: 'openai',
        url: '',
        citation: r.citation || '',
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
        fullText: ''
      }));
    } catch (e) {
      console.error('OpenAI legal research error:', e?.message || e);
    }
  }

  const results = [...aiResults, ...localResults];
  const searchTime = Date.now() - t0;
  const resultsByDatabase = results.reduce((acc, r) => {
    acc[r.database] = acc[r.database] || [];
    acc[r.database].push(r);
    return acc;
  }, {});

  const databases = Object.keys(resultsByDatabase);
  return {
    query,
    totalResults: results.length,
    databases,
    results,
    resultsByDatabase,
    searchTime,
    timestamp: new Date().toISOString()
  };
}

// Aggregate search across local DB + stubs for external sources (GET)
router.get('/search', auth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const language = String(req.query.lang || 'en');
    const result = await performSearch(req.user.userId, q, language);
    res.json(result);
  } catch (e) {
    console.error('Research search error:', e);
    res.status(500).json({ message: 'Server error while searching' });
  }
});

// POST /search (JSON body)
router.post('/search', auth, async (req, res) => {
  try {
    const { query, language } = req.body || {};
    const result = await performSearch(req.user.userId, query || '', language || 'en');
    res.json(result);
  } catch (e) {
    console.error('Research search error (POST):', e);
    res.status(500).json({ message: 'Server error while searching' });
  }
});

// Stub suggestions endpoint for legal research autocomplete
router.get('/suggestions', auth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);

  // Very simple suggestion stub: echo query with a few variants
  res.json([
    q,
    `${q} case law`,
    `${q} Supreme Court`,
    `${q} High Court`,
  ]);
});

// Stub: list available legal databases for frontend UI
router.get('/databases', auth, async (req, res) => {
  // For now return a static list; can be wired to real providers later
  res.json([
    { id: 'local', name: 'Local Documents & Cases', enabled: true },
    { id: 'kanoon', name: 'Indian Kanoon (stub)', enabled: false },
    { id: 'indiacode', name: 'India Code (stub)', enabled: false },
  ]);
});

// Stub: recent legal research searches for current user
router.get('/recent', auth, async (req, res) => {
  // No persistence yet; return empty list so UI doesnt error
  res.json([]);
});

module.exports = router;


