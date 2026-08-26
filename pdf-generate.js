/* ════════ PDF GENERATION (jsPDF) ════════
   Pure drawing functions: given a jsPDF document instance (doc, already
   created) and a plain data object (d, field-id -> value), draw one form's
   layout onto it. No dependency on FIELDS/PICKS/VALS or any DOM/app state —
   generatePDF() in ui.js is the only caller, and it builds d itself. This
   file must load before forms-data.js: PICKS references these function
   names directly (e.g. gen:addForm29), so they must already exist as
   globals by the time that array literal is evaluated. */

function fmtDate(d){
  if(!d) return '_______________';
  const dt=new Date(d);
  const m=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const n=dt.getDate();
  const s=n===1?'st':n===2?'nd':n===3?'rd':'th';
  return n+s+' day of '+m[dt.getMonth()]+', '+dt.getFullYear();
}

/* ── Page overflow helper (auto-paginate) ── */
const PAGE_BOTTOM=278;
const PAGE_TOP=18;
function newPageIfNeeded(doc,y,need){
  if(y+(need||12)>PAGE_BOTTOM){doc.addPage();return PAGE_TOP;}
  return y;
}

function dline(doc,x1,y,x2){
  doc.setLineDashPattern([0.5,1],0);
  doc.setLineWidth(0.3);
  doc.line(x1,y,x2,y);
  doc.setLineDashPattern([],0);
}
function bold(doc,x,y,t,sz){doc.setFont('helvetica','bold');doc.setFontSize(sz||11);doc.text(String(t),x,y);doc.setFont('helvetica','normal');}
function normal(doc,x,y,t,sz){doc.setFont('helvetica','normal');doc.setFontSize(sz||11);doc.text(String(t),x,y);}
function center(doc,y,t,sz,b){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz||11);doc.text(String(t),105,y,{align:'center'});doc.setFont('helvetica','normal');}
function wrap(doc,x,y,t,w,sz){
  doc.setFont('helvetica','normal');doc.setFontSize(sz||10);
  const lh=(sz||10)*0.45;
  const L=doc.splitTextToSize(String(t),w||178);
  L.forEach(line=>{y=newPageIfNeeded(doc,y,lh+2);doc.text(line,x,y);y+=lh;});
  return y;
}
/* ── Smart value fit: try 11→8pt on one line; if still too wide, use 2 lines (font stays ≥8) ── */
const MIN_FIT_SIZE = 8;
function drawFit(doc, val, x, y, maxWidth, baseSize){
  const text = String(val==null?'':val);
  if(!text) return {lines:1};
  baseSize = baseSize||11;
  doc.setFont('helvetica','bold');
  /* 1) try shrinking font down to MIN_FIT_SIZE on a single line */
  let size = baseSize;
  while(size > MIN_FIT_SIZE){
    doc.setFontSize(size);
    if(doc.getTextWidth(text) <= maxWidth) break;
    size -= 0.5;
  }
  doc.setFontSize(size);
  if(doc.getTextWidth(text) <= maxWidth){
    doc.text(text, x, y);
    doc.setFont('helvetica','normal');
    return {lines:1};
  }
  /* 2) still too wide at 8pt → wrap into max 2 lines at MIN_FIT_SIZE */
  doc.setFontSize(MIN_FIT_SIZE);
  const parts = doc.splitTextToSize(text, maxWidth);
  const line1 = parts[0] || '';
  let line2 = parts.slice(1).join(' ');
  /* ensure line2 also fits; if not, trim with ellipsis */
  if(doc.getTextWidth(line2) > maxWidth){
    while(line2.length > 1 && doc.getTextWidth(line2 + '…') > maxWidth){
      line2 = line2.slice(0, -1);
    }
    line2 = line2.trimEnd() + '…';
  }
  doc.text(line1, x, y);
  doc.text(line2, x, y + 3.6);
  doc.setFont('helvetica','normal');
  return {lines:2};
}

function lrow(doc,y,label,val,sz){
  const fsz=sz||11;
  doc.setFont('helvetica','normal');doc.setFontSize(fsz);
  doc.text(label,15,y);
  const lx=15+doc.getTextWidth(label)+1;
  const maxW=Math.max(193-lx-4,40);
  dline(doc,lx,y+0.5,193);
  drawFit(doc,val,lx+2,y,maxW,fsz);
  return y+7;
}
function secline(doc,y,title){
  doc.setLineWidth(0.5);doc.line(15,y,195,y);
  center(doc,y+6,title,11.5,true);
  return y+11;
}

/* ── FORM 29 ── */
function addForm29(doc,d){
  let y=hHead(doc,'FORM 29','[ Refer Rule 55(1) ]',['NOTICE OF TRANSFER OF OWNERSHIP OF A MOTOR VEHICLE']);
  y=hWrap(doc,15,y+1,'( To be made in duplicate and the duplicate copy with the endorsement of the registering authority to be returned to the transferor immediately on making entries of transfer of ownership in certificate of registration and Form 24. )',180,8.5);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=9;
  hT(doc,15,y,'To,',11); y+=6;
  y=hRow(doc,y,'The Registering Authority :  ',d.rto,6.5);
  hT(doc,22,y,'( in whose jurisdiction the transferee resides )',8.5); y+=9;

  y=hRow(doc,y,'I / We :  ',d.s_name,8.5);
  y=hRow(doc,y,'resident of :  ',d.s_addr+(d.s_town?', '+d.s_town:'')+(d.s_dist?', '+d.s_dist:''),8.5);
  hT(doc,15,y,'have on the ',11);
  let x=15+hTW(doc,'have on the ',11)+1;
  dline(doc,x,y+0.6,115);
  if(d.sale_date){doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(fmtDate(d.sale_date),x+2,y);}
  hT(doc,119,y,'( day of the year )',8.5); y+=8.5;
  y=hPair(doc,y,'sold and delivered my / our vehicle No. :  ',d.reg_no,'Make :  ',d.make,8.5);
  y=hPair(doc,y,'Chassis No. :  ',d.ch_no,'Engine No. / Motor No. ( BOV ) :  ',d.eng_no,8.5);
  y=hRow(doc,y,'to Shri / Smt. ( Name ) :  ',d.b_name,8.5);
  y=hRow(doc,y,'Son / wife / daughter of :  ',d.b_father,8.5);
  y=hRow(doc,y,'residing at ( house No. / street, village / town, distt. and State ) :  ',d.b_addr+(d.b_town?', '+d.b_town:'')+(d.b_dist?', '+d.b_dist:'')+(d.state?', '+d.state:''),8.5);
  y=hRow(doc,y,'under an agreement of hire / purchase / lease / hypothecation with :  ','',9);
  y=hWrap(doc,15,y,'The registration certificate and insurance certificate have been handed over to him / her / them.',180,10.5); y+=1;
  y=hWrap(doc,15,y,'To the best of my / our knowledge and belief the vehicle is not superdari and free from all encumbrances and the information furnished is true. I / We undertake to hold my / our self responsible for any inaccuracy or suppression of information.',180,10.5); y+=3;

  hT(doc,15,y,'Signature of the financier',10.5); y+=5;
  hT(doc,15,y,'( to give his consent )',9); y+=9;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,112,y,'Signature / digital signature / e-signature of owner of',9.5); y+=4.5;
  hT(doc,112,y,'motor vehicle or authorised dealer of registered vehicle',9.5); y+=10;
  hT(doc,130,y,'Date : ____________________',11); y+=8;
  hT(doc,15,y,'I / We ',11);
  x=15+hTW(doc,'I / We ',11)+1;
  dline(doc,x,y+0.6,150);
  hT(doc,154,y,'( Transferee )',10.5); y+=8.5;
  y=hWrap(doc,15,y,'Copy to the registering authority .................... in whose jurisdiction the transferor resides.',180,10.5); y+=1;
  hT(doc,15,y,'Note :',10,true);
  hT(doc,30,y,'To be sent to the registering authority by registered post acknowledgment due.',10); y+=10;

  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=8;
  hTC(doc,y,'OFFICE  ENDORSEMENT',13,true); y+=11;
  y=hPair(doc,y,'Ref. No. :  ','','Office of the :  ',d.rto,9.5);
  y=hWrap(doc,15,y,'The ownership of the vehicle has been transferred to the name of ........................................ with the note of the above said agreement with effect from .................... ( date ).',180,10.5); y+=3;
  y=hRow(doc,y,'Date :  ','',9);
  hT(doc,112,y,'Signature of the registering authority with office seal',9.5); y+=8;
  hT(doc,15,y,'*  Strike out whichever is inapplicable.',9); y+=9;
  hT(doc,15,y,'To,',11); y+=6.5;
  y=hRow(doc,y,'The transferor :  ','',6.5);
  hT(doc,22,y,'( to be sent by Regd. post acknowledgement due )',8.5);
}

function lrowPair(doc,y,l1,v1,l2,v2){
  doc.setFont('helvetica','normal');doc.setFontSize(11);
  doc.text(l1,15,y);
  let x1=15+doc.getTextWidth(l1)+1;
  dline(doc,x1,y+0.5,100);
  drawFit(doc,v1,x1+2,y,Math.max(100-x1-2,22),11);
  doc.setFont('helvetica','normal');doc.setFontSize(11);
  doc.text(l2,105,y);
  let x2=105+doc.getTextWidth(l2)+1;
  dline(doc,x2,y+0.5,193);
  drawFit(doc,v2,x2+2,y,Math.max(193-x2-2,22),11);
  return y+7;
}

/* ── FORM 30 ── */
function addForm30(doc,d){
  let y=hHead(doc,'FORM 30','[ Refer Rule 55(2) and (3) ]',['APPLICATION FOR INTIMATION AND TRANSFER OF','OWNERSHIP OF MOTOR VEHICLE']);
  y=hWrap(doc,15,y+1,'( To be made in duplicate if the vehicle is held under an agreement of hire-purchase / lease / hypothecation. The duplicate copy with the endorsement of the registering authority to be returned to the financier simultaneously on making the entry of the transfer of ownership in the certificate of registration and registration record in Form 24. )',180,8);
  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=6.5;
  hT(doc,15,y,'To,   The Registering Authority :',11);
  let x=15+hTW(doc,'To,   The Registering Authority :',11)+2;
  dline(doc,x,y+0.6,193);
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.rto||'',x+2,y); y+=8;

  hTC(doc,y,'PART I \u2014 FOR THE USE OF THE TRANSFEROR',11,true); y+=8;
  y=hPair(doc,y,'Name of the transferor :  ',d.s_name,'son / wife / daughter of :  ',d.s_father,8);
  y=hRow(doc,y,'Full address :  ',d.s_addr+(d.s_town?', '+d.s_town:'')+(d.s_dist?', Dist. '+d.s_dist:''),8);
  hT(doc,15,y,'I / We hereby declare that I / We have on this ',10.5);
  x=15+hTW(doc,'I / We hereby declare that I / We have on this ',10.5)+1;
  dline(doc,x,y+0.6,165);
  if(d.sale_date){doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(fmtDate(d.sale_date),x+2,y);}
  hT(doc,168,y,'( day, year )',8); y+=8;
  y=hRow(doc,y,'sold my / our motor vehicle bearing registration mark :  ',d.reg_no,8);
  y=hPair(doc,y,'to Sh. / Smt. :  ',d.b_name,'son / wife / daughter of :  ',d.b_father,8);
  y=hRow(doc,y,'residing at ( full address ) :  ',d.b_addr+(d.b_town?', '+d.b_town:'')+(d.b_dist?', '+d.b_dist:''),8);
  y=hWrap(doc,15,y,'and handed over the certificate of registration and the certificate of insurance to him / her / them.',180,10); y+=1;
  y=hWrap(doc,15,y,'I / We hereby declare that to the best of my / our knowledge the certificate of registration of the vehicle has not been suspended* or cancelled.',180,10); y+=1;
  y=hWrap(doc,15,y,'*  I / We enclose the \u201CNo Objection Certificate\u201D issued by the registering authority.',180,10);
  y=hWrap(doc,15,y,'**  If the \u201CNo Objection Certificate\u201D from the registering authority is not enclosed, the transferor should file along with this application a declaration as required under sub-section (1) of section 50.',180,10); y+=8;
  hT(doc,15,y,'Date : ________________',10.5);
  hT(doc,108,y,'Signature / digital signature / e-signature of owner of',9); y+=4.5;
  hT(doc,108,y,'motor vehicle or authorised dealer of registered vehicle',9); y+=6;
  hT(doc,15,y,'*  Details of suspension or cancellation.    **  Strike out whichever is inapplicable.',8.5); y+=8;

  hTC(doc,y,'PART II \u2014 FOR THE USE OF TRANSFEREE',11,true); y+=8;
  y=hPair(doc,y,'Name of the transferee :  ',d.b_name,'son / wife / daughter of :  ',d.b_father,8);
  y=hPair(doc,y,'Age :  ','','Mobile number :  ',d.b_mobile,8);
  y=hRow(doc,y,'Full address ( proof of address to be enclosed ) :  ',d.b_addr+(d.b_town?', '+d.b_town:'')+(d.b_dist?', '+d.b_dist:''),8);
  y=hRow(doc,y,'I / We hereby declare ............................ as the nominee for this vehicle, who is my / our :  ','',8);
  hT(doc,15,y,'I / We hereby declare that I / We have on this ',10.5);
  x=15+hTW(doc,'I / We hereby declare that I / We have on this ',10.5)+1;
  dline(doc,x,y+0.6,165);
  if(d.sale_date){doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(fmtDate(d.sale_date),x+2,y);}
  hT(doc,168,y,'( day, year )',8); y+=8;
  y=hRow(doc,y,'purchased the motor vehicle bearing registration No. :  ',d.reg_no,8);
  y=hRow(doc,y,'from ( seller ) :  ',d.s_name,8);
  y=hRow(doc,y,'( name and full address ) :  ',d.s_addr+(d.s_town?', '+d.s_town:'')+(d.s_dist?', '+d.s_dist:''),8);
  y=hWrap(doc,15,y,'and request that necessary entries regarding the transfer of ownership of the vehicle in my / our name may be recorded in the certificate of registration / certificate of fitness of the vehicle, which is enclosed.',180,10); y+=1;
  y=hWrap(doc,15,y,'The certificate of insurance is also enclosed. To the best of my knowledge and belief I / we have not suppressed any facts and information furnished is true. The vehicle is not superdari and free from all encumbrances. I / we undertake to hold myself responsible for any inaccuracy.',180,10); y+=2;
  hT(doc,15,y,'Date : ________________',10.5);
  hT(doc,116,y,'Signature or thumb impression of the transferee',9.5);

  /* PAGE 2 — financier consent + office endorsement + specimen */
  doc.addPage(); let z=18;
  hTC(doc,z,'CONSENT OF THE FINANCIER IN THE CASE OF MOTOR VEHICLE SUBJECT',11,true); z+=6;
  hTC(doc,z,'TO AN AGREEMENT OF HIRE-PURCHASE / LEASE / HYPOTHECATION',11,true); z+=10;
  z=hWrap(doc,15,z,'I / We, being a party to an agreement of hire-purchase / lease / hypothecation in respect of the motor vehicle specified above, give consent to the transfer of ownership of the said motor vehicle in the name of the transferee named above, with whom I / we have entered into an agreement of hire-purchase / lease / hypothecation.',180,10.5); z+=4;
  z=hRow(doc,z,'( Full name and address of the financier ) :  ','',12);
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,118,z,'Signature of the financier',10.5); z+=7;
  hT(doc,118,z,'Date : ____________________',11); z+=14;

  doc.setLineWidth(0.4);doc.line(15,z,195,z); z+=8;
  hTC(doc,z,'OFFICE  ENDORSEMENT',13,true); z+=11;
  z=hPair(doc,z,'Ref. No. :  ','','Office of the :  ',d.rto,9.5);
  z=hWrap(doc,15,z,'The transfer of ownership of vehicle under continuation of an endorsement of hire-purchase / lease / hypothecation agreement has been recorded with effect from .................... in the registration certificate of the vehicle .................... and in the registration record of this office in Form 24.',180,10.5); z+=4;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,118,z,'Signature of the registering authority',10.5); z+=12;
  hT(doc,15,z,'To,',11); z+=7;
  z=hRow(doc,z,'The owner of motor vehicle / authorised dealer of registered vehicle :  ','',9);
  z=hRow(doc,z,'The Financier :  ','',9);
  hT(doc,15,z,'( To be sent to both the above parties by registered post acknowledgement due )',9); z+=11;
  z=hWrap(doc,15,z,'Specimen signature or thumb impression of the registered owner and the financier are to be obtained in the original application for affixing and attestation by the registering authority with the office seal in Forms 23 and 24, in such manner that the parts of impression of seal or stamp and attestation shall fall upon each signature.',180,9.5); z+=8;
  hT(doc,15,z,'Specimen signatures of financier',10.5,true);
  hT(doc,112,z,'Specimen signatures of registered owner',10.5,true); z+=11;
  hT(doc,15,z,'1.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'1.',11); dline(doc,122,z+0.6,193); z+=12;
  hT(doc,15,z,'2.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'2.',11); dline(doc,122,z+0.6,193);
}

/* ── AFFIDAVIT ── */
function addAffidavit(doc,d,forType){
  const isS=forType==='SELLER';
  doc.setLineWidth(0.5);
  doc.rect(78,12,54,19);
  center(doc,19,'Affix here Court Fee',8);
  center(doc,25,'Stamp Rs. 5 Only',8);
  center(doc,44,'AFFIDAVIT',19,true);
  center(doc,52,'(FOR '+forType+')',12);
  doc.setLineWidth(0.3);doc.line(15,56,195,56);

  const dn=isS?d.s_name:d.b_name, df=isS?d.s_father:d.b_father;
  const da=isS?d.s_addr:d.b_addr, dt2=isS?d.s_town:d.b_town, dd=isS?d.s_dist:d.b_dist;
  const on=isS?d.b_name:d.s_name, of=isS?d.b_father:d.s_father;
  const oa=isS?d.b_addr:d.s_addr, ot=isS?d.b_town:d.s_town, od=isS?d.b_dist:d.s_dist;

  let y=67;
  normal(doc,15,y,'I, ');
  let x=15+doc.getTextWidth('I, ');
  dline(doc,x,y+0.5,108); bold(doc,x+2,y,dn);
  normal(doc,110,y,' S/o ');
  x=110+doc.getTextWidth(' S/o ');
  dline(doc,x,y+0.5,193); bold(doc,x+2,y,df); y+=8;
  y=lrow(doc,y,'resident of:  ',da);
  y=lrowPair(doc,y,'Town:  ',dt2,'District:  ',dd);
  normal(doc,15,y,'do hereby solemnly affirm and declare as follows :-'); y+=10;

  if(isS){
    normal(doc,25,y,'1.  That I sold my ');
    x=25+doc.getTextWidth('1.  That I sold my ');
    dline(doc,x,y+0.5,140); bold(doc,x+2,y,d.veh_type||'Motor Vehicle');
    normal(doc,142,y,' bearing'); y+=8;
  } else {
    normal(doc,25,y,'1.  That I have purchased my ');
    x=25+doc.getTextWidth('1.  That I have purchased my ');
    dline(doc,x,y+0.5,150); bold(doc,x+2,y,d.veh_type||'Motor Vehicle');
    normal(doc,152,y,' bearing'); y+=8;
  }
  normal(doc,25,y,'Regd. No. ');
  x=25+doc.getTextWidth('Regd. No. ');
  dline(doc,x,y+0.5,98); bold(doc,x+2,y,d.reg_no);
  normal(doc,100,y,isS?' to Mr./Ms. ':' from Mr./Ms. ');
  x=100+doc.getTextWidth(isS?' to Mr./Ms. ':' from Mr./Ms. ');
  dline(doc,x,y+0.5,193); bold(doc,x+2,y,on); y+=8;
  normal(doc,25,y,'S/o ');
  x=25+doc.getTextWidth('S/o ');
  dline(doc,x,y+0.5,105); bold(doc,x+2,y,of);
  normal(doc,107,y,' resident of ');
  x=107+doc.getTextWidth(' resident of ');
  dline(doc,x,y+0.5,193); bold(doc,x+2,y,oa); y+=8;
  normal(doc,25,y,'Town ');
  x=25+doc.getTextWidth('Town ');
  dline(doc,x,y+0.5,100); bold(doc,x+2,y,ot);
  normal(doc,102,y,' District ');
  x=102+doc.getTextWidth(' District ');
  dline(doc,x,y+0.5,193); bold(doc,x+2,y,od); y+=11;

  normal(doc,25,y,'2.  That the said vehicle is not involved in any civil or criminal case.'); y+=9;

  if(isS){
    y=wrap(doc,25,y,'3.  That I have got no objection if the ownership of the said vehicle is transferred in the name of the above purchaser.',168,11);
  } else {
    normal(doc,25,y,'3.  That I will be responsible for any dues or taxes of the said vehicle.'); y+=9;
    y=wrap(doc,25,y,'4.  That the ownership of the said vehicle may kindly be transferred in my name; the above seller has no objection.',168,11);
  }

  /* Signature block: was cramming ~9-13mm of blank "sign here" space between each
     role caption and the next line, and printing "NOTARY PUBLIC" with no reserved
     space below it at all — content ended at y=268 on an A4 page (297mm), leaving
     ~29mm of unused space at the bottom instead of giving anyone room to actually
     sign or stamp. Now: every signature gets >=18mm, the notary's (round seals run
     30-40mm) gets ~32mm, and the block still ends within a 15mm bottom margin
     (297-15=282mm) — safe because everything below this point is fixed captions,
     not data-driven text, so the final height doesn't vary with input. */
  let ly=204;
  normal(doc,15,ly,'Solemnly affirmed and declared'); ly+=6;
  normal(doc,15,ly,'before me to be true by the deponent'); ly+=6;
  normal(doc,15,ly,'who is identified by'); ly+=9;
  normal(doc,15,ly,'Sri '); dline(doc,23,ly+0.5,88); ly+=9;
  normal(doc,15,ly,'Advocate at ');
  let ax=15+doc.getTextWidth('Advocate at ');
  dline(doc,ax,ly+0.5,88); bold(doc,ax+2,ly,d.adv_at); ly+=32; // seal + notary signature space
  bold(doc,15,ly,'NOTARY PUBLIC',11.5);

  let ry=204;
  bold(doc,118,ry,'Verification',11.5); ry+=7;
  normal(doc,118,ry,'The statements made above are true to'); ry+=5;
  normal(doc,118,ry,'the best of my knowledge, belief and'); ry+=5;
  normal(doc,118,ry,'information, and I sign this affidavit'); ry+=5;
  normal(doc,118,ry,'at ');
  let vx=118+doc.getTextWidth('at ');
  dline(doc,vx,ry+0.5,160); bold(doc,vx+2,ry,d.adv_at);
  normal(doc,162,ry,' on 20____'); ry+=9;
  bold(doc,118,ry,isS?'SELLER':'PURCHASER',11.5); ry+=18; // deponent signature space
  bold(doc,118,ry,'Deponent',10.5); ry+=6;
  normal(doc,118,ry,'The deponent is known to me and has'); ry+=5;
  normal(doc,118,ry,'signed in my presence.'); ry+=18; // advocate signature space
  bold(doc,118,ry,'Advocate.',11);
}

/* ── FORM 28 — NOC (official: Rules 54, 58 — 3 Parts) ── */
function addForm28(doc,d){
  let y=hHead(doc,'FORM 28','[ Refer Rules 54, 58(1), (3) and (4) ]',['APPLICATION FOR AND GRANT OF NO OBJECTION CERTIFICATE']);
  y=hWrap(doc,15,y+1,'( To be made in quadruplicate if the vehicle is held under an agreement of hire-purchase / lease / hypothecation; the duplicate, triplicate and quadruplicate copies with the endorsement of the registering authority to be returned to the registered owner, the registering authority in whose jurisdiction the vehicle is to be removed, and the financier simultaneously on grant / refusal of NOC. )',180,8);
  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=7;
  hTC(doc,y,'PART I  \u2014  APPLICATION',11.5,true); y+=9;
  hT(doc,15,y,'To,   The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,9);
  y=hWrap(doc,15,y,'I / We intend to transfer the vehicle to the jurisdiction of the registering authority :',180,10.5);
  dline(doc,15,y+0.6,193);
  if(d.dest_rto){doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.dest_rto+(d.dest_state?', '+d.dest_state:''),17,y);}
  y+=8;
  hT(doc,15,y,'I / We intend to sell the vehicle to Shri / Smt. / Kumari : ',10.5);
  let x=15+hTW(doc,'I / We intend to sell the vehicle to Shri / Smt. / Kumari : ',10.5)+1;
  dline(doc,x,y+0.6,193);
  if(d.b_name){doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(d.b_name,x+2,y);}
  y+=8;
  y=hWrap(doc,15,y,'who resides in the jurisdiction of the registering authority .................................... of the State .................... . I / We, therefore, request the issue of a \u201CNo Objection Certificate\u201D for my / our vehicle, the particulars of which are furnished below :\u2014',180,10);
  y+=2;
  y=hRow(doc,y,'1.    Name and address :  ',d.s_name+', '+d.s_addr+(d.s_town?', '+d.s_town:''),8.5);
  y=hRow(doc,y,'2.    Son / wife / daughter of :  ',d.s_father,8.5);
  y=hRow(doc,y,'2a.  Mobile number of the owner :  ',d.mobile,8.5);
  y=hPair(doc,y,'3.    Registration number :  ',d.reg_no,'4.  Class of vehicle :  ',d.veh_type,8.5);
  y=hRow(doc,y,'5.    Registering authority which originally registered the vehicle :  ','',8.5);
  y=hPair(doc,y,'6.    Engine No. / Motor No. ( BOV ) :  ',d.eng_no,'7.  Chassis No. ( pencil print ) :  ',d.ch_no,8.5);
  y=hPair(doc,y,'8.    Period of stay in the State :  ','','9.  Tax paid up to :  ','',8.5);
  y=hRow(doc,y,'10.  Whether any demand for tax is pending — if so, details :  ','',8.5);
  y=hRow(doc,y,'11.  Whether the vehicle is involved in any theft case — if so, details :  ','',8.5);
  y=hWrap(doc,15,y,'12.  Whether any action under sections 53, 54 or 58 of the Motor Vehicles Act, 1988 is pending before any registering authority or other prescribed authority — if so, details :',180,10);
  dline(doc,22,y+0.6,193); y+=8;
  y=hRow(doc,y,'13.  Whether involved in any case of transport of prohibited goods — details :  ','',8.5);
  y=hRow(doc,y,'14.  Whether held under HP / lease / hypothecation — financier name & address :  ','',9);
  hT(doc,15,y,'We solemnly declare that the above statement is true.',11,true); y+=11;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,112,y,'Signature / digital signature / e-signature of owner',9.5); y+=5;
  hT(doc,112,y,'of motor vehicle or authorised dealer',9.5);

  /* PAGE 2 — Parts II & III */
  doc.addPage(); let z=18;
  hTC(doc,z,'PART II \u2014 CONSENT OF THE FINANCIERS IN THE CASE OF MOTOR',11,true); z+=6;
  hTC(doc,z,'VEHICLE SUBJECT TO AN AGREEMENT',11,true); z+=10;
  z=hWrap(doc,15,z,'I / We, being a party to an agreement of hire-purchase / lease / hypothecation in respect of the above said vehicle, hereby :',180,10.5); z+=2;
  z=hWrap(doc,22,z,'1.  Give consent to issue the \u201CNo Objection Certificate\u201D for the said vehicle only for the purpose referred above.',172,10.5); z+=1;
  z=hWrap(doc,22,z,'2.  Refuse to give consent for issue of \u201CNo Objection Certificate\u201D for the said vehicle due to the reasons furnished hereunder :',172,10.5); z+=1;
  dline(doc,22,z+0.6,193); z+=12;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,130,z,'Signature of the financier',10.5); z+=14;

  doc.setLineWidth(0.4);doc.line(15,z,195,z); z+=8;
  hTC(doc,z,'PART III \u2014 OFFICE ENDORSEMENT',12,true); z+=6;
  hTC(doc,z,'Grant / refusal of \u201CNo Objection Certificate\u201D under section 48(3) of',9.5); z+=5;
  hTC(doc,z,'Motor Vehicles Act, 1988',9.5); z+=9;
  z=hWrap(doc,22,z,'(1)  No Objection Certificate in respect of the vehicle, the detailed particulars whereof are recorded over above, is hereby granted under section 48(3) of the Act ( valid for use at the registering authority on whom it is issued ).',172,10.5); z+=2;
  z=hWrap(doc,22,z,'(2)  No Objection Certificate in respect of the motor vehicle, the detailed particulars whereof recorded over above, is hereby refused under section 48(3) of the Motor Vehicles Act, 1988, for the reasons recorded as under :',172,10.5); z+=1;
  dline(doc,22,z+0.6,193); z+=12;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,112,z,'Signature with seal of registering authority',10.5); z+=8;
  z=hRow(doc,z,'Address :  ','',10);
  hT(doc,15,z,'*  Strike out whichever is inapplicable.',9); z+=10;
  hT(doc,15,z,'To,',11); z+=7;
  z=hRow(doc,z,'The owner of motor vehicle / authorised dealer :  ','',9);
  z=hRow(doc,z,'The Financier :  ','',9);
  z=hRow(doc,z,'The Registering Authority :  ','',9);
  hT(doc,15,z,'( To be sent to the parties by Regd. post acknowledgement due )',9);
}

/* ── FORM 25 — RC RENEWAL (full official content, 2 pages) ── */
function addForm25(doc,d){
  /* ══ FORM 25 — Official format per Rule 52(1), 2 pages ══ */
  const reg_as=(d.reg_as||'').toLowerCase();
  const isNew=reg_as.includes('new')?'Yes':'';
  const isArmy=reg_as.includes('army')?'Yes':'';
  const isImport=reg_as.includes('import')?'Yes':'';

  /* ---- PAGE 1 ---- */
  center(doc,16,'FORM 25',14,true);
  center(doc,22,'[ Refer Rule 52(1) ]',9.5);
  center(doc,29,'FORM OF APPLICATION FOR RENEWAL OF CERTIFICATE OF',10.5,true);
  center(doc,34,'REGISTRATION OF A MOTOR VEHICLE',10.5,true);
  doc.setLineWidth(0.35);doc.line(15,37,195,37);

  let y=44;
  normal(doc,15,y,'To'); y+=5.5;
  normal(doc,15,y,'The Registering Authority,'); y+=6.5;
  dline(doc,15,y+0.5,193); if(d.rto){bold(doc,17,y,d.rto);} y+=9;

  /* Intro line: I, ___ having mobile ___ */
  normal(doc,15,y,'I,');
  let x=15+doc.getTextWidth('I,')+2;
  dline(doc,x,y+0.5,110); if(d.s_name){drawFit(doc,d.s_name,x+2,y,93,11);}
  normal(doc,114,y,'having mobile number');
  x=114+doc.getTextWidth('having mobile number')+2;
  dline(doc,x,y+0.5,193); if(d.mobile){bold(doc,x+2,y,d.mobile);}
  y+=6.5;
  y=wrap(doc,15,y,'hereby apply for the renewal of the certificate of registration which is attached, the particulars of which are as follows :\u2014',180,10);
  y+=2.5;

  /* (a)-(d) */
  normal(doc,15,y,'(a)  Register No.');
  x=15+doc.getTextWidth('(a)  Register No.')+2;
  dline(doc,x,y+0.5,120); if(d.reg_no){bold(doc,x+2,y,d.reg_no);} y+=7;

  normal(doc,15,y,'(b)  Date of issue');
  x=15+doc.getTextWidth('(b)  Date of issue')+2;
  dline(doc,x,y+0.5,120); if(d.date_issue){bold(doc,x+2,y,fmtDate(d.date_issue));} y+=7;

  normal(doc,15,y,'(c)  Date of expiry');
  x=15+doc.getTextWidth('(c)  Date of expiry')+2;
  dline(doc,x,y+0.5,120); if(d.date_expiry){bold(doc,x+2,y,fmtDate(d.date_expiry));} y+=7;

  normal(doc,15,y,'(d)  Registering authority by which the certificate');y+=5.5;
  normal(doc,22,y,'was issued / last renewed');
  x=22+doc.getTextWidth('was issued / last renewed')+2;
  dline(doc,x,y+0.5,193); if(d.rto){drawFit(doc,d.rto,x+2,y,Math.max(193-x-4,40),11);} y+=8;

  /* present address declaration */
  const addrFull=(d.s_addr||'')+(d.s_town?', '+d.s_town:'')+(d.s_dist?', '+d.s_dist:'');
  y=wrap(doc,15,y,'My present address is '+(addrFull||'..............................')+'. If this address is not entered in the certificate of registration, I do / do not wish that it should be so entered. The renewal of the certificate has not been refused by any registering authority.',180,10);
  y+=2;
  y=wrap(doc,15,y,'I hereby declare that the certificate of registration has not been cancelled or suspended by any registering authority.',180,10);
  y+=3.5;

  /* Numbered fields 1-13 (compact, no page break) */
  const f25row=(num,label,val)=>{
    normal(doc,15,y,num+'.  '+label);
    const lx=15+doc.getTextWidth(num+'.  '+label)+2;
    dline(doc,lx,y+0.5,193);
    if(val){drawFit(doc,val,lx+2,y,Math.max(193-lx-4,30),11);}
    y+=6.8;
  };

  f25row('1','Class of vehicle',d.veh_type);

  /* 2. registered as (a)(b)(c) */
  normal(doc,15,y,'2.  The motor vehicle was registered as'); y+=6;
  normal(doc,22,y,'(a)  a new vehicle');
  x=22+doc.getTextWidth('(a)  a new vehicle')+2;
  dline(doc,x,y+0.5,120); if(isNew){bold(doc,x+2,y,isNew);} y+=6;
  normal(doc,22,y,'(b)  ex army vehicle');
  x=22+doc.getTextWidth('(b)  ex army vehicle')+2;
  dline(doc,x,y+0.5,120); if(isArmy){bold(doc,x+2,y,isArmy);} y+=6;
  normal(doc,22,y,'(c)  imported vehicle');
  x=22+doc.getTextWidth('(c)  imported vehicle')+2;
  dline(doc,x,y+0.5,120); if(isImport){bold(doc,x+2,y,isImport);} y+=6.8;

  f25row('3','Type of body',d.body_type);
  f25row('4',"Maker's name",d.make);
  f25row('5','Month and year of manufacture',d.model);
  f25row('6','Number of cylinders',d.cylinders);
  f25row('7','Cubic capacity / horse power',d.cubic_cap);
  f25row('8',"Maker's classification",d.maker_class);
  f25row('9','Chassis No. (Affix pencil print)',d.ch_no);
  f25row('10','Engine No. or motor number (in case of BOV)',d.eng_no);
  f25row('11','Seating capacity (including driver)',d.seating);
  f25row('11A','Standing capacity',d.standing);
  f25row('11B','Sleeper capacity',d.sleeper);
  f25row('12','Unladen weight',d.unladen);
  f25row('13','Fuel used',d.fuel);
  y+=2;

  normal(doc,15,y,'I enclose the certificate of insurance for perusal and return.'); y+=6;
  normal(doc,15,y,'I have paid the fee of Rs. ____________________'); y+=10;

  normal(doc,15,y,'Date : ___________________');
  normal(doc,108,y,'Signature or thumb impression of the applicant');

  /* ---- PAGE 2 ---- */
  doc.addPage(); y=20;
  normal(doc,15,y,'Note :  The motor vehicle above described is not subject to an agreement of'); y+=6;
  normal(doc,30,y,'hire-purchase, lease or hypothecation.'); y+=9;
  normal(doc,15,y,'The vehicle is :'); y+=8;

  normal(doc,15,y,'*(i)');
  x=15+doc.getTextWidth('*(i)')+2;
  dline(doc,x,y+0.5,80);
  normal(doc,84,y,'Subject to hire-purchase agreement / lease agreement with'); y+=9;
  normal(doc,15,y,'*(ii)');
  x=15+doc.getTextWidth('*(ii)')+2;
  dline(doc,x,y+0.5,80);
  normal(doc,84,y,'Subject to hypothecation in favour of'); y+=9;
  normal(doc,15,y,'* Strike out whichever is inapplicable',9.5); y+=13;

  normal(doc,110,y,'Signature or thumb impression of the'); y+=5;
  normal(doc,120,y,'registered owner'); y+=14;

  bold(doc,15,y,'Specimen signature or thumb impression of the registered owner :'); y+=11;
  normal(doc,15,y,'1.'); dline(doc,24,y+0.5,110); y+=12;
  normal(doc,15,y,'2.'); dline(doc,24,y+0.5,110); y+=12;
  normal(doc,15,y,'3.'); dline(doc,24,y+0.5,110); y+=16;

  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=9;
  center(doc,y,'CERTIFICATE',13,true); y+=11;
  y=wrap(doc,15,y,'Inspected the vehicle \u2014 verified the chassis number and engine number.',180,10.5);
  y+=3;
  y=wrap(doc,15,y,'Certified that the particulars contained in the application and the corresponding particulars declared in the certificate of registration of the vehicle are true and that the vehicle complies with the requirements of the Motor Vehicles Act, 1988, and rules made thereunder.',180,10.5);
  y+=14;
  normal(doc,112,y,'Signature of the inspecting authority'); y+=10;
  normal(doc,15,y,'Name');
  dline(doc,15+doc.getTextWidth('Name')+3,y+0.5,150); y+=9;
  normal(doc,15,y,'Designation');
  dline(doc,15+doc.getTextWidth('Designation')+3,y+0.5,150);
}

/* ── MOTOR VEHICLE DELIVERY NOTE ── */
function addDeliveryNote(doc,d){
  center(doc,20,'MOTOR VEHICLE DELIVERY NOTE',15,true);
  doc.setLineWidth(0.4);doc.line(52,23,158,23);
  let y=38,x;

  /* Confirm delivery line */
  normal(doc,15,y,'I / We hereby confirm having taken delivery of');
  x=15+doc.getTextWidth('I / We hereby confirm having taken delivery of')+2;
  dline(doc,x,y+0.5,180);
  normal(doc,182,y,'bearing'); y+=8;

  y=lrowPair(doc,y,'Registration No. ',d.reg_no,'Chassis No. ',d.ch_no);
  y=lrowPair(doc,y,'Engine No. ',d.eng_no,'Model ',d.model);
  y+=1;

  /* today the __ day of __ month __ year at __ */
  normal(doc,15,y,'today the');
  x=15+doc.getTextWidth('today the')+2; dline(doc,x,y+0.5,x+22);
  normal(doc,x+25,y,'day of');
  let x2=x+25+doc.getTextWidth('day of')+2; dline(doc,x2,y+0.5,x2+30);
  normal(doc,x2+33,y,'month');
  let x3=x2+33+doc.getTextWidth('month')+2; dline(doc,x3,y+0.5,193); y+=7;
  normal(doc,15,y,'year');
  x=15+doc.getTextWidth('year')+2; dline(doc,x,y+0.5,x+25);
  normal(doc,x+28,y,'at');
  x2=x+28+doc.getTextWidth('at')+2; dline(doc,x2,y+0.5,x2+30);
  normal(doc,x2+34,y,'AM / PM'); y+=7;
  y=wrap(doc,15,y,'along with all tools and papers as seen, inspected and approved by me / us.',180,10.5); y+=4;

  /* From / Through / at */
  normal(doc,20,y,'From :');
  dline(doc,42,y+0.5,193);
  drawFit(doc,(d.s_name?d.s_name+', ':'')+(d.s_addr||''),44,y,147,10.5); y+=7;
  dline(doc,42,y+0.5,193); y+=8;
  normal(doc,20,y,'Through');
  dline(doc,42,y+0.5,193); drawFit(doc,d.del_through,44,y,147,10.5); y+=8;
  normal(doc,20,y,'at');
  dline(doc,42,y+0.5,193); drawFit(doc,d.del_place,44,y,147,10.5); y+=10;

  y=wrap(doc,15,y,'From today onwards I / we would be fully responsible for all sort of damages, claims, accidents, theft, civil or criminal liabilities that may arise in plying the said vehicle.',180,10.5); y+=4;
  normal(doc,15,y,'I / We also confirm having received the following Documents :'); y+=9;

  const item=(n,label,val,end)=>{
    normal(doc,15,y,n+'.');
    normal(doc,22,y,label);
    const lx=22+doc.getTextWidth(label)+2;
    dline(doc,lx,y+0.5,end||193);
    if(val) drawFit(doc,val,lx+2,y,(end||193)-lx-2,10.5);
    y+=8.5;
  };
  item('1','R.C. Book ',d.reg_no?'Yes':'');
  normal(doc,15,y,'2.');normal(doc,22,y,'Tax Token No. ');
  let tx=22+doc.getTextWidth('Tax Token No. ')+2;dline(doc,tx,y+0.5,120);
  normal(doc,124,y,'Valid upto ');let vx=124+doc.getTextWidth('Valid upto ')+2;dline(doc,vx,y+0.5,193);
  if(d.tax_valid)drawFit(doc,d.tax_valid,vx+2,y,193-vx-2,10.5); y+=8.5;
  normal(doc,15,y,'3.');normal(doc,22,y,'Sale letter — i.e., Form No. 29 and 30'); y+=8.5;
  item('4','Insurance cover Note / Certificate / Policy No. ',d.policy_no);
  item('5','Key No. ','');
  normal(doc,15,y,'6.');normal(doc,22,y,'Money Receipt'); y+=8.5;
  normal(doc,15,y,'7.'); y+=11;

  /* Witness + signature */
  const wy=y;
  normal(doc,15,y,'Witness :'); y+=9;
  normal(doc,15,y,'1.');dline(doc,22,y+0.5,95);if(d.wit1_name)drawFit(doc,d.wit1_name,24,y,69,10);y+=10;
  normal(doc,15,y,'2.');dline(doc,22,y+0.5,95);if(d.wit2_name)drawFit(doc,d.wit2_name,24,y,69,10);
  /* right side signature */
  let sy=wy;
  normal(doc,110,sy,'Signature :');dline(doc,135,sy+0.5,193);sy+=10;
  normal(doc,110,sy,'Name :');dline(doc,128,sy+0.5,193);if(d.s_name)drawFit(doc,d.s_name,130,sy,63,10);sy+=10;
  normal(doc,110,sy,'Address :');dline(doc,133,sy+0.5,193);if(d.s_addr)drawFit(doc,d.s_addr,135,sy,58,10);
}

/* ── MOTOR VEHICLE MONEY RECEIPT ── */
function addMoneyReceipt(doc,d){
  center(doc,20,'MOTOR VEHICLE MONEY RECEIPT',15,true);
  doc.setLineWidth(0.4);doc.line(48,23,162,23);
  let y=40,x;

  normal(doc,15,y,'Name of the Seller');
  x=15+doc.getTextWidth('Name of the Seller')+2;dline(doc,x,y+0.5,130);if(d.s_name)drawFit(doc,d.s_name,x+2,y,113-x,10.5);
  normal(doc,134,y,'S/O·W/O·D/O');x=134+doc.getTextWidth('S/O·W/O·D/O')+2;dline(doc,x,y+0.5,193);if(d.s_father)drawFit(doc,d.s_father,x+2,y,193-x-2,10.5);y+=9;

  normal(doc,15,y,'Resident of');x=15+doc.getTextWidth('Resident of')+2;dline(doc,x,y+0.5,193);
  drawFit(doc,(d.s_addr||'')+(d.s_town?', '+d.s_town:'')+(d.s_dist?', '+d.s_dist:''),x+2,y,193-x-2,10.5);y+=12;

  normal(doc,15,y,'That I have received a sum of Rs.');
  x=15+doc.getTextWidth('That I have received a sum of Rs.')+2;dline(doc,x,y+0.5,120);if(d.amount_rs)bold(doc,x+2,y,d.amount_rs);
  normal(doc,124,y,'(Rupees');x=124+doc.getTextWidth('(Rupees')+2;dline(doc,x,y+0.5,193);y+=8;
  dline(doc,15,y+0.5,60);if(d.amount_words)drawFit(doc,d.amount_words,15,y,45,10);
  normal(doc,62,y,'only) By Cash / NEFT / Cheque No.');x=62+doc.getTextWidth('only) By Cash / NEFT / Cheque No.')+2;dline(doc,x,y+0.5,160);if(d.pay_mode)drawFit(doc,d.pay_mode,x+2,y,158-x,10);
  normal(doc,162,y,'Dated');x=162+doc.getTextWidth('Dated')+2;dline(doc,x,y+0.5,193);if(d.pay_date)drawFit(doc,fmtDate(d.pay_date),x+2,y,193-x-2,9);y+=11;

  normal(doc,15,y,'From');x=15+doc.getTextWidth('From')+2;dline(doc,x,y+0.5,130);if(d.b_name)drawFit(doc,d.b_name,x+2,y,113-x,10.5);
  normal(doc,134,y,'S/O·W/O·D/O');x=134+doc.getTextWidth('S/O·W/O·D/O')+2;dline(doc,x,y+0.5,193);if(d.b_father)drawFit(doc,d.b_father,x+2,y,193-x-2,10.5);y+=9;
  dline(doc,15,y+0.5,193);drawFit(doc,(d.b_addr||'')+(d.b_town?', '+d.b_town:'')+(d.b_dist?', '+d.b_dist:''),15,y,178,10);y+=11;

  normal(doc,15,y,'towards the sale price of my vehicle');
  x=15+doc.getTextWidth('towards the sale price of my vehicle')+2;dline(doc,x,y+0.5,160);
  normal(doc,162,y,'bearing');y+=8;
  normal(doc,15,y,'Registration Number');x=15+doc.getTextWidth('Registration Number')+2;dline(doc,x,y+0.5,90);if(d.reg_no)drawFit(doc,d.reg_no,x+2,y,88-x,10);
  normal(doc,92,y,'Engine number');x=92+doc.getTextWidth('Engine number')+2;dline(doc,x,y+0.5,150);if(d.eng_no)drawFit(doc,d.eng_no,x+2,y,148-x,9);y+=8;
  normal(doc,15,y,'Chassis number');x=15+doc.getTextWidth('Chassis number')+2;dline(doc,x,y+0.5,110);if(d.ch_no)drawFit(doc,d.ch_no,x+2,y,108-x,10);y+=8;
  normal(doc,15,y,'Class of vehicle');x=15+doc.getTextWidth('Class of vehicle')+2;dline(doc,x,y+0.5,110);if(d.veh_class||d.veh_type)drawFit(doc,d.veh_class||d.veh_type,x+2,y,108-x,10);
  normal(doc,112,y,'on today at');x=112+doc.getTextWidth('on today at')+2;dline(doc,x,y+0.5,193);y+=11;

  y=wrap(doc,15,y,'That I have signed this Money Receipt on my full sense and sound health and without any pressure from any corner.',180,10.5);y+=8;

  normal(doc,15,y,'Witnesses :-');y+=9;
  normal(doc,15,y,'1.  Name');dline(doc,42,y+0.5,110);if(d.wit1_name)drawFit(doc,d.wit1_name,44,y,66,10);y+=8;
  normal(doc,20,y,'Address');dline(doc,42,y+0.5,110);if(d.wit1_addr)drawFit(doc,d.wit1_addr,44,y,66,9);y+=10;
  normal(doc,15,y,'2.  Name');dline(doc,42,y+0.5,110);if(d.wit2_name)drawFit(doc,d.wit2_name,44,y,66,10);y+=8;
  normal(doc,20,y,'Address');dline(doc,42,y+0.5,110);if(d.wit2_addr)drawFit(doc,d.wit2_addr,44,y,66,9);y+=16;

  normal(doc,120,y,'Signature of the Receiver');
}

/* ── FORM 26 — DUPLICATE RC (official 2-page) ── */
function addForm26(doc,d){
  let y=hHead(doc,'FORM 26','[ Refer Rule 53 ]',['APPLICATION FOR ISSUE OF DUPLICATE CERTIFICATE','OF REGISTRATION']);
  y=hWrap(doc,15,y+1,'( To be made in duplicate if the vehicle is held under an agreement of hire-purchase / lease / hypothecation and in triplicate if the original registering authority is different; the duplicate and triplicate copies with the endorsement of the registering authority to be returned to the financier and registering authority simultaneously on issue of duplicate certificate )',180,8);
  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=8;
  hT(doc,15,y,'To,',11); y+=6;
  hT(doc,15,y,'The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,10);
  hT(doc,15,y,'The certificate of registration of my / our motor vehicle, the registration mark of',11); y+=7;
  hT(doc,15,y,'which is ',11);
  let x=15+hTW(doc,'which is ',11)+1;
  dline(doc,x,y+0.6,85);
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.reg_no||'',x+2,y);
  hT(doc,89,y,'has been *lost / destroyed / completely written-off /',11); y+=7;
  hT(doc,15,y,'soiled / torn / mutilated in the following circumstances :',11); y+=8;
  dline(doc,15,y+0.6,193); y+=8;
  dline(doc,15,y+0.6,193); y+=10;
  y=hWrap(doc,15,y,'*  I / We hereby declare that to the best of my / our knowledge the registration of the vehicle has not been suspended or cancelled under the provisions of the Act or Rules made thereunder, and the circumstances explained above are true.',180,10.5); y+=2;
  y=hWrap(doc,15,y,'\u2022  I / We do hereby apply for the issue of a duplicate certificate of registration.',180,10.5); y+=1;
  y=hWrap(doc,15,y,'\u2022  The *written-off / soiled / torn / mutilated certificate of registration is enclosed.',180,10.5); y+=1;
  y=hWrap(doc,15,y,'\u2022  The vehicle is not held under any agreement of hire-purchase / lease / hypothecation. The vehicle is also not superdari and free from all encumbrances.',180,10.5); y+=1;
  y=hWrap(doc,15,y,'\u2022  I declare that the certificate of registration is lost / destroyed and it has not been impounded by any agency nor has it been suspended or cancelled by any authority.',180,10.5); y+=3;
  y=hRow(doc,y,'My / Our mobile number is :  ',d.mobile,13);
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,112,y,'Signature / digital signature / e-signature of owner',9.5); y+=5;
  hT(doc,112,y,'of motor vehicle or authorised dealer of registered vehicles',9.5); y+=8;
  hT(doc,15,y,'*  Strike out whichever is inapplicable.',9); y+=10;
  y=hWrap(doc,15,y,'The vehicle is held under *hire-purchase / lease / hypothecation agreement with ........................ and the \u201CNo Objection Certificate\u201D has been *granted / refused by the financier hereunder. Where \u201CNo Objection Certificate\u201D is refused, the applicant shall make a declaration as required under sub-section (8) of section 51.',180,10.5); y+=6;
  hT(doc,118,y,'Signature or thumb impression of the owner',10.5); y+=9;
  y=hRow(doc,y,'Name :  ','',9);
  y=hRow(doc,y,'Full address :  ','',9);
  y=hRow(doc,y,'Date :  ','',10);
  y=hWrap(doc,15,y,'Note : (1) Full particulars of the circumstances shall be furnished in the case of loss or destruction of the registration certificate.',180,9);

  /* PAGE 2 — financier consent + office endorsement + specimen */
  doc.addPage(); let z=18;
  hTC(doc,z,'CONSENT OF THE FINANCIER FOR GRANT OF \u201CNO OBJECTION',11.5,true); z+=6;
  hTC(doc,z,'CERTIFICATE\u201D UNDER SECTION 51(6)',11.5,true); z+=10;
  z=hWrap(doc,15,z,'I / We, being a party to an agreement of hire-purchase / lease / hypothecation in respect of the motor vehicle specified above :',180,10.5); z+=2;
  z=hWrap(doc,22,z,'(1)  have \u201CNo Objection\u201D in issue of the duplicate certificate of registration of the said vehicle.',172,10.5); z+=1;
  z=hWrap(doc,22,z,'(2)  have \u201CObjection\u201D in issue of the duplicate registration certificate of the said vehicle, for the reasons given hereunder :',172,10.5); z+=1;
  dline(doc,22,z+0.6,193); z+=12;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,130,z,'Signature of the financier',10.5); z+=14;

  doc.setLineWidth(0.4);doc.line(15,z,195,z); z+=8;
  hTC(doc,z,'OFFICE  ENDORSEMENT',13,true); z+=11;
  z=hPair(doc,z,'Ref. Number :  ','','Office of the :  ',d.rto,10);
  z=hWrap(doc,15,z,'A duplicate certificate of registration as requested above is issued with the note of agreement of hire-purchase / lease / hypothecation on ........................ and is noted in the original registration records in Form 24.',180,10.5); z+=4;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,118,z,'Signature of the registering authority',10.5); z+=14;
  hT(doc,15,z,'To,',11); z+=7;
  z=hRow(doc,z,'The Financier :  ','',9);
  z=hRow(doc,z,'The Registering Authority :  ','',9);
  hT(doc,15,z,'( To be sent to both the above parties by registered post acknowledgement due )',9); z+=11;
  z=hWrap(doc,15,z,'Specimen signature or thumb impression of the registered owner and financier are to be obtained in original application for affixing and attestation by the registering authority with the office seal in Forms 23 and 24 in such a manner that the part of impression of seal or stamp and attestation shall fall upon each signature.',180,9.5); z+=8;
  hT(doc,15,z,'Specimen signature of the financier',10.5,true);
  hT(doc,112,z,'Specimen signature of the registered owner',10.5,true); z+=11;
  hT(doc,15,z,'1.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'1.',11); dline(doc,122,z+0.6,193); z+=12;
  hT(doc,15,z,'2.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'2.',11); dline(doc,122,z+0.6,193);
}

/* ── SHARED HELVETICA HELPERS (official-style forms) ── */
function hT(doc,x,y,s,sz,b){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz||11);doc.text(String(s),x,y);}
function hTC(doc,y,s,sz,b){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz||11);doc.text(String(s),105,y,{align:'center'});}
function hTW(doc,s,sz,b){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz||11);return doc.getTextWidth(String(s));}
function hWrap(doc,x,y,s,w,sz){doc.setFont('helvetica','normal');doc.setFontSize(sz||9);const L=doc.splitTextToSize(String(s),w);doc.text(L,x,y);return y+L.length*(sz?sz*0.42:3.8);}
function hRow(doc,y,label,val,R){hT(doc,15,y,label,11);const lx=15+hTW(doc,label,11)+1;dline(doc,lx,y+0.6,193);drawFit(doc,val,lx+2,y,Math.max(193-lx-4,30),11);return y+(R||9.5);}
/* Two-column label:value pair — left column x=15..100, right column x=105..193.
   Was: passed drawFit() a fake `Math.max(width, 20)` floor for the available width.
   When a label ate most of its column, drawFit() was told it still had ~20mm to work
   with (a lie) and squeezed the value in anyway, overlapping the other column's text
   — or, for a label long enough to cross x=100 on its own (e.g. Form 27A), overlapping
   before drawFit even ran. Now: compute the *real* remaining width per side, and if
   either side has less than MIN_PAIR_SIDE mm free, don't attempt two columns on this
   line at all — fall back to two stacked full-width rows via hRow(). A value on its
   own line beats a value overlapping the other column. */
const MIN_PAIR_SIDE=25; // mm — below this, drawFit's font-shrinking can no longer keep a value legible
function hPair(doc,y,l1,v1,l2,v2,R){
  const rowH=R||9.5;
  const x1=15+hTW(doc,l1,11)+1, availL=100-x1-2;
  const x2=105+hTW(doc,l2,11)+1, availR=193-x2-4;
  if(availL<MIN_PAIR_SIDE || availR<MIN_PAIR_SIDE){
    y=hRow(doc,y,l1,v1,rowH);
    y=hRow(doc,y,l2,v2,rowH);
    return y;
  }
  hT(doc,15,y,l1,11); dline(doc,x1,y+0.6,100); drawFit(doc,v1,x1+2,y,availL,11);
  hT(doc,105,y,l2,11); dline(doc,x2,y+0.6,193); drawFit(doc,v2,x2+2,y,availR,11);
  return y+rowH;
}
function hInline(doc,x,y,label,val,lineEnd){hT(doc,x,y,label,11);const lx=x+hTW(doc,label,11)+1;dline(doc,lx,y+0.6,lineEnd);drawFit(doc,val,lx+2,y,Math.max(lineEnd-lx-2,20),11);return lineEnd+2;}
function hHead(doc,num,rule,titleLines){
  hTC(doc,17,num,17,true);
  hTC(doc,24,rule,10);
  let y=31;
  titleLines.forEach(t=>{hTC(doc,y,t,12,true);y+=6;});
  return y;
}

/* ── FORM 23B — TEMPORARY CERTIFICATE OF REGISTRATION (official) ── */
function addForm23B(doc,d){
  let y=hHead(doc,'FORM 23B','[ Refer Rule 53B (1) and (3) ]',['TEMPORARY CERTIFICATE OF REGISTRATION']);
  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=10;
  y=hRow(doc,y,'Temporary Registration Mark :  ','',10);
  y=hRow(doc,y,'Application No. :  ','',10);
  y=hRow(doc,y,'Owner Name :  ',d.s_name,10);
  y=hRow(doc,y,'Son / wife / daughter of :  ',d.s_father,10);
  y=hRow(doc,y,'Address :  ',d.s_addr+(d.s_town?', '+d.s_town:'')+(d.s_dist?', Dist. '+d.s_dist:''),10);
  y=hRow(doc,y,'Mobile Number :  ',d.mobile,10);
  y=hRow(doc,y,'Description of Vehicle :  ','',10);
  y=hRow(doc,y,'Class of Vehicle :  ',d.veh_type,10);
  y=hPair(doc,y,'Maker\u2019s Name :  ',d.make,'Maker\u2019s Model Name :  ',d.model,10);
  y=hPair(doc,y,'Type of Body :  ','','Colour :  ',d.colour,10);
  y=hPair(doc,y,'Seating capacity ( incl. driver ) :  ','','Standing capacity :  ','',10);
  y=hRow(doc,y,'Sleeper capacity :  ','',10);
  y=hPair(doc,y,'Engine Number :  ',d.eng_no,'Chassis Number :  ',d.ch_no,10);
  y=hRow(doc,y,'Place where Vehicle shall be Permanently Registered :  ','',10);
  y=hRow(doc,y,'Reason for Temporary Registration ( body building / permanent regn. in another State ) :  ','',11);
  y=hWrap(doc,15,y,'Note : The Motor Vehicle above described is under Hire-Purchase / Lease Agreement / Hypothecation in favour of :',180,10); y+=2;
  dline(doc,15,y+0.6,193); y+=11;
  y=hWrap(doc,15,y,'Under the provisions of section 43 of the Motor Vehicles Act, 1988, the vehicle described above has been Temporarily Registered, and the Temporary Registration is valid :',180,10.5); y+=2;
  y=hPair(doc,y,'From :  ','','To :  ','',12);
  hT(doc,15,y,'This certificate is extended :',11,true); y+=9;
  y=hPair(doc,y,'From :  ','','To :  ','',8);
  y=hRow(doc,y,'Date :  ','',10);
  y=hPair(doc,y,'From :  ','','To :  ','',8);
  y=hRow(doc,y,'Date :  ','',11);
  y=hPair(doc,y,'Fee Paid Details :  ','','Tax Paid Details :  ','',16);
  hT(doc,15,y,'Specimen Signature of the Owner',10.5);
  hT(doc,122,y,'Signature of Registering Authority',10.5);
}

/* ── FORM 27 — NEW REGISTRATION MARK (official 2-page) ── */
function addForm27(doc,d){
  let y=hHead(doc,'FORM 27','[ Refer Rule 54 ]',['APPLICATION FOR ASSIGNMENT OF NEW REGISTRATION','MARK TO A MOTOR VEHICLE']);
  y=hWrap(doc,15,y+2,'( To be made in triplicate if the vehicle is held under an agreement of hire-purchase / lease / hypothecation; the duplicate and triplicate copies with the endorsement of the registering authority to be returned to the financier and the original registering authority simultaneously, on the assignment of a new registration mark. )',180,8.5);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=9;
  hT(doc,15,y,'To,',11); y+=6;
  hT(doc,15,y,'The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,10);
  y=hRow(doc,y,'I / We :  ',d.s_name,9);
  y=hRow(doc,y,'son / wife / daughter* of :  ',d.s_father,9);
  y=hPair(doc,y,'being the registered owner of vehicle No. :  ',d.reg_no,'Chassis No. :  ',d.ch_no,9);
  y=hPair(doc,y,'Engine No. / Motor No. ( BOV ) :  ',d.eng_no,'Type of vehicle :  ',d.veh_type,9);
  y=hRow(doc,y,'registered in the State of :  ',d.prev_state,9);
  y=hWrap(doc,15,y,'hereby declare that I / We have, since the .................. day of .................. , kept the said motor vehicle in this State and hereby apply for the assignment of a new registration mark to the said motor vehicle.',180,10.5); y+=3;
  y=hRow(doc,y,'I / We hereby declare that the registration is valid up to :  ','',8);
  y=hWrap(doc,15,y,'and it has not been suspended or cancelled under the provisions of the Act.',180,10.5); y+=2;
  y=hWrap(doc,15,y,'\u2022  I / We enclose the certificate of registration and the certificate of fitness* of the motor vehicle.',180,10.5);
  y=hWrap(doc,15,y,'\u2022  I / We enclose a \u201CNo Objection Certificate\u201D from the registering authority.',180,10.5);
  y=hWrap(doc,15,y,'\u2022  If the \u201CNo Objection Certificate\u201D is not enclosed, the applicant should file along with this application a declaration as required under the first proviso to sub-section (1) of section 47.',180,10.5); y+=2;
  y=hWrap(doc,15,y,'*  The vehicle is not subject to an agreement of hire-purchase / lease / hypothecation.',180,10.5);
  y=hRow(doc,y,'*  The vehicle is subject to such an agreement with :  ','',8);
  y=hWrap(doc,15,y,'and the NOC has been *granted / refused by the financier thereunder. If refused, the applicant should file a declaration as required under sub-section (8) of section 51.',180,10.5); y+=3;
  y=hRow(doc,y,'My / Our mobile number is :  ',d.mobile,12);
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,112,y,'Signature or thumb impression of the applicant',10.5); y+=7;
  hT(doc,15,y,'*  Strike out whichever is inapplicable.',9); y+=11;

  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=8;
  hTC(doc,y,'CONSENT OF THE FINANCIER FOR GRANT OF',11.5,true); y+=6;
  hTC(doc,y,'\u201CNO OBJECTION CERTIFICATE\u201D UNDER SECTION 51(6)',11.5,true); y+=9;
  y=hWrap(doc,15,y,'I / We, being a party to an agreement of hire-purchase / lease / hypothecation in respect of the motor vehicle specified above :',180,10.5); y+=2;
  y=hWrap(doc,22,y,'(1)  have \u201CNo Objection\u201D in assigning the new registration mark to the said vehicle.',172,10.5);
  y=hWrap(doc,22,y,'(2)  have \u201CObjection\u201D in assigning the new registration mark to the said vehicle for the reasons given hereunder :',172,10.5); y+=1;
  dline(doc,22,y+0.6,193); y+=12;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,130,y,'Signature of the financier',10.5);

  /* PAGE 2 — OFFICE ENDORSEMENT */
  doc.addPage(); let z=20;
  doc.setLineWidth(0.5);doc.line(15,z,195,z); z+=9;
  hTC(doc,z,'OFFICE  ENDORSEMENT',13,true); z+=12;
  z=hPair(doc,z,'Ref. Number :  ','','Office of the :  ',d.rto,11);
  hT(doc,15,z,'The vehicle No. ',11);
  let zx=15+hTW(doc,'The vehicle No. ',11)+1;
  dline(doc,zx,z+0.6,90);
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.reg_no||'',zx+2,z);
  hT(doc,94,z,'on removal to this State has been assigned a new',11); z+=9;
  hT(doc,15,z,'registration mark ',11);
  zx=15+hTW(doc,'registration mark ',11)+1;
  dline(doc,zx,z+0.6,120);
  hT(doc,124,z,'( here enter the registration mark ).',9); z+=14;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,118,z,'Signature of the registering authority',10.5); z+=16;
  z=hRow(doc,z,'To,  The Financier :  ','',10);
  z=hRow(doc,z,'The Registering Authority :  ','',9);
  hT(doc,15,z,'( To be sent to both the above parties by registered post acknowledgement due )',9);
}

/* ── FORM 27A — BH-SERIES REGISTRATION MARK (official) ── */
function addForm27A(doc,d){
  let y=hHead(doc,'FORM 27A','[ See Rule 51B (4) ]',['APPLICATION FOR ASSIGNMENT OF NEW REGISTRATION','MARK IN BH-SERIES']);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=10;
  hT(doc,15,y,'To,',11); y+=6;
  hT(doc,15,y,'The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,11);
  y=hRow(doc,y,'I / We :  ',d.s_name,9.5);
  y=hRow(doc,y,'son / wife / daughter of :  ',d.s_father,9.5);
  y=hPair(doc,y,'being the Registered Owner of Motor Vehicle No. :  ',d.reg_no,'Chassis No. :  ',d.ch_no,9.5);
  y=hPair(doc,y,'[ Engine No. / Motor No. ( BOV ) ] :  ',d.eng_no,'Type of vehicle :  ',d.veh_type,9.5);
  y=hWrap(doc,15,y,'hereby declare that I am eligible for getting my vehicle registered in BH-Series.',180,11); y+=4;
  y=hRow(doc,y,'I hereby declare that the registration is valid up to :  ','',8);
  y=hWrap(doc,15,y,'and it has not been suspended or cancelled under the provisions of this Act.',180,10.5); y+=4;
  y=hWrap(doc,15,y,'\u2022  I enclose the certificate of registration of this motor vehicle.',180,10.5); y+=1;
  y=hWrap(doc,15,y,'\u2022  I enclose my working certificate in Form 60 or official identity card / Service Certificate.',180,10.5); y+=4;
  y=hWrap(doc,15,y,'*  The vehicle is not subject to an agreement of hire-purchase / lease / hypothecation.',180,10.5); y+=1;
  y=hRow(doc,y,'*  The vehicle is subject to such an agreement with :  ','',8);
  y=hWrap(doc,15,y,'and the NOC has been granted / refused by the Financier thereunder. If \u201CNo Objection Certificate\u201D has been refused by the Financier, the applicant should file along with this application a declaration as required under sub-section (8) of section 51.',180,10.5); y+=4;
  y=hPair(doc,y,'My mobile number is :  ',d.mobile,'Email ( if any ) :  ',d.email,12);
  y=hRow(doc,y,'Date :  ','',16);
  hT(doc,118,y,'Signature / e-signature of the Applicant',10.5); y+=8;
  hT(doc,15,y,'*  Strike out whichever is inapplicable.',9);
}


/* ── FORM 31 — TRANSFER ON DEATH (official 2-page) ── */
function addForm31(doc,d){
  let y=hHead(doc,'FORM 31','[ Refer Rule 56(3) ]',['APPLICATION FOR TRANSFER OF OWNERSHIP IN THE NAME OF THE','PERSON NOMINATED / SUCCEEDING TO THE POSSESSION OF VEHICLE']);
  y=hWrap(doc,15,y+1,'( To be made in duplicate if the vehicle is held under an agreement of hire-purchase / lease / hypothecation and the duplicate copy with an endorsement of the registering authority to be returned to the financier simultaneously on making the entry of transfer of ownership in the certificate of registration and office record in Form 24. )',180,8);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=10;
  hT(doc,15,y,'To,',11); y+=6;
  hT(doc,15,y,'The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,11);
  y=hRow(doc,y,'1.  Vehicle registration No. :  ',d.reg_no,10);
  y=hRow(doc,y,'     Make and model :  ',(d.make+' '+d.model).trim(),10);
  y=hPair(doc,y,'     Chassis No. :  ',d.ch_no,'Engine No. / Motor No. ( BOV ) :  ',d.eng_no,10);
  y=hRow(doc,y,'     Type of vehicle :  ',d.veh_type,11);
  y=hRow(doc,y,'2.  Name of the deceased registered owner :  ',d.deceased,11);
  y=hRow(doc,y,'3.  Name and age of the nominee / person succeeding to the possession :  ',d.s_name,9);
  y=hRow(doc,y,'     son / wife / daughter of :  ',d.s_father,11);
  y=hRow(doc,y,'4.  Relationship with the deceased registered owner :  ',d.relation,11);
  y=hRow(doc,y,'5.  Proof of his nomination / succession :  ',d.succession,11);
  y=hRow(doc,y,'6.  Mobile number of the new owner :  ',d.mobile,12);
  y=hWrap(doc,15,y,'Certificate of registration is enclosed herewith. Kindly transfer the ownership of the vehicle in my name.',180,11); y+=8;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,125,y,'Signature of the applicant',10.5); y+=16;

  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=8;
  hTC(doc,y,'CONSENT OF THE FINANCIER IN THE CASE OF MOTOR VEHICLE',11.5,true); y+=6;
  hTC(doc,y,'HELD UNDER ANY OF THE AGREEMENTS',11.5,true); y+=10;
  y=hWrap(doc,15,y,'I / We, being a party to an agreement of hire-purchase / lease / hypothecation in respect of the motor vehicle specified above, consent to the transfer of ownership of the said motor vehicle in the name of the applicant named above, with whom I / we have entered into an agreement of hire-purchase / lease / hypothecation.',180,10.5);
  y+=10;
  hT(doc,118,y,'Signature of the Financier',10.5); y+=9;
  dline(doc,15,y+0.6,193); y+=6;
  hT(doc,15,y,'( Full name and address of the financier )',9); y+=10;
  hT(doc,15,y,'Date : ____________________',11);

  /* PAGE 2 */
  doc.addPage(); let z=20;
  doc.setLineWidth(0.5);doc.line(15,z,195,z); z+=9;
  hTC(doc,z,'OFFICE  ENDORSEMENT',13,true); z+=12;
  z=hPair(doc,z,'Ref. Number :  ','','Office of the :  ',d.rto,11);
  z=hWrap(doc,15,z,'The transfer of ownership of the motor vehicle under continuation of an endorsement of hire-purchase / lease / hypothecation agreement has been recorded with effect from ........................ in the certificate of registration of the vehicle and the registration record of this office in Form 24.',180,10.5);
  z+=6;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,118,z,'Signature of the registering authority',10.5); z+=10;
  hT(doc,15,z,'*  Strike out whichever is inapplicable.',9); z+=12;
  hT(doc,15,z,'To,',11); z+=7;
  z=hRow(doc,z,'The Financier :  ','',9);
  hT(doc,15,z,'( To be sent by registered post acknowledgement due )',9); z+=12;
  z=hWrap(doc,15,z,'Specimen signatures or thumb impression of the registered owner and financier are to be obtained in original application for affixing and attestation by the registering authority with office seal in Forms 23 and 24, in such a manner that the part of impression of seal or stamp and attestation shall fall upon each signature :',180,9.5);
  z+=8;
  hT(doc,15,z,'Specimen signatures of the financier',10.5,true);
  hT(doc,112,z,'Specimen signatures of the registered owner',10.5,true); z+=11;
  hT(doc,15,z,'1.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'1.',11); dline(doc,122,z+0.6,193); z+=12;
  hT(doc,15,z,'2.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'2.',11); dline(doc,122,z+0.6,193);
}

/* ── FORM 33 — CHANGE OF ADDRESS (official 2-page) ── */
function addForm33(doc,d){
  let y=hHead(doc,'FORM 33','[ Refer Rule 59 ]',['INTIMATION OF CHANGE OF ADDRESS RECORDED IN THE','CERTIFICATE OF REGISTRATION AND OFFICE RECORDS']);
  y=hWrap(doc,15,y+1,'( To be made in triplicate if the vehicle is held under agreement of hire-purchase / lease / hypothecation; the duplicate copy and the triplicate copy with the endorsement of the registering authority to be returned to the financier and the registering authority ( from whose jurisdiction the vehicle is removed ) simultaneously, on making the entry of change of address in the certificate of registration and Form 24. )',180,8);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=10;
  hT(doc,15,y,'To,',11); y+=6;
  hT(doc,15,y,'The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,11);
  y=hRow(doc,y,'I / We :  ',d.s_name,9.5);
  y=hRow(doc,y,'son / wife / daughter of :  ',d.s_father,9.5);
  y=hRow(doc,y,'( full address ) :  ',d.s_addr+(d.s_town?', '+d.s_town:'')+(d.s_dist?', Dist. '+d.s_dist:''),9.5);
  y=hRow(doc,y,'registered owner of motor vehicle No. :  ',d.reg_no,9.5);
  y=hWrap(doc,15,y,'have ceased to reside / do not have the place of business at the address recorded in the certificate of registration with effect from ........................ . The present address is given below ( evidence to be enclosed ) :',180,10.5); y+=2;
  dline(doc,15,y+0.6,193);
  if(d.new_addr){doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.new_addr,17,y);}
  y+=9;
  dline(doc,15,y+0.6,193); y+=11;
  y=hRow(doc,y,'My / Our mobile number is :  ',d.mobile,11);
  y=hWrap(doc,15,y,'*  The vehicle is not held under any agreement of hire-purchase / lease / hypothecation.',180,10.5); y+=1;
  y=hWrap(doc,15,y,'*  The vehicle is held under an agreement of hire-purchase / lease / hypothecation with :',180,10.5); y+=1;
  dline(doc,15,y+0.6,193);
  if(d.fin_name){doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.fin_name,17,y);}
  y+=6;
  hT(doc,15,y,'( Name and full address of the financier )',9); y+=9;
  y=hWrap(doc,15,y,'The certificate of registration is enclosed. I / We request that the change of address may be recorded in the certificate of registration and Form 24.',180,10.5); y+=7;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,112,y,'Signature or thumb impression of the',10.5); y+=5;
  hT(doc,112,y,'registered owner of the vehicle',10.5); y+=7;
  hT(doc,15,y,'*  Strike out whichever is inapplicable.',9); y+=12;

  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=8;
  hTC(doc,y,'CONSENT OF THE FINANCIER IN THE CASE OF MOTOR VEHICLE',11.5,true); y+=6;
  hTC(doc,y,'HELD UNDER AN AGREEMENT',11.5,true); y+=10;
  y=hWrap(doc,15,y,'I / We, being a party to an agreement of hire-purchase / lease / hypothecation in respect of the above said vehicle, hereby :',180,10.5); y+=2;
  y=hWrap(doc,22,y,'1.  Give consent for effecting the above change of address with the note of an agreement in my / our favour in Forms 23 and 24 by the registering authority.',172,10.5); y+=1;
  y=hWrap(doc,22,y,'2.  Refuse to give consent for effecting the above change of address by the registering authority, due to the reasons furnished hereunder :',172,10.5); y+=1;
  dline(doc,22,y+0.6,193); y+=12;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,130,y,'Signature of the financier',10.5);

  /* PAGE 2 */
  doc.addPage(); let z=20;
  doc.setLineWidth(0.5);doc.line(15,z,195,z); z+=9;
  hTC(doc,z,'OFFICE  ENDORSEMENT',13,true); z+=12;
  z=hPair(doc,z,'Ref. Number :  ','','Office of the :  ',d.rto,11);
  z=hWrap(doc,15,z,'The above change of address has been entered with the note of agreement of hire-purchase / lease / hypothecation in favour of the financier in the certificate of registration and in Form 24.',180,10.5);
  z+=6;
  hT(doc,15,z,'Date : ____________________',11);
  hT(doc,118,z,'Signature of the registering authority',10.5); z+=14;
  hT(doc,15,z,'To,',11); z+=7;
  z=hRow(doc,z,'The Financier :  ','',9);
  z=hRow(doc,z,'The Registering Authority :  ','',9);
  hT(doc,15,z,'( To be sent to both the parties by registered post acknowledgement due )',9); z+=12;
  z=hWrap(doc,15,z,'Specimen signatures or thumb impressions of the registered owner and financier are to be obtained for affixing and attestation by the registering authority with official seal in Forms 23 and 24, in such a manner that part of impression of the seal or stamp and attestation shall fall upon each signature :',180,9.5);
  z+=8;
  hT(doc,15,z,'Specimen signatures of financier',10.5,true);
  hT(doc,112,z,'Specimen signatures of registered owner',10.5,true); z+=11;
  hT(doc,15,z,'1.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'1.',11); dline(doc,122,z+0.6,193); z+=12;
  hT(doc,15,z,'2.',11); dline(doc,25,z+0.6,92);
  hT(doc,112,z,'2.',11); dline(doc,122,z+0.6,193);
}

/* ── FORM 34 — HP ENTRY (official) ── */
function addForm34(doc,d){
  let y=hHead(doc,'FORM 34','[ Refer Rule 60 ]',['APPLICATION FOR MAKING AN ENTRY OF AN AGREEMENT OF HIRE-','PURCHASE / LEASE / HYPOTHECATION SUBSEQUENT TO REGISTRATION']);
  y=hWrap(doc,15,y+1,'( To be made in duplicate and in triplicate where the original registering authority is different; the duplicate copy and the triplicate copy with the endorsement of the registering authority to be returned to the financier and the registering authority simultaneously on making the entry in the certificate of registration and in Form 24. )',180,8);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=10;
  hT(doc,15,y,'To,',11); y+=6;
  hT(doc,15,y,'The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,11);
  hT(doc,15,y,'The motor vehicle bearing registration number ',11);
  let x=15+hTW(doc,'The motor vehicle bearing registration number ',11)+1;
  dline(doc,x,y+0.6,193);
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.reg_no||'',x+2,y); y+=9;
  hT(doc,15,y,'is the subject of an agreement of hire-purchase / lease / hypothecation between',11); y+=9;
  dline(doc,15,y+0.6,140);
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.s_name||'',17,y);
  hT(doc,143,y,'the registered owner /',11); y+=8;
  hT(doc,15,y,'person to be registered as owner*  and',11); y+=9;
  dline(doc,15,y+0.6,193);
  if(d.fin_name){doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.fin_name,17,y);}
  y+=7;
  hT(doc,15,y,'( fill the name and full address of the financier )',9); y+=10;
  y=hRow(doc,y,'having agreement number / loan account number :  ',d.loan_no,11);
  y=hWrap(doc,15,y,'We request that an entry of the agreement be made in the certificate of registration and the relevant records in your office.',180,11); y+=3;
  y=hRow(doc,y,'My / Our mobile number is :  ',d.mobile,10);
  hT(doc,15,y,'The certificate of registration together with the fee is enclosed.',11); y+=14;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,105,y,'Signature or thumb impression of registered owner',10.5); y+=14;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,130,y,'Signature of the financier',10.5); y+=10;
  hT(doc,15,y,'*  Strike out whichever is inapplicable.',9); y+=14;

  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=8;
  hTC(doc,y,'OFFICE  ENDORSEMENT',13,true); y+=12;
  y=hPair(doc,y,'Ref. Number :  ','','Office of the :  ',d.rto,11);
  y=hWrap(doc,15,y,'The entry of the agreement of hire-purchase / lease / hypothecation as requested above is recorded in this office registration record in Form 24 and certificate of registration on ........................ ( date ).',180,10.5);
  y+=6;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,118,y,'Signature of the registering authority',10.5); y+=13;
  hT(doc,15,y,'To,',11); y+=7;
  y=hRow(doc,y,'The Financier :  ','',9);
  y=hRow(doc,y,'The Registering Authority :  ','',9);
  hT(doc,15,y,'( To be sent to both the above parties by registered post acknowledgment due )',9); y+=11;
  y=hWrap(doc,15,y,'Specimen signatures of the financier are to be obtained in original application for affixing and attestation by the registering authority with official seal in Forms 23 and 24 in such a manner that part of impression of the seal or a stamp and attestation shall fall upon each signature :',180,9.5);
  y+=8;
  hT(doc,15,y,'Specimen signatures of the financier',10.5,true); y+=11;
  hT(doc,15,y,'1.',11); dline(doc,25,y+0.6,110); y+=12;
  hT(doc,15,y,'2.',11); dline(doc,25,y+0.6,110);
}

/* ── FORM 35 — HP TERMINATION (official) ── */
function addForm35(doc,d){
  let y=hHead(doc,'FORM 35','[ Refer Rule 61(1) ]',['NOTICE OF TERMINATION OF AGREEMENT OF','*HIRE-PURCHASE / LEASE / HYPOTHECATION']);
  y=hWrap(doc,15,y+1,'( To be made in duplicate and in triplicate where the original registering authority is different; the duplicate copy and the triplicate copy with the endorsement of the registering authority to be returned to the financier and registering authority simultaneously on making the termination entry in the certificate of the registration and in Form 24. )',180,8);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=10;
  hT(doc,15,y,'To,',11); y+=6;
  hT(doc,15,y,'The Registering Authority,',11); y+=7;
  y=hRow(doc,y,'',d.rto,11);
  y=hWrap(doc,15,y,'We hereby declare that the agreement of hire-purchase / lease / hypothecation entered into between us has been terminated. We, therefore, request that the note endorsed in the certificate of registration of',180,11); y+=1;
  hT(doc,15,y,'vehicle No. ',11);
  let x=15+hTW(doc,'vehicle No. ',11)+1;
  dline(doc,x,y+0.6,95);
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(d.reg_no||'',x+2,y);
  hT(doc,99,y,'in respect of the said agreement between us be',11); y+=8;
  hT(doc,15,y,'cancelled.',11); y+=10;
  y=hRow(doc,y,'My / Our mobile number is :  ',d.mobile,10);
  hT(doc,15,y,'The certificate of registration together with the fee is enclosed.',11); y+=14;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,100,y,'Signature or thumb impression of the registered owner',10.5); y+=14;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,100,y,'Signature of the financier with official seal and address',10.5); y+=10;
  hT(doc,15,y,'*  Strike out whichever is inapplicable.',9); y+=14;

  doc.setLineWidth(0.4);doc.line(15,y,195,y); y+=8;
  hTC(doc,y,'OFFICE  ENDORSEMENT',13,true); y+=12;
  y=hPair(doc,y,'Ref. Number :  ','','Office of the :  ',d.rto,11);
  y=hWrap(doc,15,y,'The cancellation of the entry of an agreement as requested above is recorded in this office registration record in Form 24 and registration certificate on ........................ ( date ).',180,10.5);
  y+=6;
  hT(doc,15,y,'Date : ____________________',11);
  hT(doc,118,y,'Signature of the registering authority',10.5); y+=13;
  hT(doc,15,y,'To,',11); y+=7;
  y=hRow(doc,y,'The Financier :  ','',9);
  y=hRow(doc,y,'The Registering Authority :  ','',9);
  hT(doc,15,y,'( To be sent to both the above parties by registered post acknowledgement due )',9); y+=11;
  y=hWrap(doc,15,y,'Specimen signature of the financier are to be obtained in original application for affixing and attestation by the registering authority with his office seal in Forms 23 and 24 in such a manner that the part of impression of seal or stamp and attestation shall fall upon each signature.',180,9.5);
  y+=8;
  hT(doc,15,y,'Specimen signatures of Financier',10.5,true); y+=11;
  hT(doc,15,y,'1.',11); dline(doc,25,y+0.6,110); y+=12;
  hT(doc,15,y,'2.',11); dline(doc,25,y+0.6,110);
}

/* ── FORM 20 — REGISTRATION (official 4-page content) ── */
function addForm20(doc,d){
  /* Helvetica, bigger type, pages filled edge to edge */
  const F='helvetica';
  function T(x,y,s,sz,b){doc.setFont(F,b?'bold':'normal');doc.setFontSize(sz||11);doc.text(String(s),x,y);}
  function TC(y,s,sz,b){doc.setFont(F,b?'bold':'normal');doc.setFontSize(sz||11);doc.text(String(s),105,y,{align:'center'});}
  function TW(s,sz,b){doc.setFont(F,b?'bold':'normal');doc.setFontSize(sz||11);return doc.getTextWidth(String(s));}
  function WRAP(x,y,s,w,sz){doc.setFont(F,'normal');doc.setFontSize(sz||9);const L=doc.splitTextToSize(String(s),w);doc.text(L,x,y);return y+L.length*(sz?sz*0.42:3.8);}
  function ROW(y,label,val,R){T(15,y,label,11);const lx=15+TW(label,11)+1;dline(doc,lx,y+0.6,193);if(val){doc.setFont(F,'bold');doc.setFontSize(11);doc.text(String(val),lx+2,y);}return y+(R||10);}
  function PAIR(y,l1,v1,l2,v2,R){T(15,y,l1,11);let x1=15+TW(l1,11)+1;dline(doc,x1,y+0.6,100);if(v1){doc.setFont(F,'bold');doc.setFontSize(11);doc.text(String(v1),x1+2,y);}T(105,y,l2,11);let x2=105+TW(l2,11)+1;dline(doc,x2,y+0.6,193);if(v2){doc.setFont(F,'bold');doc.setFontSize(11);doc.text(String(v2),x2+2,y);}return y+(R||10);}

  /* ───── PAGE 1 ───── */
  TC(17,'FORM 20',17,true);
  TC(24,'( Refer Rule 47 and Rule 53A )',10);
  TC(31,'APPLICATION FOR REGISTRATION OR TEMPORARY',12,true);
  TC(37,'REGISTRATION OF A MOTOR VEHICLE',12,true);
  let y=43;
  y=WRAP(15,y,'( To be made in duplicate if the vehicle is held under an agreement of Hire-Purchase / Lease / Hypothecation and duplicate copy with the endorsement of the Registering Authority to be returned to the Financier simultaneously on Registration of motor vehicle )',180,8.5);
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=9;

  T(15,y,'To,',11); y+=6;
  T(15,y,'The Licensing Authority,',11); y+=8;
  dline(doc,15,y+0.6,193);
  doc.setFont(F,'bold');doc.setFontSize(11);doc.text(d.rto||'',17,y); y+=12;

  T(15,y,'1.   Full name of person to be registered as Registered Owner :',11); y+=8;
  dline(doc,22,y+0.6,193);
  doc.setFont(F,'bold');doc.setFontSize(11.5);doc.text(d.s_name||'',24,y); y+=10;
  y=ROW(y,'      Son / Wife / Daughter of :  ',d.s_father,11);
  y=ROW(y,'2.   Age of person to be registered as Registered Owner :  ','',11);
  y=ROW(y,'3.   Permanent address :  ',d.s_addr+(d.s_town?', '+d.s_town:'')+(d.s_dist?', Dist. '+d.s_dist:''),8);
  y=WRAP(22,y,'( Electoral Roll / LIC Policy / Passport / Pay slip of Central or State Government office or local body / any other prescribed document / Affidavit sworn before a Magistrate or Notary Public to be enclosed )',170,8);
  y+=5;
  y=ROW(y,'4.   Temporary address / Official address, if any :  ','',11);

  T(15,y,'4A.  Ownership type ( tick one ) :',11,true); y+=8;
  doc.setFont(F,'normal');doc.setFontSize(9.5);
  const own1=['1.  AUTONOMOUS BODY','2.  CENTRAL GOVERNMENT','3.  CHARITABLE TRUST','4.  DRIVING TRAINING SCHOOL','5.  DIVYANGJAN','     (a) with GST concession','     (b) without GST concession','6.  EDUCATIONAL INSTITUTE'];
  const own2=['7.  FIRM','8.  GOVERNMENT UNDERTAKING','9.  INDIVIDUAL','10. LOCAL AUTHORITY','11. MULTIPLE OWNER','12. OTHERS','13. POLICE DEPARTMENT','14. STATE GOVERNMENT / 15. STC'];
  let oy=y; own1.forEach(t=>{doc.text(t,24,oy);oy+=6.5;});
  let oy2=y; own2.forEach(t=>{doc.text(t,112,oy2);oy2+=6.5;});
  y=Math.max(oy,oy2)+4;

  y=ROW(y,'5.   Duration of stay at the present address :  ','',10.5);
  y=ROW(y,'5A. Mobile number of the owner of the vehicle :  ',d.mobile,10.5);
  y=PAIR(y,'6.   PAN number ( optional ) :  ','','7.  Place of birth :  ','',10.5);
  y=ROW(y,'8.   If place of birth is outside India, when migrated to India :  ','',10.5);
  y=PAIR(y,'9A. Name of the nominee :  ','','9B. Relationship :  ','',10.5);

  /* ───── PAGE 2 ───── */
  doc.addPage(); y=18;
  TC(y,'FORM 20  —  VEHICLE PARTICULARS',13,true); y+=4;
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=11;

  T(15,y,'10.  Name and address of the Dealer or Manufacturer from whom purchased',11); y+=6;
  T(22,y,'( sale certificate and road-worthiness certificate to be enclosed ) :',8.5); y+=8;
  dline(doc,22,y+0.6,193); y+=11;
  y=ROW(y,'11.  If ex-army or imported vehicle, enclose proof :  ','',10.5);
  y=ROW(y,'12.  Class of vehicle ( if motor cycle — with / without gear ) :  ',d.veh_type,10.5);
  T(15,y,'13.  The motor vehicle is :   (a) new vehicle    (b) ex-army    (c) imported',11); y+=7;
  T(22,y,'(d) in-use E-rickshaw / E-cart          ( strike out whichever is inapplicable )',9.5); y+=10;
  y=PAIR(y,'14.  Type of body :  ','','15.  Type of vehicle :  ','',10.5);
  y=ROW(y,'16.  Maker\'s name :  ',d.make,10.5);
  y=ROW(y,'17.  Month and year of manufacture :  ',d.model,10.5);
  y=PAIR(y,'18.  Number of cylinders :  ','','19.  Horse power :  ','',10.5);
  y=PAIR(y,'20.  Cubic capacity :  ','','21.  Wheel base :  ','',10.5);
  y=ROW(y,'22.  Chassis No. ( affix pencil print ) :  ',d.ch_no,10.5);
  y=ROW(y,'23.  Engine No. / Motor No. ( Battery Operated Vehicles ) :  ',d.eng_no,10.5);
  y=ROW(y,'24.  Seating capacity ( including driver ) :  ','',10.5);
  y=PAIR(y,'24A. Standing capacity :  ','','24B. Sleeper capacity :  ','',10.5);
  y=ROW(y,'25.  Fuel used in the engine :  ','',10.5);
  y=ROW(y,'26.  Unladen weight :  ','',10.5);
  y=ROW(y,'27.  Previous registration particulars and number ( if any ) :  ','',10.5);
  y=ROW(y,'28.  Colour or colours of body, wings and front end :  ',d.colour,10.5);
  y+=4;
  doc.setFont(F,'bold');doc.setFontSize(11.5);
  doc.text('I hereby declare that the motor vehicle has not been registered in any State in India.',15,y);

  /* ───── PAGE 3 ───── */
  doc.addPage(); y=18;
  TC(y,'ADDITIONAL PARTICULARS — TRANSPORT VEHICLE',12.5,true); y+=6;
  TC(y,'( other than Motor Cab )',10); y+=4;
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=11;

  T(15,y,'29.  Number, description, size and ply rating of tyres ( as declared by manufacturer ) :',11); y+=9;
  y=PAIR(y,'       (a) Front axle :  ','','(b) Rear axle :  ','',10);
  y=PAIR(y,'       (c) Any other axle :  ','','(d) Tandem axle :  ','',11);
  T(15,y,'30.  Gross vehicle weight :',11); y+=9;
  y=PAIR(y,'       (a) Certified by manufacturer ( Kgms. ) :  ','','(b) To be registered ( Kgms. ) :  ','',11);
  T(15,y,'31.  Maximum axle weight ( Kgms. ) :',11); y+=9;
  y=PAIR(y,'       (a) Front axle :  ','','(b) Rear axle :  ','',10);
  y=PAIR(y,'       (c) Any other axle :  ','','(d) Tandem axle :  ','',11);
  T(15,y,'32.  Dimensions :',11); y+=9;
  y=PAIR(y,'       (a) Overall length :  ','','(b) Overall width :  ','',10);
  y=PAIR(y,'       (c) Overall height :  ','','(d) Overhang :  ','',11);
  y=WRAP(15,y,'( For each semi-trailer registered with an articulated motor vehicle, furnish the following : )',180,8.5); y+=3;
  y=PAIR(y,'33.  Type of body :  ','','34.  Unladen weight :  ','',10.5);
  y=ROW(y,'35.  Number, description and size of tyres on each axle :  ','',10.5);
  y=ROW(y,'36.  Maximum axle weight in respect of each axle :  ','',12);
  T(15,y,'37.  The vehicle is covered by a valid certificate of insurance under Chapter XI :',11); y+=9;
  y=PAIR(y,'       Certificate / Cover Note No. :  ','','Date :  ','',10);
  y=PAIR(y,'       Name of company :  ','','Valid from / to :  ','',11);
  y=ROW(y,'38.  Exempted from insurance — relevant order enclosed :  ','',10.5);
  y=ROW(y,'39.  I have paid the prescribed fee of Rs. :  ','',13);
  T(15,y,'Date : ____________________',11);
  T(105,y,'Signature / thumb impression of the dealer along',10); y+=5.5;
  T(105,y,'with the specimen signature of the owner',10); y+=12;
  doc.setFont(F,'bold');doc.setFontSize(11);doc.text('Note :',15,y);
  T(31,y,'The motor vehicle above described is —',11); y+=9;
  y=ROW(y,'(i)   Subject to Hire-Purchase / Lease agreement with :  ','',10);
  y=ROW(y,'(ii)  Subject to hypothecation in favour of :  ','',10);
  T(15,y,'(iii) Not held under Hire-Purchase, lease or hypothecation.',11); y+=8;
  y=WRAP(15,y,'Strike out whatever is inapplicable. If the vehicle is subject to any such agreement, the signature of the Financier is to be obtained below.',180,9); y+=10;
  dline(doc,15,y,90); dline(doc,118,y,193); y+=6;
  T(15,y,'Signature of Financier',9.5);
  T(118,y,'Signature / thumb impression of Registered Owner',9.5);

  /* ───── PAGE 4 ───── */
  doc.addPage(); y=18;
  TC(y,'CERTIFICATE OF INSPECTION OF MOTOR VEHICLE WHOSE BODY',11.5,true); y+=6;
  TC(y,'HAS BEEN FABRICATED SEPARATELY TO THE PURCHASED CHASSIS',11.5,true); y+=4;
  doc.setLineWidth(0.4);doc.line(15,y+1,195,y+1); y+=12;
  doc.setFont(F,'normal');doc.setFontSize(11);
  const insp=doc.splitTextToSize('Certified that the particulars contained in the application are true and that the vehicle complies with the requirements of the Motor Vehicles Act, 1988, and the Rules made thereunder.',180);
  doc.text(insp,15,y); y+=insp.length*5.5+8;
  y=PAIR(y,'Date :  ','','Ref. No. :  ','',11);
  y=PAIR(y,'Name :  ','','Designation :  ','',13);
  T(118,y,'Signature of the Inspecting Authority',10.5); y+=18;

  doc.setLineWidth(0.5);doc.line(15,y,195,y); y+=8;
  TC(y,'OFFICE  ENDORSEMENT',13,true); y+=12;
  y=ROW(y,'Office of the :  ',d.rto,11);
  T(15,y,'The above said motor vehicle has been assigned the Registration Number',11); y+=9;
  dline(doc,15,y+0.6,105);
  T(109,y,'and registered in the',11); y+=8;
  y=WRAP(15,y,'name of the applicant and the vehicle is subject to an agreement of Hire-Purchase / Lease / Hypothecation with the Financier referred above.',180,11);
  y+=10;
  T(15,y,'Date : ____________________',11);
  T(118,y,'Signature of the Registering Authority',10.5); y+=14;
  y=ROW(y,'To, The Financier :  ','',8);
  T(15,y,'( To be sent by registered post acknowledgement due )',9); y+=12;
  y=WRAP(15,y,'Specimen signature or thumb-impression of the person to be registered as Registered Owner and the Financier are to be obtained in the original application for affixing and attestation by the Registering Authority with office seal in Forms 23 and 24, in such a manner that part of the impression of the seal or stamp and attestation shall fall upon each signature.',180,9.5);
  y+=12;
  doc.setFont(F,'bold');doc.setFontSize(10.5);
  doc.text('Specimen signature of the Financier',15,y);
  doc.text('Specimen signature of the Registered Owner',112,y); y+=12;
  doc.setFont(F,'normal');doc.setFontSize(11);
  doc.text('(1)',15,y); dline(doc,25,y+0.6,92);
  doc.text('(1)',112,y); dline(doc,122,y+0.6,193); y+=14;
  doc.text('(2)',15,y); dline(doc,25,y+0.6,92);
  doc.text('(2)',112,y); dline(doc,122,y+0.6,193);
}

/* ── FORM 21 — SALE CERTIFICATE (official Parts I–IV) ── */
function addForm21(doc,d){
  center(doc,14,'FORM 21',14,true);
  center(doc,20,'[ Refer Rule 47(a) and (d) ]',9);
  center(doc,26,'SALE CERTIFICATE',12,true);
  let y=31;
  y=wrap(doc,15,y,'To be issued by manufacturer or dealer or registered E-rickshaw or E-cart Association ( in case of E-rickshaw or E-cart ) or officer of Defence Department ( in case of military auctioned vehicles ) for presentation along with the application for registration of a motor vehicle.',178,8);
  doc.setLineWidth(0.3);doc.line(15,y,195,y); y+=7;

  bold(doc,15,y,'Part I :  In case of application for registration of fully built motor vehicle made by owner',9.5); y+=6;
  normal(doc,15,y,'Certified that ');
  let x=15+doc.getTextWidth('Certified that ');
  dline(doc,x,y+0.5,110); bold(doc,x+2,y,(d.make+' '+d.model).trim());
  normal(doc,112,y,' ( brand name ) has been delivered'); y+=7;
  normal(doc,15,y,'by us to ');
  x=15+doc.getTextWidth('by us to ');
  dline(doc,x,y+0.5,120); bold(doc,x+2,y,d.b_name);
  normal(doc,124,y,' on ');
  x=124+doc.getTextWidth(' on ');
  dline(doc,x,y+0.5,193);
  normal(doc,180,y,'( date )',8); y+=9;

  bold(doc,15,y,'Part II :  In case of application for registration of fully built motor vehicle made by dealer',9.5); y+=6;
  y=wrap(doc,15,y,'Certified that the above vehicle has been agreed to be sold by us on the date noted and will be delivered only after the registration mark assigned by the registering authority under Section 41(6) is displayed on the motor vehicle as per proviso to sub-section (6) of Section 41.',178,9);
  y+=3;

  bold(doc,15,y,'Part III :  In case of purchase of chassis',9.5); y+=6;
  normal(doc,15,y,'Certified that the chassis has been temporarily delivered by us on ');
  x=15+doc.getTextWidth('Certified that the chassis has been temporarily delivered by us on ');
  dline(doc,x,y+0.5,193); y+=9;

  bold(doc,15,y,'Part IV :  Applicable in case of Part I, Part II and Part III',9.5); y+=7;
  y=lrow(doc,y,'Name of the buyer:  ',d.b_name);
  y=lrow(doc,y,'Mobile number:  ','');
  y=lrow(doc,y,'Son / wife / daughter of:  ',d.b_father);
  y=lrow(doc,y,'Address ( permanent ):  ',d.b_addr+(d.b_town?', '+d.b_town:'')+(d.b_dist?', Dist. '+d.b_dist:''));
  y=lrow(doc,y,'Address ( temporary ):  ','');
  y=lrow(doc,y,'The vehicle is held under agreement of HP / lease / hypothecation with:  ','');
  y+=2;
  bold(doc,15,y,'The details of the vehicle are given below :',10); y+=7;
  y=lrowPair(doc,y,'1.  Class of vehicle:  ',d.veh_type,'2.  Maker\'s name:  ',d.make);
  y=lrowPair(doc,y,'3.  Chassis No.:  ',d.ch_no,'4.  Engine / Motor No.:  ',d.eng_no);
  y=lrowPair(doc,y,'5.  Horse power / cubic capacity:  ','','6.  Fuel used:  ','');
  y=lrowPair(doc,y,'7.  Number of cylinders:  ','','8.  Month & year of manufacture:  ',d.model);
  y=lrowPair(doc,y,'9.  Seating capacity ( incl. driver ):  ','','10. Unladen weight:  ','');
  y=lrowPair(doc,y,'9A. Standing capacity:  ','','9B. Sleeper capacity:  ','');
  normal(doc,15,y,'11. Maximum axle weight and number & description of tyres ( transport vehicle ):'); y+=7;
  y=lrowPair(doc,y,'      (a) Front axle:  ','','(b) Rear axle:  ','');
  y=lrowPair(doc,y,'      (c) Any other axle:  ','','(d) Tandem axle:  ','');
  y=lrowPair(doc,y,'12. Colour or colours of the body:  ','','13. Gross vehicle weight:  ','');
  y=lrow(doc,y,'14. Type of body:  ','');
  normal(doc,15,y,'* Strike out whichever is inapplicable.',8.5); y+=12;
  dline(doc,110,y,193); y+=5;
  normal(doc,110,y,'Signature of the manufacturer or dealer or officer of',8.5); y+=4.5;
  normal(doc,110,y,'Defence Department or registered E-rickshaw / E-cart Association',8.5);
}

/* ── FORM 22 — ROADWORTHINESS (official, with emission table) ── */
function addForm22(doc,d){
  center(doc,14,'FORM 22',14,true);
  center(doc,20,'[ Refer rule 47(1)(g) ]',9);
  center(doc,26,'ROAD-WORTHINESS CERTIFICATE',12,true);
  center(doc,31,'For Compliance to Emission and Noise Standards',9.5);
  let y=36;
  y=wrap(doc,15,y,'( To be issued by the Manufacturer or Importer or Registered Association in case of E-rickshaw or E-cart, along with the vehicle )',178,8);
  doc.setLineWidth(0.3);doc.line(15,y,195,y); y+=6;
  y=wrap(doc,15,y,'It is certified that the following vehicle complies with the provisions of the Motor Vehicles Act, 1988, and the rules made thereunder :',178,10.5);
  y+=3;
  y=lrow(doc,y,'1.  Model / Commercial name of the vehicle:  ',(d.make+' '+d.model).trim());
  y=lrow(doc,y,'2.  Chassis number ( VIN / ATIN / PIN / Trailer Identification No. ):  ',d.ch_no);
  y=lrow(doc,y,'3.  Engine number ( Motor No. for Battery-Operated Vehicles ):  ',d.eng_no);
  y=lrow(doc,y,'4.  Applicable emission norms ( e.g. BS-IV / BS-VI / TREM-III; NA for BOV ):  ','');
  y+=1;
  y=wrap(doc,15,y,'5.  Emission, sound level for horn and pass-by noise values of the above vehicle model, obtained during Type Approval Testing as per Central Motor Vehicle Rules, 1989, are given below :',178,10);
  y+=2;
  y=lrowPair(doc,y,'(i)  Type Approval certificate No.:  ','','(ii)  Type of fuel:  ','');
  normal(doc,15,y,'(iii)  Emission values for vehicles :'); y+=5;

  /* emission table */
  const rows=[
    ['1.','Carbon Monoxide (CO)','mg/km or mg/kWh or g/kWh'],
    ['2.','Hydrocarbon (THC / HC)','mg/km or mg/kWh or g/kWh'],
    ['3.','Non-Methane Hydrocarbon (NMHC)','mg/km or mg/kWh or g/kWh'],
    ['4.','Oxides of Nitrogen (NOx)','mg/km or mg/kWh or g/kWh'],
    ['5a.','HC + NOx','mg/km or mg/kWh or g/kWh'],
    ['5b.','THC + NOx','mg/km or mg/kWh'],
    ['6.','Methane (CH4)','mg/kWh'],
    ['7.','Ammonia (NH3)','PPM'],
    ['8.','Mass of Particulate Matter (PM)','mg/km or mg/kWh or g/kWh'],
    ['9.','Number of Particles (PN)','Numbers/km or Numbers/kWh'],
  ];
  const tx=15, tw=180, c1=12, c2=72, c3=62, c4=tw-c1-c2-c3, rh=7;
  doc.setLineWidth(0.3);
  // header row
  doc.rect(tx,y,c1,rh); doc.rect(tx+c1,y,c2,rh); doc.rect(tx+c1+c2,y,c3,rh); doc.rect(tx+c1+c2+c3,y,c4,rh);
  doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('Sr.',tx+2,y+4.7); doc.text('Pollutant ( as applicable )',tx+c1+2,y+4.7);
  doc.text('Units ( as applicable )',tx+c1+c2+2,y+4.7); doc.text('Value',tx+c1+c2+c3+2,y+4.7);
  doc.setFont('helvetica','normal');
  y+=rh;
  rows.forEach(r=>{
    doc.rect(tx,y,c1,rh); doc.rect(tx+c1,y,c2,rh); doc.rect(tx+c1+c2,y,c3,rh); doc.rect(tx+c1+c2+c3,y,c4,rh);
    doc.setFontSize(8);
    doc.text(r[0],tx+2,y+4.7); doc.text(r[1],tx+c1+2,y+4.7); doc.text(r[2],tx+c1+c2+2,y+4.7);
    y+=rh;
  });
  y+=5;

  normal(doc,15,y,'(iv)  Noise level ( as applicable ) :',10); y+=7;
  normal(doc,22,y,'(a)  Horn ( as installed on the vehicle ): ');
  let nx=22+doc.getTextWidth('(a)  Horn ( as installed on the vehicle ): ');
  dline(doc,nx,y+0.5,150); normal(doc,154,y,'dB(A)'); y+=7;
  normal(doc,22,y,'(b)  Pass-by or Bystander\'s position: ');
  nx=22+doc.getTextWidth('(b)  Pass-by or Bystander\'s position: ');
  dline(doc,nx,y+0.5,150); normal(doc,154,y,'dB(A)'); y+=7;
  normal(doc,22,y,'(c)  Driver-perceived / Operator\'s ear level ( tractors & CEV ): ');
  nx=22+doc.getTextWidth('(c)  Driver-perceived / Operator\'s ear level ( tractors & CEV ): ');
  dline(doc,nx,y+0.5,150); normal(doc,154,y,'dB(A)'); y+=12;

  dline(doc,105,y,193); y+=5;
  normal(doc,105,y,'( Facsimile Signature of Manufacturer or Importer or',8.5); y+=4.5;
  normal(doc,105,y,'Registered Association, in case of E-rickshaw or E-cart )',8.5); y+=8;
  y=wrap(doc,15,y,'Note 1 : This Form shall be issued with the signature of the manufacturer / importer / registered association duly printed in the Form itself by affixing facsimile signature in ink under the hand and seal, as applicable.',178,7.5);
  y=wrap(doc,15,y,'Note 2 : In case of multiple combinations, values pertaining to any one test result in the test report to be provided.',178,7.5);
  y=wrap(doc,15,y,'Note 3 : While printing Form 22, only the relevant pollutants applicable for the subject vehicle may be listed.',178,7.5);
}

/* ── GENERIC FORM ENGINE ── */
function addGeneric(doc,d,def){
  let y=16;
  center(doc,y,'FORM - '+def.n,15,true); y+=6;
  center(doc,y,'[ '+def.rule+' ]',9.5); y+=6;
  doc.setFont('helvetica','bold');doc.setFontSize(10.5);
  doc.splitTextToSize(def.title,178).forEach(t=>{doc.text(t,105,y,{align:'center'});y+=5;});
  doc.setFont('helvetica','normal');
  doc.setLineWidth(0.3);doc.line(15,y,195,y); y+=8;
  normal(doc,15,y,'To,'); y+=5;
  normal(doc,15,y,'The Registering Authority'); y+=6;
  y=lrow(doc,y,'',d.rto); y+=2;
  const nm=def.useBuyer?d.b_name:d.s_name, fa=def.useBuyer?d.b_father:d.s_father;
  const ad=(def.useBuyer?d.b_addr:d.s_addr)+((def.useBuyer?d.b_town:d.s_town)?', '+(def.useBuyer?d.b_town:d.s_town):'')+((def.useBuyer?d.b_dist:d.s_dist)?', Dist. '+(def.useBuyer?d.b_dist:d.s_dist):'');
  normal(doc,15,y,'I / We ');
  let x=15+doc.getTextWidth('I / We ');
  dline(doc,x,y+0.5,118); bold(doc,x+2,y,nm);
  normal(doc,120,y,' S/o ');
  x=120+doc.getTextWidth(' S/o ');
  dline(doc,x,y+0.5,193); bold(doc,x+2,y,fa); y+=8;
  y=lrow(doc,y,'resident of:  ',ad); y+=2;
  const intro=typeof def.intro==='function'?def.intro(d):def.intro;
  if(intro){ y=wrap(doc,15,y,intro,178,11); y+=3; }
  if(def.vehicle){
    y=lrowPair(doc,y,'Registration mark:  ',d.reg_no,'Vehicle type:  ',d.veh_type);
    y=lrowPair(doc,y,'Chassis No.:  ',d.ch_no,'Engine No.:  ',d.eng_no);
    y=lrow(doc,y,'Make / Model:  ',(d.make+' '+d.model).trim()); y+=2;
  }
  (def.blanks||[]).forEach(b=>{
    normal(doc,15,y,b);
    const bx=15+doc.getTextWidth(b)+2;
    dline(doc,bx,y+0.5,193); y+=8;
  });
  if(def.decl&&def.decl.length){
    bold(doc,15,y,'I / We hereby declare that:',11); y+=8;
    def.decl.forEach((t,i)=>{ y=wrap(doc,25,y,(i+1)+'.  '+t,168,11); y+=2; });
    y+=2;
  }
  if(def.req){ y=wrap(doc,15,y,def.req,178,11); y+=4; }
  y+=6;
  normal(doc,15,y,'Date: _____________________');
  normal(doc,120,y,'(S)  ('); dline(doc,133,y+0.5,188); normal(doc,190,y,')'); y+=5;
  normal(doc,120,y,def.sign||'Signature of Applicant');
  if(def.sign2){ y+=10; normal(doc,120,y,'(S)  ('); dline(doc,133,y+0.5,188); normal(doc,190,y,')'); y+=5; normal(doc,120,y,def.sign2); }
  y+=12;
  if(def.endorse!==false && y<255){
    y=secline(doc,y,'OFFICE  ENDORSEMENT'); y+=3;
    y=wrap(doc,15,y,def.endText||'Received, verified and entered in the records of this office.',178,11); y+=4;
    y=lrowPair(doc,y,'No.:  ','','Date:  ',''); y+=10;
    normal(doc,120,y,'Registering Authority'); y+=5;
    normal(doc,120,y,'(Office Seal)');
  }
}

const DEFS={
 f1:{n:'1',rule:'See Rule 5(1)',title:'APPLICATION-CUM-DECLARATION AS TO PHYSICAL FITNESS',
   decl:['I am not suffering from any disease or disability likely to affect my driving.','My eyesight (with glasses, if worn) meets the prescribed standard and I can readily distinguish red and green colours.','I am not subject to epilepsy, giddiness or fainting.','I have not been disqualified from holding a licence.'],
   req:'I declare the statements above to be true and apply accordingly.',sign:'Signature / Thumb impression of Applicant',endorse:false},
 f2:{n:'2',rule:'Rules 10, 14, 17 and 18',title:'APPLICATION FOR LEARNER\'S LICENCE / DRIVING LICENCE / ADDITION OF A NEW CLASS / RENEWAL',
   blanks:['Class of vehicle applied for:  ','Date of birth:  ','Blood group:  ','Existing LL / DL No. (if any):  '],
   decl:['Medical declaration in Form 1 / certificate in Form 1A is enclosed where required.','I have not been disqualified from obtaining a licence.'],
   req:'I request that the licence may be granted / renewed accordingly.',sign:'Signature / Thumb impression of Applicant'},
 f4A:{n:'4A',rule:'See Rule 15A',title:'APPLICATION FOR INTERNATIONAL DRIVING PERMIT',
   blanks:['Valid Driving Licence No.:  ','Passport No. and validity:  ','Countries to be visited:  ','Period of stay abroad:  '],
   decl:['My driving licence is valid and has not been suspended or revoked.'],
   req:'I request that an International Driving Permit may kindly be granted.'},
 f8:{n:'8',rule:'See Rule 17(1)',title:'APPLICATION FOR ADDITION OF A NEW CLASS OF VEHICLE TO A DRIVING LICENCE',
   blanks:['Existing Driving Licence No.:  ','New class of vehicle applied for:  '],
   decl:['I hold an effective driving licence.','Form 1 / 1A is enclosed where required.'],
   req:'I request that the new class may be added to my driving licence.'},
 f9:{n:'9',rule:'See Rule 18',title:'APPLICATION FOR RENEWAL OF DRIVING LICENCE',
   blanks:['Driving Licence No.:  ','Date of expiry:  '],
   decl:['The licence has not been suspended or revoked.','Medical certificate in Form 1A is enclosed (where applicable).'],
   req:'I request that my driving licence may kindly be renewed.'},
 fLLD:{n:'LLD',rule:'CMV Rules 1989',title:'APPLICATION FOR DUPLICATE LEARNER\'S LICENCE / DRIVING LICENCE',
   blanks:['Licence No.:  ','Issued by (RTO):  ','Reason — lost / destroyed / torn (strike out):  ','Police report lodged at P.S.:  '],
   decl:['The licence has not been impounded or suspended by any authority.'],
   req:'I request that a duplicate licence may kindly be issued.'},
 f16:{n:'16',rule:'See Rule 34',title:'APPLICATION FOR GRANT OF TRADE CERTIFICATE',
   blanks:['Name and full address of business:  ','Business type — dealer / manufacturer / body builder:  ','Number of trade certificates required:  '],
   req:'I / We request that trade certificate(s) may kindly be granted.',sign:'Signature of Applicant with designation'},
 f20:{n:'20',rule:'See Rule 47',title:'APPLICATION FOR REGISTRATION OF A MOTOR VEHICLE',vehicle:true,
   blanks:['Colour of vehicle:  ','Date of delivery:  ','Insurance policy No. and validity:  ','Temporary registration No. (if any):  '],
   decl:['The vehicle has not been registered earlier with any registering authority.','Sale certificate (Form 21) and roadworthiness certificate (Form 22) are enclosed.'],
   req:'I / We request that the vehicle may be registered and a registration mark assigned.',sign:'Signature of Owner'},
 f21:{n:'21',rule:'See Rule 47',title:'SALE CERTIFICATE',vehicle:true,useBuyer:false,
   intro:function(d){return 'Certified that the vehicle described below has been delivered by us on (date) ____________ to Shri/Smt. '+(d.b_name||'____________')+', resident of '+((d.b_addr||'')+(d.b_town?', '+d.b_town:'')||'____________')+':';},
   decl:['The vehicle is brand new / unregistered at the time of sale.'],sign:'Signature of Dealer / Manufacturer',endorse:false},
 f27:{n:'27',rule:'See Rule 54',title:'APPLICATION FOR ASSIGNMENT OF A NEW REGISTRATION MARK',vehicle:true,
   blanks:['Previous registering authority:  ','No Objection Certificate No. and date:  '],
   decl:['The vehicle has migrated to the jurisdiction of the above registering authority.'],
   req:'I / We request that a new registration mark may be assigned to the vehicle.',sign:'Signature of Owner'},
 f31:{n:'31',rule:'See Rule 56',title:'APPLICATION FOR TRANSFER OF OWNERSHIP — DEATH OF REGISTERED OWNER',vehicle:true,
   blanks:['Name of deceased registered owner:  ','Date of death:  ','Relationship of applicant with deceased:  '],
   decl:['I am the lawful successor of the deceased registered owner.','Death certificate and proof of succession are enclosed.'],
   req:'I request that the ownership of the vehicle may be transferred in my name.',sign:'Signature of Applicant (Successor)'},
 f32:{n:'32',rule:'See Rule 57',title:'APPLICATION FOR TRANSFER OF OWNERSHIP — VEHICLE PURCHASED IN PUBLIC AUCTION',vehicle:true,
   blanks:['Auction conducted by (authority):  ','Auction order / lot No. and date:  '],
   decl:['A certified copy of the auction order is enclosed.'],
   req:'I request that the ownership of the vehicle may be transferred in my name.',sign:'Signature of Purchaser'},
 f33:{n:'33',rule:'See Rule 59',title:'INTIMATION OF CHANGE OF ADDRESS — CERTIFICATE OF REGISTRATION',vehicle:true,
   blanks:['New address:  ','(continued):  '],
   decl:['The certificate of registration is enclosed for endorsement of the new address.','Proof of the new address is enclosed.'],
   req:'I request that the new address may be recorded in the certificate of registration.',sign:'Signature of Owner'},
 f34:{n:'34',rule:'See Rule 60',title:'APPLICATION FOR ENDORSEMENT OF HIRE-PURCHASE / LEASE / HYPOTHECATION',vehicle:true,
   blanks:['Name and address of financier:  ','Date of agreement:  '],
   decl:['The vehicle is held under an agreement of hire-purchase / lease / hypothecation with the above financier.'],
   req:'We jointly request that the agreement may be endorsed in the certificate of registration.',
   sign:'Signature of Registered Owner',sign2:'Signature of Financier'},
 f35:{n:'35',rule:'See Rule 61',title:'NOTICE OF TERMINATION OF HIRE-PURCHASE / LEASE / HYPOTHECATION',vehicle:true,
   blanks:['Name and address of financier:  ','Date of agreement:  '],
   decl:['The agreement between us has been terminated.'],
   req:'We jointly request that the endorsement may be cancelled in the certificate of registration.',
   sign:'Signature of Registered Owner',sign2:'Signature of Financier'},
 f36:{n:'36',rule:'See Rule 61(2)',title:'APPLICATION BY FINANCIER FOR ISSUE OF FRESH CERTIFICATE OF REGISTRATION',vehicle:true,
   blanks:['Name and address of financier:  ','Date of taking possession of the vehicle:  '],
   decl:['Possession of the vehicle has been taken under the terms of the agreement.','Due notice has been given to the registered owner.'],
   req:'I / We request that a fresh certificate of registration may be issued in the name of the financier.',sign:'Signature of Financier'},
 f45:{n:'45',rule:'See Rule 82',title:'APPLICATION FOR GRANT OF TOURIST PERMIT',vehicle:true,
   blanks:['Region / area of operation:  ','Seating capacity:  '],
   decl:['The vehicle conforms to the prescribed specifications for tourist vehicles.'],
   req:'I / We request that a tourist permit may kindly be granted.',sign:'Signature of Applicant'},
 f46:{n:'46',rule:'See Rule 86',title:'APPLICATION FOR GRANT OF NATIONAL PERMIT — GOODS CARRIAGE',vehicle:true,
   blanks:['Home state:  ','States of operation:  ','Gross vehicle weight:  '],
   decl:['Valid fitness, insurance and tax documents are enclosed.'],
   req:'I / We request that a national permit may kindly be granted.',sign:'Signature of Applicant'},
 f48:{n:'48',rule:'See Rule 83',title:'APPLICATION FOR AUTHORISATION — TOURIST PERMIT',vehicle:true,
   blanks:['Tourist permit No. and validity:  '],
   decl:['The permit is valid and the vehicle complies with all conditions.'],
   req:'I / We request that authorisation may kindly be granted.',sign:'Signature of Permit Holder'},
};
const G=k=>(doc,d)=>addGeneric(doc,d,DEFS[k]);

