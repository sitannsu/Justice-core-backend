const express = require('express');
const auth = require('../middleware/auth');
const Document = require('../models/Document');
const Case = require('../models/Case');

const router = express.Router();

function makeSnippet(text = '', query = '') {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 140) + (text.length > 140 ? '…' : '');
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + query.length + 60);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

// Aggregate search across local DB + stubs for external sources
router.get('/search', auth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const language = String(req.query.lang || 'en');
    if (!q) return res.json({ query: q, language, local: [], kanoon: [], indiacode: [] });

    // Local search - simple regex against important fields
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [docs, cases] = await Promise.all([
      Document.find({ $and: [
        { status: { $ne: 'deleted' } },
        { $or: [
          { originalName: regex },
          { description: regex },
          { tags: regex },
          { folder: regex },
          { documentType: regex },
        ]}
      ]}).limit(25).populate('case', 'caseName caseNumber'),
      Case.find({
        lawyer: req.user.userId,
        $or: [ 
          { caseName: regex }, 
          { description: regex },
          { caseNumber: regex },
          { 'customFields.domain': regex },
          { 'customFields.suggestedStatutes': regex }
        ]
      }).limit(25)
    ]);

    const local = [
      ...docs.map(d => ({
        id: `doc_${d._id}`,
        kind: 'document',
        title: d.originalName,
        snippet: makeSnippet(d.description || d.originalName, q),
        meta: {
          case: d.case ? (d.case.caseName || d.case.caseNumber) : undefined,
          size: d.fileSize,
          type: d.documentType,
          folder: d.folder || ''
        }
      })),
      ...cases.map(c => ({
        id: `case_${c._id}`,
        kind: 'case',
        title: c.caseName,
        snippet: makeSnippet(c.description || '', q),
        meta: {
          number: c.caseNumber,
          domain: c.customFields?.domain
        }
      }))
    ];

    // External stubs – to be replaced with API calls + caching
    const kanoon = [];
    const indiacode = [];

    res.json({ query: q, language, local, kanoon, indiacode });
  } catch (e) {
    console.error('Research search error:', e);
    res.status(500).json({ message: 'Server error while searching' });
  }
});

// POST /search alias so frontend can use either GET with query params or POST with JSON body
router.post('/search', auth, async (req, res) => {
  // Map JSON body to query string fields and delegate to the same handler logic
  const { query, language } = req.body || {};
  req.query.q = query || req.query.q || '';
  if (language) req.query.lang = language;
  return router.handle(req, res);
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


