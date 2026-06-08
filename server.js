const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Files are in root directory (no subfolders)
const ROOT = __dirname;

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// Fill template with data
function fillTemplate(filename, data) {
  let html = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  Object.keys(data).forEach(k => {
    html = html.replace(new RegExp(`{{${k}}}`, 'g'), data[k] || '');
  });
  return html;
}

// HTML to PDF via Puppeteer
async function htmlToPdf(htmlPages) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    const combined = `<!DOCTYPE html><html><head>
      <style>
        @page { size: A4; margin: 0; }
        .pg { width:210mm; min-height:297mm; overflow:hidden; page-break-after:always; }
        .pg:last-child { page-break-after:auto; }
        body { margin:0; padding:0; }
      </style></head><body>
      ${htmlPages.map(h => `<div class="pg">${extractBody(h)}</div>`).join('')}
    </body></html>`;
    await page.setContent(combined, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true,
      margin: { top:'0', right:'0', bottom:'0', left:'0' } });
    return pdf;
  } finally {
    await browser.close();
  }
}

function extractBody(html) {
  const s = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const b = (html.match(/<body>([\s\S]*?)<\/body>/) || [])[1] || html;
  return `<style>${s}</style>${b}`;
}

// POST /api/generate
app.post('/api/generate', async (req, res) => {
  try {
    const d = req.body;
    if (!d.seller_name || !d.buyer_name || !d.reg_no)
      return res.status(400).json({ error: 'seller_name, buyer_name, reg_no required' });

    const dt = d.sale_date ? new Date(d.sale_date) : new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const day = dt.getDate();
    const suf = day===1?'st':day===2?'nd':day===3?'rd':'th';
    const sale_day = day+suf+' '+months[dt.getMonth()];
    const sale_year = dt.getFullYear().toString();

    const fd = { ...d, sale_day, sale_year, state: d.state||'Jharkhand' };

    const sellerAff = {
      for_type:'SELLER', dep_name:d.seller_name, dep_father:d.seller_father||'',
      dep_addr:d.seller_addr||'', dep_town:d.seller_town||'', dep_dist:d.seller_dist||'',
      veh_type:d.vehicle_type||'Motor Vehicle', reg_no:d.reg_no,
      action_text:'That I sold my', to_from:'to',
      other_name:d.buyer_name, other_father:d.buyer_father||'',
      other_addr:d.buyer_addr||'', other_town:d.buyer_town||'', other_dist:d.buyer_dist||'',
      extra_clauses:'<div style="margin-top:8px">That I have got no objection if the ownership of the said vehicle is transferred in the name of the above purchaser.</div>',
      adv_at:d.advocate_at||'', sign_place:d.sign_place||'', party_label:'Seller',
    };
    const buyerAff = {
      for_type:'PURCHASER', dep_name:d.buyer_name, dep_father:d.buyer_father||'',
      dep_addr:d.buyer_addr||'', dep_town:d.buyer_town||'', dep_dist:d.buyer_dist||'',
      veh_type:d.vehicle_type||'Motor Vehicle', reg_no:d.reg_no,
      action_text:'That I have purchased my', to_from:'from',
      other_name:d.seller_name, other_father:d.seller_father||'',
      other_addr:d.seller_addr||'', other_town:d.seller_town||'', other_dist:d.seller_dist||'',
      extra_clauses:`<div style="margin-top:8px">That I will be responsible any dues of taxes of the said vehicle</div>
        <div style="margin-top:8px;padding-left:20px">That kindly the ownership of the said vehicle is transferred in my name that the above seller</div>`,
      adv_at:d.advocate_at||'', sign_place:d.sign_place||'', party_label:'Purchaser',
    };

    const html29  = fillTemplate('form29.html', fd);
    const html30  = fillTemplate('form30.html', fd);
    const htmlAS  = fillTemplate('affidavit.html', sellerAff);
    const htmlAB  = fillTemplate('affidavit.html', buyerAff);

    console.log('Generating PDF for', d.reg_no);
    const pdf = await htmlToPdf([html29, html30, htmlAS, htmlAB]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RTO_${d.reg_no}.pdf"`);
    res.send(pdf);
    console.log('Done:', d.reg_no);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status:'ok', time:new Date() }));

app.listen(PORT, () => console.log(`RTO Forms running on port ${PORT}`));
