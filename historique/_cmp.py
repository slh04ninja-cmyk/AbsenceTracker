# -*- coding: utf-8 -*-
from PIL import Image, ImageChops
D='/data/data/com.termux/files/home/AbsenceTrack-dev/_pdf/'
def bbox(im):
    return im.point(lambda p: 255 if p < 200 else 0).getbbox()
def charge(n):
    im = Image.open(D+n).convert('L')
    bb = bbox(im)
    return im.crop(bb)
a, b = charge('ref_fpdf2_crop.png'), charge('ref_pdflib_crop.png')
print('taille du texte  fpdf2 :', a.size, '| pdf-lib :', b.size)
# on recadre a la taille commune (le plus petit) puis on compare
w = min(a.size[0], b.size[0]); h = min(a.size[1], b.size[1])
a2 = a.crop((0,0,w,h)); b2 = b.crop((0,0,w,h))
d = ImageChops.difference(a2,b2)
pixels = sum(1 for p in d.getdata() if p > 80)
total = w*h
print('pixels encres  fpdf2 : %d | pdf-lib : %d' % (sum(1 for p in a2.getdata() if p<128), sum(1 for p in b2.getdata() if p<128)))
print('pixels differents : %d sur %d  (%.2f%%)' % (pixels, total, 100.0*pixels/total))
a2.resize((w*2,h*2)).save(D+'cmp_fpdf2.png'); b2.resize((w*2,h*2)).save(D+'cmp_pdflib.png')
