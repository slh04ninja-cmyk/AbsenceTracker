# -*- coding: utf-8 -*-
"""AbsenceTrack v3.24 : habillage des menus deroulants (select)."""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

CHEV = ("url(\"data:image/svg+xml;charset=UTF-8,"
        "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 512'%3E"
        "%3Cpath fill='@@' d='M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 "
        "6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z'/%3E"
        "%3C/svg%3E\")")

CSS = """
    /* ========== MENUS DEROULANTS (select) ========== */
    select {
      -webkit-appearance: none;
      appearance: none;
      background-color: #ffffff;
      background-image: __CHEV_1E3A8A__;
      background-repeat: no-repeat;
      background-position: right 14px center;
      background-size: 13px 13px;
      padding-right: 46px !important;
      min-height: 46px;
      font-weight: 600;
      line-height: 1.2;
      color: #1e3a8a;
      border: 2px solid #1e3a8a;
      border-radius: 12px;
      cursor: pointer;
      text-overflow: ellipsis;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      transition: box-shadow 0.18s ease, border-color 0.18s ease;
    }
    select:hover { box-shadow: 0 5px 14px rgba(15, 23, 42, 0.12); }
    select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.30); }
    select:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
    select option { font-weight: 500; color: #1e293b; background: #ffffff; }
    select option:disabled { color: #94a3b8; }
    select::-ms-expand { display: none; }

    /* --- couleurs par role (theme clair) --- */
    body:not(.theme-sombre).role-enseignant select {
      color: var(--lot-fonce);
      border-color: var(--lot-primaire);
      background-image: __CHEV_6994CC__;
    }
    body:not(.theme-sombre).role-enseignant select:focus {
      border-color: var(--lot-primaire);
      box-shadow: 0 0 0 3px rgba(105, 148, 204, 0.32);
    }
    body:not(.theme-sombre).role-surveillant select {
      color: var(--lot-fonce);
      border-color: var(--lot-primaire);
      background-image: __CHEV_566C9D__;
    }
    body:not(.theme-sombre).role-surveillant select:focus {
      border-color: var(--lot-primaire);
      box-shadow: 0 0 0 3px rgba(86, 108, 157, 0.32);
    }
    /* --- theme sombre --- */
    body.theme-sombre select {
      background-color: #0f172a !important;
      background-image: __CHEV_93C5FD__ !important;
      color: #e2e8f0 !important;
      border-color: #334155 !important;
      box-shadow: none;
    }
    body.theme-sombre select:hover { border-color: #475569 !important; }
    body.theme-sombre select:focus {
      border-color: #93c5fd !important;
      box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.22);
    }
    body.theme-sombre select option { background: #1e293b; color: #e2e8f0; }
"""

for c, key in [('#1e3a8a', '__CHEV_1E3A8A__'), ('%236994CC', '__CHEV_6994CC__'),
               ('%23566C9D', '__CHEV_566C9D__'), ('%2393c5fd', '__CHEV_93C5FD__')]:
    CSS = CSS.replace(key, CHEV.replace('@@', c))

new, c = re.subn(r'\n  </style>', '\n' + CSS + '  </style>', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' insertion CSS   occurrences=%d' % c)
allok &= (c == 1)
if c == 1:
    s = new
else:
    sys.exit(1)

s2, c = re.subn(r'AbsenceTrack v3\.23', 'AbsenceTrack v3.24', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.24 occurrences=%d' % c)
allok &= (c == 1)
s = s2

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# --- verifications ---
n = s.count('-webkit-appearance: none;')
print(('OK   ' if n == 1 else 'ECHEC') + ' regle select       = %d' % n)
allok &= (n == 1)
n = s.count('data:image/svg+xml')
print(('OK   ' if n == 4 else 'ECHEC') + ' chevrons SVG       = %d (attendu 4)' % n)
allok &= (n == 4)
n = len(re.findall(r'<select', s))
print(('OK   ' if n == 5 else 'ECHEC') + ' selects dans le DOM = %d' % n)
allok &= (n == 5)
n = s.count('%3Csvg')
print(('OK   ' if n == 4 else 'ECHEC') + ' SVG encodes        = %d' % n)
allok &= (n == 4)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
node = shutil.which('node') or shutil.which('nodejs')
r = subprocess.run([node, '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:200] or ''))
allok &= (r.returncode == 0)

# equilibre des accolades CSS
bloc = s[s.index('/* ========== MENUS DEROULANTS'):s.index('body.theme-sombre select option')]
print(('OK   ' if bloc.count('{') == bloc.count('}') else 'ECHEC') + ' accolades CSS %d/%d' % (bloc.count('{'), bloc.count('}')))
allok &= (bloc.count('{') == bloc.count('}'))

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
