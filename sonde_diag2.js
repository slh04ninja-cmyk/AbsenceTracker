
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('AbsenceTrack-v2.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,
  beforeParse(w){
    // un telephone qui a DEJA ses donnees : elles doivent etre reprises telles quelles
    w.localStorage.setItem('classes', JSON.stringify([{id:1,nom:'2BACSPF-1',eleves:[{id:1,massar:'H130004627',nom:'اوراغ فاطنة'}]}]));
    w.localStorage.setItem('absenceTrackVersion','v3.0');
  }});
setTimeout(()=>{const w=dom.window;
  console.log('classes reprises =', w.eval('JSON.stringify(classes.map(function(c){return c.nom;}))'));
  console.log('eleves =', w.eval('classes[0] ? classes[0].eleves.length : 0'));
  console.log('modeDemonstration =', w.eval('modeDemonstration()'));
  process.exit(0);},900);
