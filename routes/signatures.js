const express = require('express');
const router = express.Router();
const SignatureRequest = require('../models/SignatureRequest');
const auth = require('../middleware/auth');

// Create a new signature request
router.post('/', auth, async (req, res) => {
    try {
        const {
            documentName,
            documentType,
            provider,
            emailSubject,
            emailMessage,
            signers,
            expiresIn,
            remindersEnabled,
            reminderInterval
        } = req.body;

        // Calculate expiry date
        let expiresAt = new Date();
        const days = parseInt(expiresIn?.replace('days', '') || '30');
        expiresAt.setDate(expiresAt.getDate() + days);

        const signatureRequest = new SignatureRequest({
            documentName,
            documentType,
            provider,
            emailSubject,
            emailMessage,
            signers,
            createdBy: req.user.id,
            expiresAt,
            remindersEnabled,
            reminderInterval,
            status: 'sent'
        });

        await signatureRequest.save();

        // In a real implementation:
        // If provider === 'docusign', call DocuSign API here
        // If provider === 'aadhaar', call eSign ESP API here
        // For manual, we just send standard emails containing a link to sign on our portal

        res.status(201).json(signatureRequest);
    } catch (err) {
        console.error('Error creating signature request:', err);
        res.status(500).json({ message: 'Server error creating signature request' });
    }
});

// Get all signature requests for the logged-in user
router.get('/', auth, async (req, res) => {
    try {
        const requests = await SignatureRequest.find({ createdBy: req.user.id })
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error('Error fetching signature requests:', err);
        res.status(500).json({ message: 'Server error fetching signature requests' });
    }
});

// Get a specific signature request
router.get('/:id', auth, async (req, res) => {
    try {
        const request = await SignatureRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Signature request not found' });
        }

        // Check authorization (only creator or someone involved could view it ideally)
        if (request.createdBy.toString() !== req.user.id) {
            // Allow if the user is one of the signers? For now only creator can view the dashboard
            // return res.status(403).json({ message: 'Not authorized to view this request' });
        }

        res.json(request);
    } catch (err) {
        console.error('Error fetching signature request:', err);
        res.status(500).json({ message: 'Server error fetching signature request' });
    }
});

// Update signer status (manual signing workflow)
router.post('/:id/sign', async (req, res) => {
    // Ideally this would be protected by a unique token sent to the signer's email
    try {
        const { signerEmail, signatureData } = req.body;

        const request = await SignatureRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Signature request not found' });
        }

        const signer = request.signers.find(s => s.email === signerEmail);
        if (!signer) {
            return res.status(404).json({ message: 'Signer not found on this request' });
        }

        signer.status = 'signed';
        signer.signedAt = new Date();
        signer.signatureData = signatureData;
        // signer.ipAddress = req.ip;

        // Check if all signers who need to sign have signed
        const allSigned = request.signers.every(s =>
            s.role !== 'signer' || (s.role === 'signer' && s.status === 'signed') || s.status === 'approved'
        );

        if (allSigned) {
            request.status = 'completed';
        } else {
            request.status = 'in_progress';
        }

        await request.save();

        res.json(request);
    } catch (err) {
        console.error('Error signing document:', err);
        res.status(500).json({ message: 'Server error signing document' });
    }
});

module.exports = router;
