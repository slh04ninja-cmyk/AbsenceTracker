const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const vc=new VirtualConsole();vc.on('jsdomError',e=>console.log('err',e.message));
const dom=new JSDOM(fs.readFileSync('AbsenceTrack-v2.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const win=dom.window,doc=win.document;
setTimeout(()=>{
  console.log('classes au chargement :', win.eval('classes.length'), win.eval('JSON.stringify(classes.map(function(c){return c.nom;}))'));
  win.eval("tableauxService['math-prof1@taalim.ma'] = []; classes = classes.filter(function(c){ return ['3ème A','3ème B','4ème A','4ème B','5ème A'].indexOf(c.nom) >= 0; });");
  console.log('apres filtre :', win.eval('classes.length'), win.eval("JSON.stringify(tableauxService['math-prof1@taalim.ma'])"));
  doc.getElementById('login-email').value='math-prof1@taalim.ma'; doc.getElementById('login-password').value='12345';
  win.connexion();
  const sel=doc.getElementById('select-classe');
  console.log('options :', sel.options.length, 'disabled=', sel.disabled);
  console.log('creneauxUtilisateur :', win.eval("JSON.stringify(creneauxUtilisateur('math-prof1@taalim.ma'))"));
  console.log('classes apres connexion :', win.eval('classes.length'));
  process.exit(0);
},400);
