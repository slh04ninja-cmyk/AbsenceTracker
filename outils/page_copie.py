#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""outils/page_copie.py — fabrique une petite page HTML avec un bouton « Copier »
qui met un script SQL dans le presse-papier, pour le coller dans l'editeur SQL de
Supabase depuis un telephone (le collage est le geste le plus sur).

    python3 outils/page_copie.py <script.sql> <sortie.html> "<titre>" "<lien SQL Editor>"

Le SQL est embarque en base64 : le texte copie est donc EXACTEMENT le fichier
(aucune entorse aux entites HTML). L'aller-retour est verifie avant d'ecrire.
"""
import base64
import io
import json
import sys

GABARIT = u"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITRE__</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 14px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background: linear-gradient(160deg, #eef2f7 0%, #e2e8f0 100%); color: #0f172a; }
  .carte { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 18px; padding: 20px;
           box-shadow: 0 10px 30px rgba(15,23,42,.12); }
  h1 { font-size: 21px; margin: 0 0 4px; }
  .sous { margin: 0 0 18px; color: #64748b; font-size: 14px; }
  .etape { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .etape:last-of-type { border-bottom: 0; }
  .num { flex: 0 0 28px; height: 28px; border-radius: 50%; background: #2563eb; color: #fff;
         font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; }
  .etape div { font-size: 15px; line-height: 1.45; }
  button { width: 100%; height: 52px; margin: 18px 0 0; border: 0; border-radius: 12px; cursor: pointer;
           background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #fff;
           font-size: 17px; font-weight: 700; letter-spacing: .3px; }
  button:active { transform: translateY(1px); }
  .message { margin-top: 12px; padding: 12px 14px; border-radius: 10px; font-size: 14px; line-height: 1.45; display: none; }
  .message.ok { display: block; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .message.souci { display: block; background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  .lien { margin: 16px 0 0; font-size: 15px; }
  a { color: #1d4ed8; }
  details { margin-top: 18px; }
  summary { cursor: pointer; font-size: 14px; color: #475569; }
  textarea { width: 100%; height: 200px; margin-top: 10px; padding: 10px; border: 1px solid #cbd5e1;
             border-radius: 10px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px;
             line-height: 1.4; color: #334155; background: #f8fafc; resize: vertical; }
  .pied { margin: 14px 0 0; font-size: 13px; color: #94a3b8; text-align: center; }
  .tableau { margin-top: 16px; }
  .tableau table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tableau th { text-align: start; font-size: 12px; text-transform: uppercase; letter-spacing: .04em;
                color: #64748b; padding: 6px 8px; border-bottom: 2px solid #e2e8f0; }
  .tableau td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .tableau tr:last-child td { border-bottom: 0; }
  .tableau .id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; color: #1e293b;
                 word-break: break-all; }
  .tableau .mdp { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; font-weight: 700;
                  color: #1d4ed8; white-space: nowrap; }
  .attention { margin-top: 16px; padding: 12px 14px; border-radius: 10px; background: #fef2f2;
               border: 1px solid #fecaca; color: #991b1b; font-size: 13px; line-height: 1.45; }
</style>
</head>
<body>
<div class="carte">
  <h1>__TITRE__</h1>
  <p class="sous" id="sous"></p>

  __ETAPES__
  __TABLEAU__
  <button id="btn" onclick="return copier()">COPIER LE SCRIPT</button>
  <div class="message" id="message"></div>

  <p class="lien">Lien direct : <a id="lien" href="__LIEN__">ouvrir le SQL Editor de mon projet</a></p>

  <div class="attention" id="attention"></div>

  <details>
    <summary>Voir le script (tu peux aussi le copier a la main ici)</summary>
    <textarea id="plan" readonly spellcheck="false"></textarea>
  </details>

  <p class="pied" id="pied"></p>
</div>

<script>
var B64 = "__B64__";
var SOUS = __SOUS__;
var ATTENTION = __ATTENTION__;
function planTexte() {
  var octets = Uint8Array.from(atob(B64), function (c) { return c.charCodeAt(0); });
  return new TextDecoder("utf-8").decode(octets);
}
function dire(classe, texte) {
  var m = document.getElementById("message");
  m.className = "message " + classe;
  m.textContent = texte;
}
function copier() {
  var zone = document.getElementById("plan");
  zone.focus(); zone.select(); zone.setSelectionRange(0, zone.value.length);
  var ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  if (ok) { dire("ok", "Copie. Appuie sur le lien bleu, colle dans le grand cadre vide, puis Run."); return false; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(zone.value).then(
      function () { dire("ok", "Copie. Appuie sur le lien bleu, colle dans le grand cadre vide, puis Run."); },
      function () { dire("souci", "Copie automatique impossible. Reste appuye dans le grand cadre ci-dessous, Tout selectionner, puis Copier."); });
    return false;
  }
  dire("souci", "Copie automatique impossible. Reste appuye dans le grand cadre ci-dessous, Tout selectionner, puis Copier.");
  return false;
}
document.getElementById("sous").textContent = SOUS;
document.getElementById("attention").textContent = ATTENTION;
var texte = planTexte();
document.getElementById("plan").value = texte;
document.getElementById("pied").textContent = texte.length.toLocaleString("fr-FR") + " caracteres charges - verifie ce nombre avant de copier";
</script>
</body>
</html>
"""


def construire(sql, titre, lien, sous, attention, etapes, tableau=""):
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    if base64.b64decode(b64).decode("utf-8") != sql:
        raise SystemExit("!! aller-retour du script different : rien n'est ecrit")
    bloc_tableau = (u'\n  <div class="tableau">%s</div>' % tableau) if tableau else u""
    blocs = "".join(
        u'\n  <div class="etape"><span class="num">%d</span><div>%s</div></div>' % (i + 1, e)
        for i, e in enumerate(etapes))
    return (GABARIT.replace("__B64__", b64)
                   .replace("__TITRE__", titre)
                   .replace("__LIEN__", lien)
                   .replace("__SOUS__", json.dumps(sous))
                   .replace("__ATTENTION__", json.dumps(attention))
                   .replace("__ETAPES__", blocs)
                   .replace("__TABLEAU__", bloc_tableau))


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    source, sortie = sys.argv[1], sys.argv[2]
    titre = sys.argv[3] if len(sys.argv) > 3 else "Copier le script SQL"
    lien = sys.argv[4] if len(sys.argv) > 4 else "https://supabase.com/dashboard"
    sql = io.open(source, encoding="utf-8").read()
    etapes = [
        "Appuie sur le bouton bleu ci-dessous : le script est copie.",
        "Appuie sur le lien bleu : la page du <b>SQL Editor</b> s'ouvre.",
        "Reste appuye dans le grand cadre vide, puis choisis <b>Coller</b>.",
        "Appuie sur <b>Run</b>. Quand ca marche, il s'affiche : <b>Success. No rows returned</b>.",
    ]
    page = construire(sql, titre, lien,
                      "AbsenceTrack - a executer UNE SEULE FOIS dans le SQL Editor de Supabase",
                      "A ne faire qu'une seule fois. Ce script ne contient aucune donnee : "
                      "seulement du rangement et des regles.",
                      etapes)
    io.open(sortie, "w", encoding="utf-8").write(page)
    print("ecrit : %s (%d octets, script de %d caracteres)"
          % (sortie, len(page.encode()), len(sql)))


if __name__ == "__main__":
    main()
