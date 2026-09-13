# -*- coding: utf-8 -*-
"""Variantes claires : le lot s'applique aux polices/boutons/accents du THEME CLAIR seulement.
Les regles body.theme-sombre (et tout le theme sombre) restent d'origine."""
import io, re, shutil, subprocess

SRC = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
d0 = io.open(SRC, encoding='utf-8').read()

LOT1 = {
    '#94a3b8': '#A4A3A4', '#64748b': '#A4A3A4', '#374151': '#5B5857',
    '#1e293b': '#5B5857', '#0f172a': '#5B5857', '#323232': '#5B5857', '#1f2937': '#5B5857',
    '#1e3a8a': '#974E50', '#1e40af': '#5B5857', '#2563eb': '#974E50',
    '#3b82f6': '#C09696', '#60a5fa': '#C09696', '#93c5fd': '#C09696',
    '#bfdbfe': '#C09696', '#dbeafe': '#C09696', '#eff6ff': 'rgba(151,78,80,0.08)',
    '#ef4444': '#974E50', '#dc2626': '#5B5857', '#fca5a5': '#C09696', '#b91c1c': '#5B5857',
    '#fee2e2': 'rgba(151,78,80,0.25)', '#fef2f2': 'rgba(151,78,80,0.10)', '#fdf5f5': 'rgba(151,78,80,0.07)',
    '#f59e0b': '#C09696', '#ea580c': '#974E50', '#c2410c': '#5B5857',
    '#fffbeb': 'rgba(192,150,150,0.16)', '#b45309': '#974E50', '#d97706': '#974E50', '#fdba74': '#C09696',
    '#10b981': '#974E50', '#6ee7b7': '#C09696',
}
RGB1 = {
    'rgba(30,58,138,': 'rgba(151,78,80,', 'rgba(59,130,246,': 'rgba(192,150,150,',
    'rgba(239,68,68,': 'rgba(151,78,80,', 'rgba(245,158,11,': 'rgba(192,150,150,',
    'rgba(16,185,129,': 'rgba(151,78,80,', 'rgba(37,99,235,': 'rgba(151,78,80,',
    'rgba(30,64,175,': 'rgba(91,88,87,',
}
LOT2 = {
    '#94a3b8': '#A6A3A3', '#64748b': '#A6A3A3', '#374151': '#A4171C',
    '#1e293b': '#A4171C', '#0f172a': '#A4171C', '#323232': '#A4171C', '#1f2937': '#A4171C',
    '#1e3a8a': '#D31C23', '#1e40af': '#A4171C', '#2563eb': '#D31C23',
    '#3b82f6': '#DE6769', '#60a5fa': '#DE6769', '#93c5fd': '#DE6769',
    '#bfdbfe': '#DE6769', '#dbeafe': '#DE6769', '#eff6ff': 'rgba(164,23,28,0.07)',
    '#ef4444': '#A4171C', '#dc2626': '#A4171C', '#fca5a5': '#DE6769', '#b91c1c': '#A4171C',
    '#fee2e2': 'rgba(164,23,28,0.22)', '#fef2f2': 'rgba(164,23,28,0.09)', '#fdf5f5': 'rgba(164,23,28,0.06)',
    '#f59e0b': '#DE6769', '#ea580c': '#D31C23', '#c2410c': '#A4171C',
    '#fffbeb': 'rgba(222,103,105,0.16)', '#b45309': '#D31C23', '#d97706': '#D31C23', '#fdba74': '#DE6769',
    '#10b981': '#D31C23', '#6ee7b7': '#DE6769',
}
RGB2 = {
    'rgba(30,58,138,': 'rgba(211,28,35,', 'rgba(59,130,246,': 'rgba(222,103,105,',
    'rgba(239,68,68,': 'rgba(164,23,28,', 'rgba(245,158,11,': 'rgba(222,103,105,',
    'rgba(16,185,129,': 'rgba(211,28,35,', 'rgba(37,99,235,': 'rgba(211,28,35,',
    'rgba(30,64,175,': 'rgba(164,23,28,',
}


def mapper_ligne(L, couleurs, rgb):
    L = re.sub(r'#[0-9a-fA-F]{6}\b', lambda m: couleurs.get(m.group(0).lower(), m.group(0)), L)
    for k, v in rgb.items():
        L = L.replace(k, v)
    return L


def generer(couleurs, rgb):
    """Mappe tout SAUF les regles body.theme-sombre (theme sombre inchange)."""
    out = []
    sombre = False
    for L in d0.split('\n'):
        if not sombre and L.strip().startswith('body.theme-sombre'):
            sombre = True
        if sombre:
            out.append(L)                 # ligne d'origine : theme sombre preserve
            if '}' in L:
                sombre = False
        else:
            out.append(mapper_ligne(L, couleurs, rgb))
    return '\n'.join(out)


for lot, couleurs, rgb in [('1', LOT1, RGB1), ('2', LOT2, RGB2)]:
    d = generer(couleurs, rgb)
    d = d.replace('AbsenceTrack v3.13 \u2014 Prototype', 'AbsenceTrack v3.13 \u2014 Lot ' + lot + ' (clair)')
    io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-lot%s.html' % lot, 'w', encoding='utf-8').write(d)
    node = shutil.which('node') or shutil.which('nodejs')
    m = re.search(r'<script>(.*)</script>', d, re.DOTALL)
    tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_checklot%s.js' % lot
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    # controles
    sombre_ok = ('body.theme-sombre .motif-carte { background: linear-gradient(135deg, #1e293b' in d)
    clair_palette = ('#f8fafc' in d and '#ffffff' in d)
    print('LOT', lot, '| divs', d.count('<div'), d.count('</div>'), '| NODE', 'OK' if p.returncode == 0 else 'FAIL')
    print('    theme sombre d origine conserve:', sombre_ok, '| fonds neutres conserves:', clair_palette)
