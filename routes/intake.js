const express = require('express');
const auth = require('../middleware/auth');
const Case = require('../models/Case');
const Client = require('../models/Client');

const router = express.Router();

function normalize(text = '') {
  return String(text || '').toLowerCase();
}

function classifyDomain(facts = '', providedType = '') {
  const text = normalize(`${facts} ${providedType}`);
  const categories = {
    'Criminal': ['ipc', 'fir', 'police', 'theft', 'assault', 'bail', 'charge sheet', 'section 302', 'section 420'],
    'Civil/Contract': ['contract', 'agreement', 'breach', 'indemnity', 'termination', 'liability', 'consideration'],
    'Family': ['divorce', 'custody', 'maintenance', 'marriage', 'domestic violence', '498a'],
    'Property': ['property', 'land', 'title', 'possession', 'encroachment', 'sale deed', 'mutation'],
    'Employment': ['employment', 'labour', 'wages', 'termination', 'gratuity', 'pf', 'esi'],
    'IP': ['trademark', 'copyright', 'patent', 'ip infringement', 'design'],
    'Tax': ['gst', 'income tax', 'assessment', 'notice u/s', 'it act'],
  };

  let best = 'Civil/Contract';
  let bestScore = 0;
  const scores = {};
  Object.entries(categories).forEach(([cat, keywords]) => {
    const score = keywords.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0);
    scores[cat] = score;
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  });

  return { domain: best, scores };
}

function suggestStatutes(domain = 'Civil/Contract') {
  const map = {
    'Criminal': ['IPC Sections 420, 406 (cheating, criminal breach of trust)', 'CrPC Sections 41, 173 (arrest, charge-sheet)'],
    'Civil/Contract': ['Indian Contract Act, 1872 (Sections 10, 73)', 'Specific Relief Act, 1963'],
    'Family': ['Hindu Marriage Act, 1955 (Sections 13, 24)', 'Protection of Women from Domestic Violence Act, 2005'],
    'Property': ['Transfer of Property Act, 1882', 'Specific Relief Act (injunctions)'],
    'Employment': ['Industrial Disputes Act, 1947', 'Payment of Wages Act, 1936'],
    'IP': ['Trade Marks Act, 1999', 'Copyright Act, 1957'],
    'Tax': ['CGST Act, 2017', 'Income Tax Act, 1961'],
  };
  return map[domain] || [];
}

// Create intake with optional case creation; if dryRun=true, only returns classification/suggestions
router.post('/', auth, async (req, res) => {
  try {
    const { client = {}, caseTitle, caseType, facts, dryRun } = req.body || {};

    const classification = classifyDomain(facts, caseType);
    const statutes = suggestStatutes(classification.domain);

    if (dryRun) {
      return res.json({ classification, statutes });
    }

    // Ensure client exists or create
    let clientDoc = null;
    if (client && client.email) {
      clientDoc = await Client.findOne({ email: client.email });
      if (!clientDoc) {
        clientDoc = await Client.create({
          lawyer: req.user.userId,
          company: client.company || '',
          contactPerson: client.contactPerson || client.name || '',
          email: client.email,
          phone: client.phone || '',
          address: client.address || '',
          accountType: 'Individual',
          status: 'Active',
          password: 'Password123'
        });
      }
    }

    const newCase = new Case({
      caseName: caseTitle || `New Case - ${new Date().toISOString()}`,
      caseNumber: `CASE-${Date.now()}`,
      practiceArea: classification.domain,
      caseStage: caseType || 'Intake',
      dateOpened: new Date(),
      office: '',
      description: facts || '',
      statuteOfLimitations: undefined,
      conflictCheck: false,
      conflictCheckNotes: '',
      clients: clientDoc ? [clientDoc._id] : [],
      contacts: [],
      staff: [],
      customFields: { domain: classification.domain, suggestedStatutes: statutes },
      status: 'Active',
      lawyer: req.user.userId
    });

    await newCase.save();

    return res.status(201).json({
      message: 'Intake created',
      case: newCase,
      classification,
      statutes
    });
  } catch (e) {
    console.error('Intake error:', e);
    res.status(500).json({ message: 'Server error while creating intake' });
  }
});

module.exports = router;
// Recent intakes (cases created via intake)
router.get('/recent', auth, async (req, res) => {
  try {
    const cases = await Case.find({
      lawyer: req.user.userId,
      caseStage: { $in: ['Intake', 'intake'] }
    })
      .populate('clients', 'company contactPerson email')
      .sort({ createdAt: -1 })
      .limit(20);

    const data = cases.map(c => ({
      id: c._id,
      caseNumber: c.caseNumber,
      caseName: c.caseName,
      createdAt: c.createdAt,
      domain: c.customFields?.domain,
      statutes: c.customFields?.suggestedStatutes || [],
      client: c.clients && c.clients[0] ? {
        contactPerson: c.clients[0].contactPerson,
        company: c.clients[0].company,
        email: c.clients[0].email
      } : null
    }));
    res.json(data);
  } catch (e) {
    console.error('Recent intake error:', e);
    res.status(500).json({ message: 'Server error while fetching recent intakes' });
  }
});


