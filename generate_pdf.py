from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit
from PyPDF2 import PdfMerger
import io

W, H = A4
LM = 18*mm
RM = W - 18*mm
TW = RM - LM
FS = 11      # body font size
LS = 13      # line step (tight)
LS2 = 14     # slightly more space

def dot(c, x1, y, x2):
    c.setDash([1,2]); c.setLineWidth(0.5)
    c.line(x1, y-1, x2, y-1)
    c.setDash([]); c.setLineWidth(0.5)

def fdot(c, y, val=""):
    dot(c, LM, y, RM)
    if val:
        c.setFont("Helvetica-Bold", FS)
        c.drawString(LM+2, y+1, str(val))

def t(c, x, y, s, sz=None, bold=False):
    sz = sz or FS
    c.setFont("Helvetica-Bold" if bold else "Helvetica", sz)
    c.drawString(x, y, str(s))
    return c.stringWidth(str(s), "Helvetica-Bold" if bold else "Helvetica", sz)

def ct(c, y, s, sz=None, bold=False):
    sz = sz or FS
    c.setFont("Helvetica-Bold" if bold else "Helvetica", sz)
    c.drawCentredString(W/2, y, str(s))

def sw(c, s, sz=None, bold=False):
    sz = sz or FS
    return c.stringWidth(str(s), "Helvetica-Bold" if bold else "Helvetica", sz)

def fl(c, label, val, x, y, w):
    """label + dotted line + bold value, returns x after line"""
    c.setFont("Helvetica", FS)
    lw = sw(c, label)
    c.drawString(x, y, label)
    dot(c, x+lw+1, y, x+lw+1+w)
    if val:
        c.setFont("Helvetica-Bold", FS)
        c.drawString(x+lw+3, y+1, str(val))
    return x+lw+2+w

def nlines(c, y, text, sz=9):
    c.setFont("Helvetica", sz)
    lines = simpleSplit(text, "Helvetica", sz, TW)
    for l in lines:
        c.drawString(LM, y, l); y -= sz+3
    return y

# ════════ FORM 29 ════════
def form29(d):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = H - 12*mm

    ct(c, y, "FORM - 29", 15, True); y -= 16
    ct(c, y, "[ See Rule 55 (1) ]", 10); y -= 14
    ct(c, y, "FORM OF NOTICE OF TRANSFER OF OWNERSHIP OF A MOTOR VEHICLE", 11, True); y -= 14
    y = nlines(c, y, "( To be made in duplicate and the duplicate copy with endorsement of the registering authority to be returned to the transferer immediately on making entries of transfer of ownership)", 9)
    y -= 3

    t(c, LM, y, "To,"); y -= LS
    t(c, LM, y, "The Registering Authority"); y -= LS
    fdot(c, y, d.get('rto',''))
    c.setFont("Helvetica", 8)
    c.drawRightString(RM, y+2, "(in whose jurisdiction the transferee residence)")
    y -= LS

    x = fl(c, "I/We", d.get('seller_name',''), LM, y, 220)
    t(c, x, y, "residing"); y -= LS

    x = fl(c, "at", d.get('seller_addr',''), LM, y, 230)
    x = fl(c, "have on the ", d.get('sale_day',''), x, y, 28)
    t(c, x, y, "sold and delivery my/our"); y -= LS

    x = fl(c, "day of the year", d.get('sale_year',''), LM, y, 35)
    x = fl(c, "  Vehicle No.", d.get('reg_no',''), x, y, 95)
    fl(c, "  Make", d.get('make',''), x, y, RM-x-35); y -= LS

    x = fl(c, "Chassis No.", d.get('chassis_no',''), LM, y, 165)
    fl(c, "  Engine No.", d.get('engine_no',''), x, y, RM-x-10); y -= LS

    x = fl(c, "Sr./Smt.", d.get('buyer_name',''), LM, y, 210)
    t(c, x, y, "(Name), Son/Wife/Daughter"); y -= LS

    x = fl(c, "of", d.get('buyer_father',''), LM, y, 185)
    t(c, x, y, "residing at House No. Street, Village/"); y -= LS

    fdot(c, y, d.get('buyer_addr','')); y -= LS

    x = fl(c, "Town", d.get('buyer_town',''), LM, y, 105)
    x = fl(c, "  Dist.", d.get('buyer_dist',''), x, y, 105)
    fl(c, "  State", d.get('state','Jharkhand'), x, y, RM-x-10); y -= LS

    t(c, LM, y, "The registration certificate and insurance certificate have been handed over to him/her/them."); y -= LS2

    t(c, LM, y, "(P)")
    t(c, W/2+20, y, "(S)"); y -= LS
    t(c, W/2+20, y, "Signature of Registered Owner"); y -= LS
    t(c, W/2+20, y, "(Transferee)"); y -= LS2

    fl(c, "Date", "", LM, y, 110); y -= LS2
    x = fl(c, "I", d.get('seller_name',''), LM, y, 240)
    t(c, x, y, "Transferor)"); y -= LS

    t(c, LM, y, "Copy to the registered Authority in whose jurisdiction the transferor residence"); y -= LS
    t(c, LM, y, "Note :-", bold=True)
    c.setFont("Helvetica", 9)
    c.drawString(LM+45, y, "To be sent to Registered Authority by Regd. Acknowledgment due")
    y -= 14

    # Office endorsement
    c.setLineWidth(1); c.line(LM, y+8, RM, y+8)
    ct(c, y, "OFFICE  ENDORSEMENT", 12, True); y -= LS2

    x = fl(c, "No.", "", LM, y, 70)
    x = fl(c, "  Date", "", x, y, 80)
    fl(c, "  Office of the", "", x, y, RM-x-10); y -= LS

    t(c, LM, y, "The ownership of Vehicle has been transferred to the name of"); y -= LS
    fdot(c, y); y -= LS
    dot(c, LM, y, LM+200)
    t(c, LM+202, y, "with effect from")
    dot(c, LM+300, y, RM); y -= LS2

    t(c, LM, y, "(S)"); y -= LS
    t(c, LM, y, "(S)"); y -= LS2

    t(c, LM, y, "To"); y -= LS
    fdot(c, y); y -= LS; fdot(c, y); y -= LS; fdot(c, y); y -= LS
    t(c, LM, y, "(The Transferee)"); y -= LS2

    t(c, LM, y, "By registered post or under proper acknowledgement,")
    t(c, W/2+30, y, "Registering Authority"); y -= LS
    c.setFont("Helvetica", 9)
    c.drawString(LM, y, "*Strike our whichever is in applicable")
    t(c, W/2+30, y, "(Office Seal)")

    c.showPage(); c.save(); buf.seek(0)
    return buf.read()


# ════════ FORM 30 ════════
def form30(d):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = H - 12*mm

    ct(c, y, "FORM - 30", 15, True); y -= 16
    ct(c, y, "[ See Rule 56 (2) and (3) ]", 10); y -= 14
    ct(c, y, "REPORT OF TRANSFER OF OWNERSHIP OF A MOTOR VEHICLE", 11, True); y -= 14
    ct(c, y, "PART - 1   FOR THE USE OF THE TRANSFERER", 11, True); y -= 14
    y = nlines(c, y, "( To be made in duplicate and if the vehicle is held under an agreement of hire purchases / lease / hypothecation and the duplicate copy with the endorsement of the registering authority to be returned to the financer simultaneously on making the entry of transfer of ownership in the certificate of registration)", 9)
    y -= 4

    t(c, LM, y, "To,   The Registering Authority"); y -= 13
    fdot(c, y, d.get('rto','')); y -= 13

    fl(c, "Name of the Transferer", d.get('seller_name',''), LM, y, 230); y -= LS
    fl(c, "Son / Wife / Daughter of", d.get('seller_father',''), LM, y, 210); y -= LS
    fl(c, "Full Address", d.get('seller_addr',''), LM, y, 245); y -= LS

    x = fl(c, "      I hereby declare I / We have on this", d.get('sale_day',''), LM, y, 28)
    x = fl(c, " day of the year", d.get('sale_year',''), x, y, 35)
    t(c, x, y, " Sold my / our motor vehicle bearing registration"); y -= LS

    x = fl(c, "mark", d.get('reg_no',''), LM, y, 95)
    fl(c, "  to Shri / Smt.", d.get('buyer_name',''), x, y, 210); y -= LS

    fl(c, "Son / Wife / Daughter of", d.get('buyer_father',''), LM, y, 210); y -= LS
    fl(c, "residing at", d.get('buyer_addr',''), LM, y, 240); y -= LS

    y = nlines(c, y, "( Full address and handed over the certificate of registration and the certificate of insurance to him / her / them )", 9)
    y = nlines(c, y, "I / We hereby declare that to the best of my / Our knowledge the certificate of registration of the vehicle has been / has not been suspended or cancelled.", 9)
    y = nlines(c, y, "\u2756\u2756  I enclose the No. Objection Certificate issued by the Registering Authority.", 9)
    y = nlines(c, y, "\u2756\u2756  If the No Objection Certificate is not enclosed the transfer should file along with the application a declaration as required under sub-section (1) of section 50.", 9)
    y -= 5

    t(c, W/2+20, y, "(S)  (")
    dot(c, W/2+48, y, RM-2); t(c, RM-1, y, ")"); y -= LS
    t(c, W/2+20, y, "Signature of the Transfer"); y -= LS2
    fl(c, "Date", "", LM, y, 110); y -= LS
    y = nlines(c, y, "\u2756 Details of suspension or cancellation     \u2756 Strike out whichever is inapplicable", 9)
    y -= 5

    c.setLineWidth(1); c.line(LM, y+8, RM, y+8)
    ct(c, y, "PART - II   FOR THE USE OF TRANSFEREE", 11, True); y -= LS2

    t(c, LM, y, "To,   The Registering Authority"); y -= LS
    fdot(c, y, d.get('rto','')); y -= LS

    fl(c, "Name of the Transferee", d.get('buyer_name',''), LM, y, 220); y -= LS
    fl(c, "Son / Wife / Daughter of", d.get('buyer_father',''), LM, y, 210); y -= LS
    fl(c, "Full Address", d.get('buyer_addr',''), LM, y, 245); y -= LS

    x = fl(c, "      I hereby declare I / We have on this", d.get('sale_day',''), LM, y, 28)
    x = fl(c, " day of The year", d.get('sale_year',''), x, y, 35)
    t(c, x, y, " purchased the motor vehicle bearing registration"); y -= LS

    x = fl(c, "number", d.get('reg_no',''), LM, y, 95)
    fl(c, "  from", d.get('seller_name',''), x, y, 210); y -= LS
    fl(c, "Name and full address", d.get('seller_addr',''), LM, y, 215); y -= LS
    fdot(c, y); y -= LS
    ct(c, y, "( Name & full address )", 9); y -= LS

    y = nlines(c, y, "and request that necessary entries regarding the transfer of ownership of the vehicle in my / our name may be recorded in the Certificate of Registration Certificate of fitness of the vehicle which is enclosed")
    t(c, LM, y, "The Certificate of Insurance is also enclosed"); y -= LS
    t(c, LM, y, "Specimen Signature of the Transferee -"); y -= LS2

    t(c, LM, y, "(P) 1")
    t(c, W/2+20, y, "(P)  ("); dot(c, W/2+50, y, RM-2); t(c, RM-1, y, ")"); y -= LS2
    t(c, LM, y, "(P) 2")
    t(c, W/2+20, y, "Signature of the Transferee")

    c.showPage(); c.save(); buf.seek(0)
    return buf.read()


# ════════ AFFIDAVIT ════════
def affidavit(d, for_type="SELLER"):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = H - 15*mm

    # Stamp box
    c.setLineWidth(0.8)
    c.rect(RM-95, y-22, 95, 34)
    c.setFont("Helvetica", 8.5)
    c.drawCentredString(RM-47, y-6, "Affix here Court Fee")
    c.drawCentredString(RM-47, y-18, "Stamp Rs. 5 Only")

    ct(c, y, "AFFIDAVIT", 18, True); y -= 20
    ct(c, y, "(FOR "+for_type+")", 12); y -= 24

    x = fl(c, "I", d.get('dep_name',''), LM, y, 220)
    fl(c, "  S/o", d.get('dep_father',''), x, y, RM-x-10); y -= LS

    fl(c, "resident of", d.get('dep_addr',''), LM, y, 260); y -= LS

    x = fl(c, "Town", d.get('dep_town',''), LM, y, 120)
    x = fl(c, "  Dist.", d.get('dep_dist',''), x, y, 120)
    t(c, x, y, "  do hereby"); y -= LS

    t(c, LM, y, "Solemnly affirm and declared as follows :-"); y -= LS2

    if for_type == "SELLER":
        x = fl(c, "      That I sold my", d.get('veh_type','Motor Vehicle'), LM, y, 170)
        t(c, x, y, " bearing"); y -= LS
        x = fl(c, "Regd. No.", d.get('reg_no',''), LM, y, 115)
        fl(c, "  to Mr.", d.get('other_name',''), x, y, 190); y -= LS
    else:
        x = fl(c, "      That I have purchased my", d.get('veh_type','Motor Vehicle'), LM, y, 140)
        t(c, x, y, " bearing"); y -= LS
        x = fl(c, "Regd. No.", d.get('reg_no',''), LM, y, 115)
        fl(c, "  from Mr.", d.get('other_name',''), x, y, 185); y -= LS

    x = fl(c, "S/o", d.get('other_father',''), LM, y, 155)
    fl(c, "  resident of", d.get('other_addr',''), x, y, RM-x-10); y -= LS
    fdot(c, y); y -= LS

    x = fl(c, "      Town", d.get('other_town',''), LM, y, 120)
    fl(c, "  Dist.", d.get('other_dist',''), x, y, 120); y -= LS2

    t(c, LM+20, y, "That the said vehicle is not involved any civil or criminal cases"); y -= LS

    if for_type == "SELLER":
        y = nlines(c, y, "That I have got no objection if the ownership of the said vehicle is transferred in the name of the above purchaser.")
    else:
        t(c, LM, y, "That I will be responsible any dues of taxes of the said vehicle"); y -= LS
        y = nlines(c, y, "That kindly the ownership of the said vehicle is transferred in my name that the above seller")

    # Signature section at bottom — fixed position
    sy = 95

    # Left
    lx = LM
    t(c, lx, sy, "Solemnly affirmed and declare"); sy -= 13
    t(c, lx, sy, "before me to be true by the"); sy -= 13
    t(c, lx, sy, "doponent who is identified by"); sy -= 22
    fl(c, "Sri", "", lx, sy, 130); sy -= 22
    fl(c, "Advocate at", d.get('adv_at',''), lx, sy, 110); sy -= 28
    t(c, lx, sy, "NOTARY PUBLIC", bold=True)

    # Right
    rx = W/2 + 10
    ry = 95
    t(c, rx, ry, "Verification", bold=True); ry -= 13
    vt = "The statement made above are true to the best of my knowledge belief and information and I sign this affidavit at"
    vlines = simpleSplit(vt, "Helvetica", FS, TW/2-5)
    for l in vlines:
        t(c, rx, ry, l); ry -= 13
    fl(c, "", d.get('place',''), rx, ry, 65)
    t(c, rx+67, ry, "20")
    dot(c, rx+85, ry, RM); ry -= 24
    t(c, rx, ry, for_type.capitalize(), bold=True); ry -= 36
    t(c, rx, ry, "deponent"); ry -= 13
    t(c, rx, ry, "The deponent is known to me and his"); ry -= 13
    t(c, rx, ry, "Signed in my presence"); ry -= 22
    t(c, rx, ry, "Advocate.")

    c.showPage(); c.save(); buf.seek(0)
    return buf.read()


def generate_all(data):
    sa = dict(
        dep_name=data.get('seller_name',''), dep_father=data.get('seller_father',''),
        dep_addr=data.get('seller_addr',''), dep_town=data.get('seller_town',''),
        dep_dist=data.get('seller_dist',''), veh_type=data.get('vehicle_type','Motor Vehicle'),
        reg_no=data.get('reg_no',''), other_name=data.get('buyer_name',''),
        other_father=data.get('buyer_father',''), other_addr=data.get('buyer_addr',''),
        other_town=data.get('buyer_town',''), other_dist=data.get('buyer_dist',''),
        adv_at=data.get('advocate_at','Jamshedpur'), place=data.get('sign_place','Jamshedpur'),
    )
    ba = dict(
        dep_name=data.get('buyer_name',''), dep_father=data.get('buyer_father',''),
        dep_addr=data.get('buyer_addr',''), dep_town=data.get('buyer_town',''),
        dep_dist=data.get('buyer_dist',''), veh_type=data.get('vehicle_type','Motor Vehicle'),
        reg_no=data.get('reg_no',''), other_name=data.get('seller_name',''),
        other_father=data.get('seller_father',''), other_addr=data.get('seller_addr',''),
        other_town=data.get('seller_town',''), other_dist=data.get('seller_dist',''),
        adv_at=data.get('advocate_at','Jamshedpur'), place=data.get('sign_place','Jamshedpur'),
    )
    m = PdfMerger()
    m.append(io.BytesIO(form29(data)))
    m.append(io.BytesIO(form30(data)))
    m.append(io.BytesIO(affidavit(sa, "SELLER")))
    m.append(io.BytesIO(affidavit(ba, "PURCHASER")))
    out = io.BytesIO(); m.write(out); out.seek(0)
    return out.read()


if __name__ == "__main__":
    data = {
        'seller_name':'Ramesh Kumar Sharma','seller_father':'Mohan Lal Sharma',
        'seller_addr':'H.No. 45, Station Road, Jamshedpur','seller_town':'Jamshedpur',
        'seller_dist':'East Singhbhum','buyer_name':'Suresh Kumar Yadav',
        'buyer_father':'Ram Prasad Yadav','buyer_addr':'Village Rampur, NH-33',
        'buyer_town':'Baharagora','buyer_dist':'East Singhbhum',
        'vehicle_type':'Motor Car','reg_no':'JH05AB1234',
        'make':'Maruti Swift 2018','chassis_no':'MA3FJEB1S00123456',
        'engine_no':'K12M1234567','rto':'District Transport Office, Jamshedpur',
        'sale_day':'8','sale_year':'2026','state':'Jharkhand',
        'advocate_at':'Jamshedpur','sign_place':'Jamshedpur',
    }
    pdf = generate_all(data)
    with open('/home/claude/test_all_forms.pdf','wb') as f: f.write(pdf)
    print(f"Generated: {len(pdf)} bytes")
