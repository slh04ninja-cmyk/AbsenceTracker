# -*- coding: utf-8 -*-
"""Variantes claires, nouveaux lots verts. Theme sombre inchange."""
import io, re, shutil, subprocess

SRC = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
d0 = io.open(SRC, encoding='utf-8').read()

# LOT A : #B6FFCC #435045 #95CEA5 #759D80 #81B190
LOT_A = {
    '#94a3b8': '#759D80', '#64748b': '#759D80', '#374151': '#435045',
    '#1e293b': '#435045', '#0f172a': '#435045', '#323232': '#435045', '#1f2937': '#435045',
    '#1e3a8a': '#759D80', '#1e40af': '#435045', '#2563eb': '#759D80',
    '#3b82f6': '#95CEA5', '#60a5fa': '#95CEA5', '#93c5fd': '#95CEA5',
    '#bfdbfe': '#95CEA5', '#dbeafe': '#B6FFCC', '#eff6ff': 'rgba(117,157,128,0.10)',
    '#ef4444': '#435045', '#dc2626': '#435045', '#fca5a5': '#81B190', '#b91c1c': '#435045',
    '#fee2e2': 'rgba(67,80,69,0.18)', '#fef2f2': 'rgba(67,80,69,0.08)', '#fdf5f5': 'rgba(67,80,69,0.05)',
    '#f59e0b': '#81B190', '#ea580c': '#759D80', '#c2410c': '#435045',
    '#fffbeb': 'rgba(129,177,144,0.18)', '#b45309': '#759D80', '#d97706': '#759D80', '#fdba74': '#95CEA5',
    '#10b981': '#759D80', '#6ee7b7': '#95CEA5',
}
RGB_A = {
    'rgba(30,58,138,': 'rgba(117,157,128,', 'rgba(59,130,246,': 'rgba(149,206,165,',
    'rgba(239,68,68,': 'rgba(67,80,69,', 'rgba(245,158,11,': 'rgba(129,177,144,',
    'rgba(16,185,129,': 'rgba(117,157,128,', 'rgba(37,99,235,': 'rgba(117,157,128,',
    'rgba(30,64,175,': 'rgba(67,80,69,',
}

# LOT B : #EFEFEF #91A7A1 #8CCAB9 #80C1AE #D4E7E2
LOT_B = {
    '#94a3b8': '#91A7A1', '#64748b': '#91A7A1', '#374151': '#91A7A1',
    '#1e293b': '#91A7A1', '#0f172a': '#91A7A1', '#323232': '#91A7A1', '#1f2937': '#91A7A1',
    '#1e3a8a': '#8CCAB9', '#1e40af': '#91A7A1', '#2563eb': '#8CCAB9',
    '#3b82f6': '#80C1AE', '#60a5fa': '#80C1AE', '#93c5fd': '#80C1AE',
    '#bfdbfe': '#80C1AE', '#dbeafe': '#D4E7E2', '#eff6ff': 'rgba(140,202,185,0.12)',
    '#ef4444': '#91A7A1', '#dc2626': '#91A7A1', '#fca5a5': '#80C1AE', '#b91c1c': '#91A7A1',
    '#fee2e2': 'rgba(145,167,161,0.20)', '#fef2f2': 'rgba(145,167,161,0.10)', '#fdf5f5': 'rgba(145,167,161,0.06)',
    '#f59e0b': '#80C1AE', '#ea580c': '#8CCAB9', '#c2410c': '#91A7A1',
    '#fffbeb': 'rgba(128,193,174,0.18)', '#b45309': '#8CCAB9', '#d97706': '#8CCAB9', '#fdba74': '#80C1AE',
    '#10b981': '#8CCAB9', '#6ee7b7': '#80C1AE',
}
RGB_B = {
    'rgba(30,58,138,': 'rgba(140,202,185,', 'rgba(59,130,246,': 'rgba(128,193,174,',
    'rgba(239,68,68,': 'rgba(145,167,161,', 'rgba(245,158,11,': 'rgba(128,193,174,',
    'rgba(16,185,129,': 'rgba(140,202,185,', 'rgba(37,99,235,': 'rgba(140,202,185,',
    'rgba(30,64,175,': 'rgba(145,167,161,',
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


for lot, couleurs, rgb, nom in [('1', LOT_A, RGB_A, 'vert'), ('2', LOT_B, RGB_B, 'vert d\'eau')]:
    d = generer(couleurs, rgb)
    d = d.replace('AbsenceTrack v3.13 \u2014 Prototype', 'AbsenceTrack v3.13 \u2014 Lot ' + lot + ' (' + nom + ', clair)')
    io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-lot%s.html' % lot, 'w', encoding='utf-8').write(d)
    node = shutil.which('node') or shutil.which('nodejs')
    m = re.search(r'<script>(.*)</script>', d, re.DOTALL)
    io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_cl.js', 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', '/data/data/com.termux/files/home/AbsenceTrack-dev/_cl.js'], capture_output=True, text=True)
    print('LOT', lot, '(' + nom + ') | divs', d.count('<div'), d.count('</div>'), '| NODE', 'OK' if p.returncode == 0 else 'FAIL')
    print('    sombre d origine:', 'body.theme-sombre .appbar { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' in d,
          '| neutres:', all(x in d for x in ['#f8fafc', '#ffffff', '#e2e8f0']))
