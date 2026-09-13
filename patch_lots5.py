# -*- coding: utf-8 -*-
"""Variantes claires lots 5 et 6. Theme sombre et neutres inchanges."""
import io, re, shutil, subprocess

SRC = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
d0 = io.open(SRC, encoding='utf-8').read()

# LOT 5 : #ECECEE #3D3E4E #A6A6A8 #EB7F69 #566C9D
LOT5 = {
    '#94a3b8': '#A6A6A8', '#64748b': '#A6A6A8', '#374151': '#3D3E4E',
    '#1e293b': '#3D3E4E', '#0f172a': '#3D3E4E', '#323232': '#3D3E4E', '#1f2937': '#3D3E4E',
    '#1e3a8a': '#566C9D', '#1e40af': '#3D3E4E', '#2563eb': '#566C9D',
    '#3b82f6': '#EB7F69', '#60a5fa': '#EB7F69', '#93c5fd': '#EB7F69',
    '#bfdbfe': '#EB7F69', '#dbeafe': '#ECECEE', '#eff6ff': 'rgba(86,108,157,0.10)',
    '#ef4444': '#EB7F69', '#dc2626': '#EB7F69', '#fca5a5': '#EB7F69', '#b91c1c': '#3D3E4E',
    '#fee2e2': 'rgba(235,127,105,0.22)', '#fef2f2': 'rgba(235,127,105,0.10)', '#fdf5f5': 'rgba(235,127,105,0.06)',
    '#f59e0b': '#566C9D', '#ea580c': '#566C9D', '#c2410c': '#3D3E4E',
    '#fffbeb': 'rgba(86,108,157,0.16)', '#b45309': '#566C9D', '#d97706': '#566C9D', '#fdba74': '#566C9D',
    '#10b981': '#566C9D', '#6ee7b7': '#EB7F69',
}
RGB5 = {
    'rgba(30,58,138,': 'rgba(86,108,157,', 'rgba(59,130,246,': 'rgba(235,127,105,',
    'rgba(239,68,68,': 'rgba(235,127,105,', 'rgba(245,158,11,': 'rgba(86,108,157,',
    'rgba(16,185,129,': 'rgba(86,108,157,', 'rgba(37,99,235,': 'rgba(86,108,157,',
    'rgba(30,64,175,': 'rgba(61,62,78,',
}

# LOT 6 : #6994CC #AAAAD0 #363759 #74759C #D93C78
LOT6 = {
    '#94a3b8': '#74759C', '#64748b': '#74759C', '#374151': '#363759',
    '#1e293b': '#363759', '#0f172a': '#363759', '#323232': '#363759', '#1f2937': '#363759',
    '#1e3a8a': '#6994CC', '#1e40af': '#363759', '#2563eb': '#6994CC',
    '#3b82f6': '#AAAAD0', '#60a5fa': '#AAAAD0', '#93c5fd': '#AAAAD0',
    '#bfdbfe': '#AAAAD0', '#dbeafe': '#AAAAD0', '#eff6ff': 'rgba(105,148,204,0.10)',
    '#ef4444': '#D93C78', '#dc2626': '#D93C78', '#fca5a5': '#D93C78', '#b91c1c': '#363759',
    '#fee2e2': 'rgba(217,60,120,0.20)', '#fef2f2': 'rgba(217,60,120,0.09)', '#fdf5f5': 'rgba(217,60,120,0.06)',
    '#f59e0b': '#74759C', '#ea580c': '#6994CC', '#c2410c': '#363759',
    '#fffbeb': 'rgba(116,117,156,0.16)', '#b45309': '#74759C', '#d97706': '#74759C', '#fdba74': '#AAAAD0',
    '#10b981': '#6994CC', '#6ee7b7': '#AAAAD0',
}
RGB6 = {
    'rgba(30,58,138,': 'rgba(105,148,204,', 'rgba(59,130,246,': 'rgba(170,170,208,',
    'rgba(239,68,68,': 'rgba(217,60,120,', 'rgba(245,158,11,': 'rgba(116,117,156,',
    'rgba(16,185,129,': 'rgba(105,148,204,', 'rgba(37,99,235,': 'rgba(105,148,204,',
    'rgba(30,64,175,': 'rgba(54,55,89,',
}


def mapper(L, couleurs, rgb):
    L = re.sub(r'#[0-9a-fA-F]{6}\b', lambda m: couleurs.get(m.group(0).lower(), m.group(0)), L)
    for k, v in rgb.items():
        L = L.replace(k, v)
    return L


def generer(couleurs, rgb):
    out, sombre = [], False
    for L in d0.split('\n'):
        if not sombre and L.strip().startswith('body.theme-sombre'):
            sombre = True
        if sombre:
            out.append(L)
            if '}' in L:
                sombre = False
        else:
            out.append(mapper(L, couleurs, rgb))
    return '\n'.join(out)


for num, couleurs, rgb, nom in [('5', LOT5, RGB5, 'bleu corail'), ('6', LOT6, RGB6, 'bleu magenta')]:
    d = generer(couleurs, rgb)
    d = d.replace('AbsenceTrack v3.13 \u2014 Prototype', 'AbsenceTrack v3.13 \u2014 Lot ' + num + ' (' + nom + ', clair)')
    io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-lot%s.html' % num, 'w', encoding='utf-8').write(d)
    node = shutil.which('node') or shutil.which('nodejs')
    m = re.search(r'<script>(.*)</script>', d, re.DOTALL)
    io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_cl.js', 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', '/data/data/com.termux/files/home/AbsenceTrack-dev/_cl.js'], capture_output=True, text=True)
    print('LOT', num, '(' + nom + ') | divs', d.count('<div'), d.count('</div>'), '| NODE', 'OK' if p.returncode == 0 else 'FAIL',
          '| sombre origine:', 'body.theme-sombre .appbar { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' in d,
          '| neutres:', all(x in d for x in ['#f8fafc', '#ffffff', '#e2e8f0']))
