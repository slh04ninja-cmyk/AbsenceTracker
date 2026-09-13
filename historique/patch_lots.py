# -*- coding: utf-8 -*-
"""Genere 2 variantes de couleur du prototype (lot 1 et lot 2)."""
import io, re, shutil, subprocess

SRC = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
d0 = io.open(SRC, encoding='utf-8').read()

LOT1 = {
    # neutres
    '#f8fafc': '#CECECE', '#fafbfc': '#E0DFDF', '#f1f5f9': '#A4A3A4', '#e2e8f0': '#A4A3A4',
    '#cbd5e1': '#A4A3A4', '#94a3b8': '#A4A3A4', '#64748b': '#5B5857', '#374151': '#5B5857',
    '#1e293b': '#5B5857', '#0f172a': '#5B5857', '#323232': '#5B5857', '#f8fbff': '#CECECE',
    '#f0f4f8': '#CECECE', '#1f2937': '#5B5857',
    # primaire
    '#1e3a8a': '#974E50', '#1e40af': '#5B5857', '#2563eb': '#974E50', '#3b82f6': '#C09696',
    '#60a5fa': '#C09696', '#93c5fd': '#C09696', '#bfdbfe': '#C09696', '#dbeafe': '#C09696',
    '#eff6ff': '#CECECE',
    # rouge / absence
    '#ef4444': '#974E50', '#dc2626': '#5B5857', '#fee2e2': '#C09696',
    '#fef2f2': 'rgba(151,78,80,0.12)', '#fdf5f5': 'rgba(151,78,80,0.08)',
    '#fca5a5': '#C09696', '#b91c1c': '#5B5857',
    # orange / retard
    '#f59e0b': '#C09696', '#ea580c': '#974E50', '#c2410c': '#5B5857',
    '#fffbeb': 'rgba(192,150,150,0.18)', '#b45309': '#974E50', '#d97706': '#974E50', '#fdba74': '#C09696',
    # vert
    '#10b981': '#5B5857', '#6ee7b7': '#A4A3A4',
    # sombre
    '#334155': '#A4A3A4', '#273549': '#A4A3A4',
}
RGB1 = {
    'rgba(30,58,138,': 'rgba(151,78,80,', 'rgba(59,130,246,': 'rgba(192,150,150,',
    'rgba(239,68,68,': 'rgba(151,78,80,', 'rgba(245,158,11,': 'rgba(192,150,150,',
    'rgba(16,185,129,': 'rgba(91,88,87,', 'rgba(37,99,235,': 'rgba(151,78,80,',
    'rgba(15,23,42,': 'rgba(91,88,87,', 'rgba(30,64,175,': 'rgba(91,88,87,',
}

LOT2 = {
    '#f8fafc': '#EBEBEB', '#fafbfc': '#F2F2F2', '#f1f5f9': '#A6A3A3', '#e2e8f0': '#A6A3A3',
    '#cbd5e1': '#A6A3A3', '#94a3b8': '#A6A3A3', '#64748b': '#A6A3A3', '#374151': '#A4171C',
    '#1e293b': '#A4171C', '#0f172a': '#A4171C', '#323232': '#A4171C', '#f8fbff': '#EBEBEB',
    '#f0f4f8': '#EBEBEB', '#1f2937': '#A4171C',
    '#1e3a8a': '#D31C23', '#1e40af': '#A4171C', '#2563eb': '#D31C23', '#3b82f6': '#DE6769',
    '#60a5fa': '#DE6769', '#93c5fd': '#DE6769', '#bfdbfe': '#DE6769', '#dbeafe': '#DE6769',
    '#eff6ff': '#EBEBEB',
    '#ef4444': '#A4171C', '#dc2626': '#A4171C', '#fee2e2': '#DE6769',
    '#fef2f2': 'rgba(164,23,28,0.10)', '#fdf5f5': 'rgba(164,23,28,0.07)',
    '#fca5a5': '#DE6769', '#b91c1c': '#A4171C',
    '#f59e0b': '#DE6769', '#ea580c': '#D31C23', '#c2410c': '#A4171C',
    '#fffbeb': 'rgba(222,103,105,0.18)', '#b45309': '#D31C23', '#d97706': '#D31C23', '#fdba74': '#DE6769',
    '#10b981': '#A4171C', '#6ee7b7': '#A6A3A3',
    '#334155': '#A6A3A3', '#273549': '#A6A3A3',
}
RGB2 = {
    'rgba(30,58,138,': 'rgba(211,28,35,', 'rgba(59,130,246,': 'rgba(222,103,105,',
    'rgba(239,68,68,': 'rgba(164,23,28,', 'rgba(245,158,11,': 'rgba(222,103,105,',
    'rgba(16,185,129,': 'rgba(164,23,28,', 'rgba(37,99,235,': 'rgba(211,28,35,',
    'rgba(15,23,42,': 'rgba(164,23,28,', 'rgba(30,64,175,': 'rgba(164,23,28,',
}


def appliquer(d, couleurs, rgb, lot):
    def repl(m):
        return couleurs.get(m.group(0).lower(), m.group(0))
    d = re.sub(r'#[0-9a-fA-F]{6}\b', repl, d)
    for k, v in rgb.items():
        d = d.replace(k, v)
        d = d.replace(k.upper().replace('RGBA', 'rgba'), v)  # securite
    d = d.replace('AbsenceTrack v3.13 \u2014 Prototype', 'AbsenceTrack v3.13 \u2014 Lot ' + lot)
    return d


for lot, couleurs, rgb in [('1', LOT1, RGB1), ('2', LOT2, RGB2)]:
    out = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-lot%s.html' % lot
    d = appliquer(d0, couleurs, rgb, lot)
    io.open(out, 'w', encoding='utf-8').write(d)
    node = shutil.which('node') or shutil.which('nodejs')
    m = re.search(r'<script>(.*)</script>', d, re.DOTALL)
    tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_checklot%s.js' % lot
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    restes = sorted(set(re.findall(r'#[0-9a-fA-F]{6}', d)))
    print('LOT', lot, '| taille', len(d), '| divs', d.count('<div'), d.count('</div>'),
          '| NODE', 'OK' if p.returncode == 0 else 'FAIL', '| couleurs distinctes', len(restes))
    print('   ', restes)
