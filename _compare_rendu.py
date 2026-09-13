# -*- coding: utf-8 -*-
"""_compare_rendu.py — le meme nom, dessine par la chaine Python validee (fpdf2)
et par pdf-lib. Si les deux rendus sont identiques, alors le PDF de l'application
est exactement aussi correct que la chaine de reference.
"""
import io, os, subprocess

import arabic_reshaper
from bidi.algorithm import get_display
from fpdf import FPDF
from PIL import Image, ImageChops

D = '/data/data/com.termux/files/home/AbsenceTrack-dev/'
POLICE = D + 'fonts/NotoNaskhArabic-Regular.ttf'
NOM = 'سامية الحاضي'
# fpdf2 ecrit de gauche a droite sans gerer le sens : il lui faut l'ordre VISUEL.
# pdf-lib applique lui-meme le sens droite -> gauche : il lui faut l'ordre LOGIQUE.
VISUEL = get_display(arabic_reshaper.reshape(NOM))
LOGIQUE = arabic_reshaper.reshape(NOM)

# --- 1. fpdf2 (chaine de reference) ---
pdf = FPDF(unit='mm', format='A4')
pdf.add_font('Noto', '', POLICE)
pdf.add_page()
pdf.set_font('Noto', '', 12)
pdf.text(20, 30, VISUEL)          # texte en dur, position connue
pdf.output(D + '_pdf/ref_fpdf2.pdf')

# --- 2. pdf-lib (ce que fait l'application) ---
script = '''const fs=require('fs');
const {PDFDocument}=require('pdf-lib');
const fontkit=require('@pdf-lib/fontkit').default||require('@pdf-lib/fontkit');
(async()=>{
  const doc=await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f=await doc.embedFont(fs.readFileSync('%s'),{subset:false});
  const p=doc.addPage([595.28,841.89]);
  p.drawText(%s,{x:20*2.83465,y:841.89-30*2.83465,size:12,font:f});
  fs.writeFileSync('%s_pdf/ref_pdflib.pdf', Buffer.from(await doc.save()));
})();''' % (POLICE, __import__('json').dumps(LOGIQUE), D)
io.open(D + '_pdf/_ref.js', 'w').write(script)
subprocess.run(['node', '_ref.js'], cwd=D + '_pdf', check=True)

# --- 3. rendu des deux pages ---
for f in ['ref_fpdf2', 'ref_pdflib']:
    subprocess.run(['pdftoppm', '-png', '-r', '300', '-f', '1', '-l', '1',
                    D + '_pdf/%s.pdf' % f, D + '_pdf/%s' % f], check=True)

a = Image.open(D + '_pdf/ref_fpdf2-1.png').convert('L')
b = Image.open(D + '_pdf/ref_pdflib-1.png').convert('L')
# recadrage serre sur la zone du texte (x 20mm, y 30mm, police 12pt)
box = (int(20 * 300 / 25.4) - 20, int(30 * 300 / 25.4) - 60,
       int(20 * 300 / 25.4) + 300, int(30 * 300 / 25.4) + 40)
ca, cb = a.crop(box), b.crop(box)
ca.save(D + '_pdf/ref_fpdf2_crop.png')
cb.save(D + '_pdf/ref_pdflib_crop.png')

# nombre de pixels encres et difference
def encre(im):
    return sum(1 for p in im.getdata() if p < 128)
diff = ImageChops.difference(ca, cb)
pixels_diff = sum(1 for p in diff.getdata() if p > 60)
print("pixels encres  — fpdf2 : %d | pdf-lib : %d" % (encre(ca), encre(cb)))
print("pixels differents entre les deux rendus (seuil 60) : %d" % pixels_diff)
print("=> les deux rendus sont %s" % ("IDENTIQUES" if pixels_diff < 40 else "DIFFERENTS"))
