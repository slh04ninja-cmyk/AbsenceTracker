
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('AbsenceTrack-v2.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true});
setTimeout(()=>{const w=dom.window,d=w.document;
  console.log('appbars =', d.querySelectorAll('.appbar').length);
  console.log('badges =', d.querySelectorAll('.badge-etat').length);
  console.log('readyState =', d.readyState);
  try { w.poserBadgeEtat(); console.log('appel direct OK, badges =', d.querySelectorAll('.badge-etat').length); }
  catch(e) { console.log('ERREUR appel direct :', e.message); }
  process.exit(0);},900);
