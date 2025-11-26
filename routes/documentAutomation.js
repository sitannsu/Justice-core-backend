const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const auth = require('../middleware/auth');
const DocumentAutomation = require('../models/DocumentAutomation');
const Template = require('../models/Template');
const Case = require('../models/Case');
const Client = require('../models/Client');
const DocumentRun = require('../models/DocumentRun');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/templates';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `template-${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

function extractPlaceholdersFromBuffer(name) {
  // Simple regex for {{placeholders}}. A real impl would parse docx/pdf.
  const ph = Array.from(name.matchAll(/\{\{(.*?)\}\}/g)).map((m) => m[1]);
  return Array.from(new Set(ph));
}

// Templates
router.get('/templates', auth, async (req, res) => {
  const list = await Template.find({ createdBy: req.user.userId }).sort({ createdAt: -1 });
  res.json(list);
});

router.post('/templates', auth, upload.single('file'), async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const placeholders = extractPlaceholdersFromBuffer(req.file.originalname);
    const tpl = await Template.create({
      name: name || req.file.originalname,
      type,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      placeholders,
      createdBy: req.user.userId,
    });
    res.status(201).json(tpl);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// AI-assisted search for templates
router.post('/templates/search-ai', auth, async (req, res) => {
  try {
    const { q } = req.body || {};
    if (!q || !String(q).trim()) {
      return res.json([]);
    }

    // Ask OpenAI to expand the query into keywords
    let keywords = [];
    try {
      const prompt = `You are helping search legal document templates. 
User query: "${q}"
Return a concise JSON with up to 6 keywords/phrases likely to match template names, types, or placeholders.
Format strictly as: {"keywords":["..."]}`;
      const ai = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You expand queries into search keywords in JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      });
      const text = ai.choices?.[0]?.message?.content || '';
      const json = JSON.parse(text);
      if (Array.isArray(json.keywords)) {
        keywords = json.keywords.slice(0, 6).map((k) => String(k));
      }
    } catch (err) {
      // Fallback to simple split
      keywords = String(q).split(/\s+/).slice(0, 6);
    }

    const regexes = keywords.map((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    const filter = {
      createdBy: req.user.userId,
      $or: [
        { name: { $in: regexes } },
        { type: { $in: regexes } },
        { placeholders: { $in: keywords } }
      ]
    };
    const results = await Template.find(filter).sort({ updatedAt: -1 }).limit(25);
    res.json(results);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Automations list with search/filter/sort/pagination
router.get('/documents/automation', auth, async (req, res) => {
  try {
    const { q = '', status, type, page = 1, pageSize = 10, sort = '-updatedAt' } = req.query;
    const filter = { createdBy: req.user.userId };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (q) filter.name = { $regex: q, $options: 'i' };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      DocumentAutomation.find(filter).sort(sort).skip(skip).limit(Number(pageSize)).populate('case', 'caseNumber caseName').populate('client', 'company contactPerson'),
      DocumentAutomation.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/documents/automation', auth, upload.single('templateFile'), async (req, res) => {
  try {
    const { name, type, caseId, clientId, trigger, triggerDetails, templateId, mappings, recipients, status, templatePlaceholders } = req.body;
    let tplId = templateId;
    let templatePath;
    let placeholders = [];
    if (!tplId && req.file) {
      const tpl = await Template.create({
        name: req.file.originalname,
        type,
        path: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
        placeholders: extractPlaceholdersFromBuffer(req.file.originalname),
        createdBy: req.user.userId,
      });
      tplId = tpl._id;
      templatePath = tpl.path;
      placeholders = tpl.placeholders;
    }
    // Accept placeholders from body (for sample templates without uploaded file)
    if (!req.file && !tplId && templatePlaceholders) {
      try {
        placeholders = Array.isArray(templatePlaceholders)
          ? templatePlaceholders
          : JSON.parse(templatePlaceholders);
      } catch (err) {
        placeholders = [];
      }
    }
    const created = await DocumentAutomation.create({
      name,
      type,
      case: caseId,
      client: clientId,
      trigger,
      triggerDetails: triggerDetails ? JSON.parse(triggerDetails) : undefined,
      templateId: tplId,
      templatePath,
      templatePlaceholders: placeholders,
      mappings: mappings ? JSON.parse(mappings) : [],
      recipients: recipients ? JSON.parse(recipients) : [],
      status: status || 'active',
      createdBy: req.user.userId,
    });
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/documents/automation/:id', auth, async (req, res) => {
  const doc = await DocumentAutomation.findById(req.params.id).populate('case', 'caseNumber caseName').populate('client', 'company contactPerson').populate('templateId');
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json(doc);
});

router.put('/documents/automation/:id', auth, upload.single('templateFile'), async (req, res) => {
  try {
    const update = { ...req.body, updatedBy: req.user.userId };
    if (req.file) {
      update.templatePath = req.file.path;
      update.templatePlaceholders = extractPlaceholdersFromBuffer(req.file.originalname);
    }
    if (update.mappings && typeof update.mappings === 'string') update.mappings = JSON.parse(update.mappings);
    const doc = await DocumentAutomation.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(doc);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/documents/automation/:id', auth, async (req, res) => {
  await DocumentAutomation.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

router.post('/documents/automation/bulk-delete', auth, async (req, res) => {
  const { ids } = req.body;
  await DocumentAutomation.deleteMany({ _id: { $in: ids || [] }, createdBy: req.user.userId });
  res.json({ message: 'Deleted' });
});

router.post('/documents/automation/preview', auth, upload.single('templateFile'), async (req, res) => {
  // For MVP, echo back a basic HTML preview
  const html = `<html><body><h3>Preview</h3><p>Template: ${req.file?.originalname || 'existing template'}</p></body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Manual trigger to generate a document (MVP)
router.post('/documents/automation/:id/run', auth, async (req, res) => {
  try {
    const auto = await DocumentAutomation.findById(req.params.id);
    if (!auto) return res.status(404).json({ message: 'Automation not found' });
    const run = await DocumentRun.create({ automation: auto._id, status: 'success', outputPath: '', outputMime: 'text/html', recipients: auto.recipients || [], payload: req.body || {} });
    res.json(run);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Runs history
router.get('/documents/automation/:id/runs', auth, async (req, res) => {
  const runs = await DocumentRun.find({ automation: req.params.id }).sort({ createdAt: -1 });
  res.json(runs);
});

module.exports = router;


