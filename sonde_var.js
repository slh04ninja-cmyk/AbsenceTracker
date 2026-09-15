
const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('AbsenceTrack-v2.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
setTimeout(()=>{ const w=dom.window,d=w.document;
  console.log('root --primary = ['+w.getComputedStyle(d.documentElement).getPropertyValue('--primary')+']');
  console.log('body --lot-secondaire = ['+w.getComputedStyle(d.body).getPropertyValue('--lot-secondaire')+']');
  process.exit(0);},700);
