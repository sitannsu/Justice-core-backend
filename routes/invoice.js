const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Case = require('../models/Case');
const auth = require('../middleware/auth');
const clientAuth = require('../middleware/clientAuth');
const mongoose = require('mongoose');
const { jsPDF } = require('jspdf');
const axios = require('axios');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { emailService } = require('../services/email.service');

// Helper to send invoice email
async function sendInvoiceEmail(invoice) {
  if (!invoice.client || !invoice.client.email) return;

  try {
    const clientName = invoice.client.contactPerson || invoice.client.company || 'Client';
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; }
          .header { background-color: #2c3e50; color: white; padding: 15px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { padding: 20px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #777; }
          .details { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .button { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Invoice ${invoice.invoiceNumber}</h2>
          </div>
          <div class="content">
            <p>Hello ${clientName},</p>
            <p>A new invoice has been generated for your recent services.</p>
            <div class="details">
              <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
              <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
              <p><strong>Total Amount:</strong> Rs. ${invoice.total.toFixed(2)}</p>
              <p><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <p>Please log in to your portal to view and pay this invoice.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Docket Digital. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailService.sendEmail({
      to: invoice.client.email,
      subject: `Invoice ${invoice.invoiceNumber} from Docket Digital`,
      html: emailHtml
    });
    console.log(`Invoice email sent to ${invoice.client.email}`);
  } catch (error) {
    console.error('Failed to send invoice email:', error);
  }
}

// For lawyers: create invoice (simplified)
router.post('/', auth, async (req, res) => {
  try {
    const { case: caseId, client: clientId, expenses = [], date, notes, description, paymentTerms, dueDate, theme } = req.body;

    if (!mongoose.Types.ObjectId.isValid(caseId) && caseId !== 'none') {
      // Allow 'none' or valid ID? The frontend sends 'none' if no case selected.
      // Originally checking check caseId.
    }

    // Existing validation logic
    if (caseId && caseId !== 'none' && !mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({ message: 'Invalid case ID format' });
    }

    const subtotal = expenses.reduce((acc, exp) => {
      if (exp.billable) {
        const quantity = typeof exp.quantity === 'number' ? exp.quantity : 1;
        const cost = typeof exp.cost === 'number' ? exp.cost : 0;
        return acc + cost * quantity;
      }
      return acc;
    }, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    const invoiceDoc = new Invoice({
      case: caseId && caseId !== 'none' ? caseId : undefined, // Handle 'none'
      user: req.user.userId,
      client: clientId && clientId !== 'select' ? clientId : undefined,
      date,
      dueDate,
      expenses,
      subtotal,
      tax,
      total,
      status: 'Draft',
      description,
      notes,
      paymentTerms,
      theme: theme || 'professional'
    });

    if (!invoiceDoc.client && caseId) {
      const c = await Case.findById(caseId).select('clients');
      if (c && Array.isArray(c.clients) && c.clients.length > 0) {
        invoiceDoc.client = c.clients[0];
      }
    }

    await invoiceDoc.save();

    // Populate client details to get email
    const populatedInvoice = await Invoice.findById(invoiceDoc._id)
      .populate('client')
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName');

    // Send email automatically on creation
    await sendInvoiceEmail(populatedInvoice);

    res.status(201).json(populatedInvoice);
  } catch (e) {
    console.error('Error creating invoice:', e);
    if (e.name === 'ValidationError') {
      return res.status(400).json({ message: e.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// For lawyers: list invoices created by current user
router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user.userId })
      .populate('case', 'caseName caseNumber')
      .populate('client', 'company contactPerson email')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const [totalStats, statusStats] = await Promise.all([
      Invoice.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$total' },
            totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$total', 0] } },
            totalOutstanding: { $sum: { $cond: [{ $eq: ['$status', 'Outstanding'] }, '$total', 0] } }
          }
        }
      ]),
      Invoice.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
      ])
    ]);

    res.json({
      totals: totalStats[0] || { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0 },
      byStatus: statusStats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, total: stat.total };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error getting invoice stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/recent-activity', auth, async (req, res) => {
  try {
    const recentInvoices = await Invoice.find({ user: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('case', 'caseName caseNumber')
      .populate('client', 'company contactPerson email')
      .populate('user', 'firstName lastName');
    const recentActivity = recentInvoices.map(invoice => ({
      id: invoice._id,
      action: invoice.status,
      date: invoice.createdAt,
      amount: invoice.total,
      case: invoice.case,
      user: invoice.user
    }));
    res.json(recentActivity);
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single invoice
// Client endpoints must come before ":id" to avoid route capture
// Client portal: list invoices by logged-in client
router.get('/client', clientAuth, async (req, res) => {
  try {
    const clientId = req.user.clientId || req.user.id;
    console.log('[API] Fetching invoices for client:', clientId);
    
    // Convert to ObjectId explicitly just in case
    const queryId = new mongoose.Types.ObjectId(clientId);
    
    const list = await Invoice.find({ client: queryId })
      .populate('case', 'caseName caseNumber')
      .populate('client', 'company contactPerson email')
      .sort({ createdAt: -1 });
      
    console.log(`[API] Found ${list.length} invoices for client ${clientId}`);
    res.json(list);
  } catch (e) { 
    console.error('[API] Error in getClientInvoices:', e);
    res.status(500).json({ message: e.message }); 
  }
});

// Lawyer: Get invoices by client ID
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }
    const invoices = await Invoice.find({ client: clientId })
      .populate('case', 'caseName caseNumber clients')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Error getting client invoices:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single invoice
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.userId })
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// Update invoice (PUT and PATCH)
async function updateInvoiceHandler(req, res) {
  try {
    const { status, expenses, notes, paymentTerms, dueDate, theme } = req.body;
    let updateData = {};
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (paymentTerms) updateData.paymentTerms = paymentTerms;
    if (dueDate) updateData.dueDate = dueDate;
    if (theme) updateData.theme = theme;

    if (expenses) {
      const subtotal = expenses.reduce((acc, exp) => {
        if (exp.billable) {
          const quantity = typeof exp.quantity === 'number' ? exp.quantity : 1;
          const cost = typeof exp.cost === 'number' ? exp.cost : 0;
          return acc + cost * quantity;
        }
        return acc;
      }, 0);
      const tax = subtotal * 0.1;
      const total = subtotal + tax;
      updateData = { ...updateData, expenses, subtotal, tax, total };
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { $set: updateData },
      { new: true }
    ).populate([
      { path: 'case', select: 'caseName caseNumber' },
      { path: 'user', select: 'firstName lastName' }
    ]);

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

router.put('/:id', auth, updateInvoiceHandler);
router.patch('/:id', auth, updateInvoiceHandler);

// Delete invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.userId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    await invoice.remove();
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Download Invoice PDF
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.userId })
      .populate('client')
      .populate('case', 'caseName caseNumber');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Fetch Organization Settings
    const user = await User.findById(req.user.userId);
    const tenantId = user.tenant_id || 'default';
    const org = await Organization.findOne({ tenant_id: tenantId });

    const orgSettings = org ? {
      organizationName: org.name || 'DOCKET DIGITAL',
      address: org.address || '',
      logoUrl: org.logoUrl || null,
      email: org.contactEmail || user.email,
      phone: org.contactPhone || ''
    } : {
      organizationName: 'DOCKET DIGITAL',
      address: '',
      email: user.email,
      phone: ''
    };

    // Initialize jsPDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    let yPos = 20;

    const theme = invoice.theme || 'professional';

    // Formatting Helpers
    const formatCurrencyForPDF = (amount) => {
      return `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // --- LOGO Handling ---
    if (orgSettings.logoUrl) {
      try {
        let logoBuffer;
        let logoType = 'JPEG';

        if (orgSettings.logoUrl.startsWith('http')) {
          const logoResponse = await axios.get(orgSettings.logoUrl, { responseType: 'arraybuffer' });
          logoBuffer = Buffer.from(logoResponse.data, 'binary');
          const contentType = logoResponse.headers['content-type'];
          if (contentType && contentType.includes('png')) logoType = 'PNG';
          else if (contentType && contentType.includes('webp')) logoType = 'WEBP';
        } else {
          // Local file handling
          const fs = require('fs');
          const path = require('path');
          // Extract path from URL or relative path
          const relativePath = orgSettings.logoUrl.includes('uploads/')
            ? orgSettings.logoUrl.substring(orgSettings.logoUrl.indexOf('uploads/'))
            : orgSettings.logoUrl;

          if (fs.existsSync(relativePath)) {
            logoBuffer = fs.readFileSync(relativePath);
            if (relativePath.toLowerCase().endsWith('.png')) logoType = 'PNG';
          }
        }

        if (logoBuffer) {
          const logoBase64 = logoBuffer.toString('base64');
          doc.addImage(logoBase64, logoType, margin, yPos, 35, 15);
          yPos += 20;
        }
      } catch (err) {
        console.error('Failed to load logo for PDF:', err.message);
      }
    }

    // Firm Info (From) - Top Right
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(orgSettings.organizationName, pageWidth - margin, 25, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const fromLines = [];
    if (orgSettings.address) fromLines.push(...doc.splitTextToSize(orgSettings.address, 60));
    if (orgSettings.email) fromLines.push(orgSettings.email);
    if (orgSettings.phone) fromLines.push(orgSettings.phone);
    doc.text(fromLines, pageWidth - margin, 31, { align: 'right' });

    yPos = Math.max(yPos, 55);

    // Invoice Title & Status
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('INVOICE', margin, yPos);

    // Status Badge
    const status = (invoice.status || 'Draft').toUpperCase();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text(`STATUS: ${status}`, margin, yPos + 6);

    yPos += 18;
    const metaY = yPos;

    // Client Details (To)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('BILL TO:', margin, yPos);

    yPos += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);

    const client = invoice.client;
    let clientNameDisplay = 'Valued Client';
    if (client) {
      if (client.company) clientNameDisplay = client.company;
      else if (client.contactPerson) clientNameDisplay = client.contactPerson;
    }
    doc.text(clientNameDisplay, margin, yPos);

    yPos += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const toLines = [];
    if (client?.contactPerson && client?.company) toLines.push(`Attn: ${client.contactPerson}`);
    if (client?.address) toLines.push(...doc.splitTextToSize(client.address, 70));
    if (client?.email) toLines.push(client.email);
    if (client?.phone) toLines.push(client.phone);
    doc.text(toLines, margin, yPos);

    // Invoice Meta (Right side)
    let rightY = metaY;
    const rightXLabel = pageWidth - margin - 40;
    const rightXValue = pageWidth - margin;

    const metaRows = [
      { label: 'Invoice #:', value: invoice.invoiceNumber },
      { label: 'Date:', value: new Date(invoice.date).toLocaleDateString() },
      { label: 'Due Date:', value: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-' },
      { label: 'Case:', value: invoice.case?.caseNumber || 'N/A' },
      { label: 'Total Amount:', value: formatCurrencyForPDF(invoice.total), highlight: true }
    ];

    metaRows.forEach(row => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(row.label, rightXLabel, rightY, { align: 'right' });

      doc.setFont('helvetica', row.highlight ? 'bold' : 'normal');
      doc.setTextColor(row.highlight ? 0 : 50, row.highlight ? 0 : 50, row.highlight ? 0 : 50);
      doc.text(String(row.value), rightXValue, rightY, { align: 'right' });
      rightY += 5;
    });

    yPos = Math.max(yPos + (toLines.length * 4) + 12, rightY + 12);

    // Table Header
    const tableHeaderColor = theme === 'creative' ? [23, 37, 84] : [240, 240, 240];
    const tableHeaderTextColor = theme === 'creative' ? [255, 255, 255] : [60, 60, 60];

    doc.setFillColor(tableHeaderColor[0], tableHeaderColor[1], tableHeaderColor[2]);
    doc.rect(margin, yPos, contentWidth, 9, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(tableHeaderTextColor[0], tableHeaderTextColor[1], tableHeaderTextColor[2]);

    const colDescX = margin + 4;
    const colTypeX = margin + 85;
    const colRateX = margin + 120;
    const colQtyX = margin + 140;
    const colAmtX = pageWidth - margin - 4;

    doc.text('DESCRIPTION', colDescX, yPos + 6);
    doc.text('TYPE', colTypeX, yPos + 6);
    doc.text('RATE', colRateX, yPos + 6, { align: 'right' });
    doc.text('QTY', colQtyX, yPos + 6, { align: 'center' });
    doc.text('AMOUNT', colAmtX, yPos + 6, { align: 'right' });
    yPos += 14;

    // Table Body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);

    invoice.expenses?.forEach((item, index) => {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }

      const description = item.description || item.activity || 'Item';
      const type = item.costType || 'Service';
      const rate = item.cost || 0;
      const qty = item.quantity || 1;
      const amount = (rate * qty);

      const splitDesc = doc.splitTextToSize(description, 75);
      doc.text(splitDesc, colDescX, yPos);
      doc.text(type, colTypeX, yPos);
      doc.text(formatCurrencyForPDF(rate), colRateX, yPos, { align: 'right' });
      doc.text(String(qty), colQtyX, yPos, { align: 'center' });
      doc.text(formatCurrencyForPDF(amount), colAmtX, yPos, { align: 'right' });

      const lineH = (splitDesc.length * 4);
      yPos += Math.max(lineH, 7) + 3;

      // Separator line
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    });

    // Totals Grid
    yPos += 4;
    const totalsXLabel = pageWidth - margin - 45;
    const totalsXValue = pageWidth - margin - 4;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);

    doc.text('Subtotal:', totalsXLabel, yPos, { align: 'right' });
    doc.text(formatCurrencyForPDF(invoice.subtotal || 0), totalsXValue, yPos, { align: 'right' });
    yPos += 6;

    if (invoice.tax > 0) {
      doc.text('Tax (10%):', totalsXLabel, yPos, { align: 'right' });
      doc.text(formatCurrencyForPDF(invoice.tax), totalsXValue, yPos, { align: 'right' });
      yPos += 6;
    }

    doc.setDrawColor(180, 180, 180);
    doc.line(totalsXLabel - 10, yPos - 1, pageWidth - margin, yPos - 1);

    yPos += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Total:', totalsXLabel, yPos, { align: 'right' });
    doc.text(formatCurrencyForPDF(invoice.total || 0), totalsXValue, yPos, { align: 'right' });

    // Footer / Notes
    if (invoice.notes || invoice.paymentTerms) {
      yPos += 20;
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }

      if (invoice.notes) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('NOTES:', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(invoice.notes, contentWidth), margin, yPos);
        yPos += 12;
      }

      if (invoice.paymentTerms) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT TERMS:', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(invoice.paymentTerms, contentWidth), margin, yPos);
      }
    }

    // Output PDF
    const pdfOutput = doc.output();
    const pdfBuffer = Buffer.from(pdfOutput, 'binary');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoiceNumber}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ message: 'Server error generating PDF' });
  }
});

// Send invoice
router.post('/:id/send', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.userId }).populate('client').populate('case', 'caseName caseNumber');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Mark as Sent
    invoice.status = 'Sent';
    await invoice.save();

    // Send email
    await sendInvoiceEmail(invoice);

    res.json({ message: 'Invoice sent successfully', invoice });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark invoice as paid
router.put('/:id/pay', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { $set: { status: 'Paid' } },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
