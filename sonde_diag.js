
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('AbsenceTrack-v2.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true});
setTimeout(()=>{const w=dom.window;
  console.log('classes =', w.eval('JSON.stringify(classes.map(function(c){return c.nom;}))'));
  console.log('modeDemonstration =', w.eval('modeDemonstration()'));
  console.log('absenceTrackVersion =', w.localStorage.getItem('absenceTrackVersion'));
  console.log('classesDemo =', w.eval('typeof classesDemo !== "undefined" ? classesDemo.length : "absent"'));
  console.log('testHistoGenere_v6 =', w.localStorage.getItem('testHistoGenere_v6'));
  process.exit(0);},900);
