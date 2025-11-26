const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Stub endpoint: list courts for judgment search filters
router.get('/courts', auth, async (req, res) => {
  // Simple static list for now; can be wired to real data later
  res.json([
    'Supreme Court of India',
    'Delhi High Court',
    'Bombay High Court',
    'Madras High Court',
    'Karnataka High Court',
  ]);
});

// Stub endpoint: list case types for judgment search filters
router.get('/case-types', auth, async (req, res) => {
  res.json([
    'Civil',
    'Criminal',
    'Constitutional',
    'Commercial',
    'Family',
    'Labour',
  ]);
});

// Stub endpoint: semantic judgment search
// Uses OpenAI to create structured candidate results when no DB is connected.
router.post('/search', auth, async (req, res) => {
  try {
    const { query, filters } = req.body || {};
    const q = (query || '').trim();
    if (!q) {
      return res.json({ query: '', filters: filters || {}, results: [], total: 0 });
    }

    const system = `You are a legal research assistant. Given a query, produce up to 5 highly relevant Indian case law search results.
Return STRICT JSON with this shape only:
{
  "results": [
    {
      "title": "Case title",
      "court": "Court name",
      "date": "YYYY-MM-DD",
      "citation": "Official citation or empty",
      "snippet": "1-2 sentence summary of relevance"
    }
  ]
}`;

    const user = `Query: "${q}"
Filters (optional): ${JSON.stringify(filters || {})}
Only output the JSON as specified.`;

    let json;
    try {
      const ai = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
      });
      const content = ai.choices?.[0]?.message?.content || '{}';
      // Try parse JSON directly; if it includes text around, extract first {...}
      try {
        json = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}$/);
        json = match ? JSON.parse(match[0]) : { results: [] };
      }
    } catch (err) {
      console.error('OpenAI search error:', err?.message);
      json = { results: [] };
    }

    const now = Date.now();
    const results = (json.results || []).map((r, idx) => ({
      id: `AI-${now}-${idx + 1}`,
      title: r.title || 'Untitled judgment',
      court: r.court || '',
      date: r.date || '',
      citation: r.citation || '',
      snippet: r.snippet || '',
      relevance: 0.9 - idx * 0.1,
      source: 'openai',
      aiContent: {
        content: r.snippet || '',
        summary: r.snippet || '',
        query: q,
        timestamp: new Date().toISOString()
      }
    }));

    return res.json({
      query: q,
      filters: filters || {},
      results,
      total: results.length
    });
  } catch (e) {
    console.error('Judgment search error:', e);
    res.status(500).json({ message: 'Search failed', error: e.message });
  }
});

// Generate AI summary for a judgment (works for AI or DB-backed)
router.post('/:id/summarize', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ message: 'OpenAI not configured' });
    }

    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ message: 'No content provided to summarize' });
    }

    const systemPrompt = `You are an experienced legal analyst. Summarize the following judgment into structured sections.
Return STRICT JSON with:
{
  "facts": "string",
  "legalIssues": "string",
  "decision": "string",
  "reasoning": "string",
  "relatedPrecedents": ["string", "string"]
}`;

    const userPrompt = `Summarize this judgment into the specified JSON shape:\n\n${content}`;

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/);
      json = m ? JSON.parse(m[0]) : {
        facts: '',
        legalIssues: '',
        decision: '',
        reasoning: '',
        relatedPrecedents: []
      };
    }

    res.json({ id, summary: json });
  } catch (e) {
    console.error('Judgment summarize error:', e);
    res.status(500).json({ message: 'Failed to generate summary', error: e.message });
  }
});

module.exports = router;
