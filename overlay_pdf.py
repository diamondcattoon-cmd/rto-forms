"""
RTO Forms PDF Generator
Uses scanned original forms as background templates.
Overlays user data at exact coordinates.

Page order in scanned PDF:
  0 = Form 29
  1 = Affidavit Seller
  2 = Affidavit Purchaser
  3 = Form 30

Output order: Form29, Form30, Aff.Seller, Aff.Purchaser
"""

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from pdfrw import PdfReader, PdfWriter, PageMerge
import io

W, H = 595.0, 842.0   # exact scanned page size

TEMPLATE_PATH = '/mnt/user-data/uploads/New_Doc_06-08-2026_15_21.pdf'

def make_overlay(draw_fn):
    """Create a transparent PDF overlay using reportlab, return bytes"""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(W, H))
    c.setFont("Helvetica-Bold", 10)
    draw_fn(c)
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()

def merge_overlay_on_template(template_page, overlay_bytes):
    """Merge overlay PDF onto template page"""
    overlay_pdf = PdfReader(io.BytesIO(overlay_bytes))
    overlay_page = overlay_pdf.pages[0]
    merger = PageMerge(template_page)
    merger.add(overlay_page).render()
    return template_page

def txt(c, x, y, s, size=10, bold=True):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, y, str(s))

# ═══════════════════════════════════════════════
# FORM 29 OVERLAY COORDINATES
# (x from left edge, y from bottom of page)
# ═══════════════════════════════════════════════
def overlay_form29(c, d):
    # RTO office name
    txt(c, 57, 638, d.get('rto', ''))

    # I/We — seller name
    txt(c, 82, 611, d.get('seller_name', ''))

    # at — seller address | have on the — day
    txt(c, 37, 598, d.get('seller_addr', ''))
    txt(c, 370, 598, d.get('sale_day', ''))

    # day of year | Vehicle No | Make
    txt(c, 150, 585, d.get('sale_year', ''))
    txt(c, 285, 585, d.get('reg_no', ''))
    txt(c, 450, 585, d.get('make', ''))

    # Chassis No | Engine No
    txt(c, 130, 572, d.get('chassis_no', ''))
    txt(c, 390, 572, d.get('engine_no', ''))

    # Sr./Smt. — buyer name
    txt(c, 100, 559, d.get('buyer_name', ''))

    # of — buyer father
    txt(c, 37, 546, d.get('buyer_father', ''))

    # full address line
    txt(c, 57, 530, d.get('buyer_addr', ''))

    # Town | Dist | State
    txt(c, 80, 517, d.get('buyer_town', ''))
    txt(c, 245, 517, d.get('buyer_dist', ''))
    txt(c, 425, 517, d.get('state', 'Jharkhand'))

    # I...Transferor line — seller name again
    txt(c, 40, 434, d.get('seller_name', ''))


# ═══════════════════════════════════════════════
# FORM 30 OVERLAY COORDINATES
# ═══════════════════════════════════════════════
def overlay_form30(c, d):
    # PART 1 — TRANSFERER section
    # Name of Transferer
    txt(c, 195, 637, d.get('seller_name', ''))
    # Son/Wife/Daughter of
    txt(c, 195, 623, d.get('seller_father', ''))
    # Full Address
    txt(c, 145, 609, d.get('seller_addr', ''))

    # I hereby declare — day | year
    txt(c, 340, 582, d.get('sale_day', ''))
    txt(c, 90,  568, d.get('sale_year', ''))

    # mark — reg no | to Shri/Smt — buyer name
    txt(c, 80,  555, d.get('reg_no', ''))
    txt(c, 265, 555, d.get('buyer_name', ''))

    # Son/Wife/Daughter of buyer
    txt(c, 195, 541, d.get('buyer_father', ''))

    # residing at buyer address
    txt(c, 130, 527, d.get('buyer_addr', ''))

    # PART 2 — TRANSFEREE section
    # Name of Transferee
    txt(c, 195, 330, d.get('buyer_name', ''))
    # Son/Wife/Daughter of
    txt(c, 195, 316, d.get('buyer_father', ''))
    # Full Address
    txt(c, 145, 302, d.get('buyer_addr', ''))

    # I hereby declare — day | year
    txt(c, 360, 275, d.get('sale_day', ''))
    txt(c, 90,  261, d.get('sale_year', ''))

    # number — reg no | from — seller name
    txt(c, 90,  247, d.get('reg_no', ''))
    txt(c, 270, 247, d.get('seller_name', ''))

    # Name and full address of seller
    txt(c, 195, 233, d.get('seller_addr', ''))


# ═══════════════════════════════════════════════
# AFFIDAVIT OVERLAY (same layout for both)
# ═══════════════════════════════════════════════
def overlay_affidavit(c, d, for_type="SELLER"):
    # I — deponent name | S/o
    txt(c, 40,  638, d.get('dep_name', ''))
    txt(c, 390, 638, d.get('dep_father', ''))

    # resident of
    txt(c, 130, 613, d.get('dep_addr', ''))

    # Town | Dist
    txt(c, 80,  590, d.get('dep_town', ''))
    txt(c, 290, 590, d.get('dep_dist', ''))

    # That I sold/purchased my — vehicle type
    txt(c, 220, 543, d.get('veh_type', 'Motor Vehicle'))

    # Regd. No | to/from Mr
    txt(c, 120, 518, d.get('reg_no', ''))
    txt(c, 355, 518, d.get('other_name', ''))

    # S/o other | resident of other
    txt(c, 60,  495, d.get('other_father', ''))
    txt(c, 270, 495, d.get('other_addr', ''))

    # Town | Dist of other
    txt(c, 90,  465, d.get('other_town', ''))
    txt(c, 290, 465, d.get('other_dist', ''))

    # Verification — sign place + year
    txt(c, 340, 248, d.get('place', 'Jamshedpur'))

    # Advocate at
    txt(c, 120, 195, d.get('adv_at', 'Jamshedpur'))


# ═══════════════════════════════════════════════
# MAIN: Generate all 4 forms
# ═══════════════════════════════════════════════
def generate_all(data):
    templates = PdfReader(TEMPLATE_PATH)

    # Template page order: 0=F29, 1=AffSeller, 2=AffPurchaser, 3=F30
    # Output order: F29, F30, AffSeller, AffPurchaser

    # Seller affidavit data
    sa = dict(
        dep_name=data.get('seller_name',''), dep_father=data.get('seller_father',''),
        dep_addr=data.get('seller_addr',''), dep_town=data.get('seller_town',''),
        dep_dist=data.get('seller_dist',''), veh_type=data.get('vehicle_type','Motor Vehicle'),
        reg_no=data.get('reg_no',''), other_name=data.get('buyer_name',''),
        other_father=data.get('buyer_father',''), other_addr=data.get('buyer_addr',''),
        other_town=data.get('buyer_town',''), other_dist=data.get('buyer_dist',''),
        adv_at=data.get('advocate_at','Jamshedpur'), place=data.get('sign_place','Jamshedpur'),
    )
    # Buyer affidavit data
    ba = dict(
        dep_name=data.get('buyer_name',''), dep_father=data.get('buyer_father',''),
        dep_addr=data.get('buyer_addr',''), dep_town=data.get('buyer_town',''),
        dep_dist=data.get('buyer_dist',''), veh_type=data.get('vehicle_type','Motor Vehicle'),
        reg_no=data.get('reg_no',''), other_name=data.get('seller_name',''),
        other_father=data.get('seller_father',''), other_addr=data.get('seller_addr',''),
        other_town=data.get('seller_town',''), other_dist=data.get('seller_dist',''),
        adv_at=data.get('advocate_at','Jamshedpur'), place=data.get('sign_place','Jamshedpur'),
    )

    writer = PdfWriter()

    # Page 1: Form 29
    p29 = templates.pages[0]
    ov29 = make_overlay(lambda c: overlay_form29(c, data))
    merge_overlay_on_template(p29, ov29)
    writer.addpage(p29)

    # Page 2: Form 30
    p30 = templates.pages[3]
    ov30 = make_overlay(lambda c: overlay_form30(c, data))
    merge_overlay_on_template(p30, ov30)
    writer.addpage(p30)

    # Page 3: Affidavit Seller
    pAS = templates.pages[1]
    ovAS = make_overlay(lambda c: overlay_affidavit(c, sa, "SELLER"))
    merge_overlay_on_template(pAS, ovAS)
    writer.addpage(pAS)

    # Page 4: Affidavit Purchaser
    pAB = templates.pages[2]
    ovAB = make_overlay(lambda c: overlay_affidavit(c, ba, "PURCHASER"))
    merge_overlay_on_template(pAB, ovAB)
    writer.addpage(pAB)

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.read()


if __name__ == "__main__":
    data = {
        'seller_name': 'Ramesh Kumar Sharma',
        'seller_father': 'Mohan Lal Sharma',
        'seller_addr': 'H.No. 45, Station Road, Jamshedpur',
        'seller_town': 'Jamshedpur',
        'seller_dist': 'East Singhbhum',
        'buyer_name': 'Suresh Kumar Yadav',
        'buyer_father': 'Ram Prasad Yadav',
        'buyer_addr': 'Village Rampur, NH-33',
        'buyer_town': 'Baharagora',
        'buyer_dist': 'East Singhbhum',
        'vehicle_type': 'Motor Car',
        'reg_no': 'JH05AB1234',
        'make': 'Maruti Swift 2018',
        'chassis_no': 'MA3FJEB1S00123456',
        'engine_no': 'K12M1234567',
        'rto': 'District Transport Office, Jamshedpur',
        'sale_day': '8th June',
        'sale_year': '2026',
        'state': 'Jharkhand',
        'advocate_at': 'Jamshedpur',
        'sign_place': 'Jamshedpur',
    }
    pdf = generate_all(data)
    with open('/home/claude/filled_forms.pdf', 'wb') as f:
        f.write(pdf)
    print(f"Generated: {len(pdf)} bytes → /home/claude/filled_forms.pdf")
