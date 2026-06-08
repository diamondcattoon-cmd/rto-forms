const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Read HTML template and replace {{variables}}
function fillTemplate(templateName, data) {
  const templatePath = path.join(__dirname, 'templates', templateName);
  let html = fs.readFileSync(templatePath, 'utf8');
  
  // Replace all {{key}} with data values
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, data[key] || '');
  });
  
  return html;
}

// Generate PDF from HTML string using Puppeteer
async function htmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    
    return pdf;
  } finally {
    await browser.close();
  }
}

// Merge multiple PDFs
async function mergePdfs(htmlPages) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    
    // Create multi-page HTML by joining all pages
    const combinedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: A4; margin: 0; }
          .page-break { page-break-after: always; }
          body { margin: 0; padding: 0; }
          .page-wrapper { width: 210mm; min-height: 297mm; overflow: hidden; }
        </style>
      </head>
      <body>
        ${htmlPages.map((h, i) => 
          `<div class="page-wrapper">${extractBody(h)}</div>${i < htmlPages.length - 1 ? '<div class="page-break"></div>' : ''}`
        ).join('\n')}
      </body>
      </html>
    `;
    
    await page.setContent(combinedHtml, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    
    return pdf;
  } finally {
    await browser.close();
  }
}

// Extract body content + styles from full HTML
function extractBody(html) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
  const style = styleMatch ? `<style>${styleMatch[1]}</style>` : '';
  const body = bodyMatch ? bodyMatch[1] : html;
  return `${style}<div>${body}</div>`;
}

// ══════════════════════════════════
// API ENDPOINT: Generate all forms
// POST /api/generate
// ══════════════════════════════════
app.post('/api/generate', async (req, res) => {
  try {
    const d = req.body;
    
    // Validate required fields
    if (!d.seller_name || !d.buyer_name || !d.reg_no) {
      return res.status(400).json({ error: 'seller_name, buyer_name, reg_no required' });
    }

    // Prepare affidavit data for seller
    const sellerAff = {
      for_type: 'SELLER',
      dep_name: d.seller_name,
      dep_father: d.seller_father || '',
      dep_addr: d.seller_addr || '',
      dep_town: d.seller_town || '',
      dep_dist: d.seller_dist || '',
      veh_type: d.vehicle_type || 'Motor Vehicle',
      reg_no: d.reg_no,
      action_text: 'That I sold my',
      to_from: 'to',
      other_name: d.buyer_name,
      other_father: d.buyer_father || '',
      other_addr: d.buyer_addr || '',
      other_town: d.buyer_town || '',
      other_dist: d.buyer_dist || '',
      extra_clauses: `<div>That I have got no objection if the ownership of the said vehicle is transferred in the name of the above purchaser.</div>`,
      adv_at: d.advocate_at || '',
      sign_place: d.sign_place || '',
      party_label: 'Seller',
    };

    // Prepare affidavit data for purchaser
    const buyerAff = {
      for_type: 'PURCHASER',
      dep_name: d.buyer_name,
      dep_father: d.buyer_father || '',
      dep_addr: d.buyer_addr || '',
      dep_town: d.buyer_town || '',
      dep_dist: d.buyer_dist || '',
      veh_type: d.vehicle_type || 'Motor Vehicle',
      reg_no: d.reg_no,
      action_text: 'That I have purchased my',
      to_from: 'from',
      other_name: d.seller_name,
      other_father: d.seller_father || '',
      other_addr: d.seller_addr || '',
      other_town: d.seller_town || '',
      other_dist: d.seller_dist || '',
      extra_clauses: `
        <div>That I will be responsible any dues of taxes of the said vehicle</div>
        <div class="gap10"></div>
        <div class="indent">That kindly the ownership of the said vehicle is transferred in my name that the above seller</div>
      `,
      adv_at: d.advocate_at || '',
      sign_place: d.sign_place || '',
      party_label: 'Purchaser',
    };

    // Form 29 & 30 common data
    const formData = {
      seller_name: d.seller_name,
      seller_father: d.seller_father || '',
      seller_addr: d.seller_addr || '',
      seller_town: d.seller_town || '',
      seller_dist: d.seller_dist || '',
      buyer_name: d.buyer_name,
      buyer_father: d.buyer_father || '',
      buyer_addr: d.buyer_addr || '',
      buyer_town: d.buyer_town || '',
      buyer_dist: d.buyer_dist || '',
      reg_no: d.reg_no,
      make: d.make || '',
      chassis_no: d.chassis_no || '',
      engine_no: d.engine_no || '',
      rto: d.rto || 'District Transport Office',
      sale_day: d.sale_day || '',
      sale_year: d.sale_year || '',
      state: d.state || 'Jharkhand',
    };

    // Fill all 4 HTML templates
    const html29 = fillTemplate('form29.html', formData);
    const html30 = fillTemplate('form30.html', formData);
    const htmlAffSeller = fillTemplate('affidavit.html', sellerAff);
    const htmlAffBuyer = fillTemplate('affidavit.html', buyerAff);

    console.log('Generating PDFs...');
    
    // Generate combined PDF (all 4 pages)
    const pdf = await mergePdfs([html29, html30, htmlAffSeller, htmlAffBuyer]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RTO_Forms_${d.reg_no}.pdf"`);
    res.send(pdf);

    console.log(`Generated PDF for ${d.reg_no} - ${d.seller_name} -> ${d.buyer_name}`);

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.listen(PORT, () => {
  console.log(`RTO Forms Server running on port ${PORT}`);
  console.log(`Open: http://localhost:${PORT}`);
});
