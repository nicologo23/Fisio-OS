// Pestañas, render() y manejo de eventos (click / input / change)
const V={hoy,lib,rut,sem,cli,fis,grp,dat};
function render(){nav();$('#app').innerHTML=bkBanner()+V[tab]();if(tab=='lib')list();document.body.dataset.tab=tab}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-a]');if(!b||b.tagName=='SELECT')return;const a=b.dataset.a,i=+b.dataset.i,r=cur();
if(a=='tab'){tab=b.dataset.k;showTxt='';fsum='';delArm=null;render();return}
if(a=='toR')addToR(b.dataset.id);
else if(a=='addex'){const n=$('#nn').value.trim();if(!n)return;st.custom.push({id:uid('c'),g:$('#ng').value,f:$('#nf').value,a:[...$('#na').selectedOptions].map(o=>+o.value),c:CAT.filter((q,i)=>$('#nc'+i)&&$('#nc'+i).checked),j:$('#njp')&&$('#njp').checked?['Pie']:[],n,e:$('#ne').value.trim()});save();render();flash('Ejercicio creado')}
else if(a=='tt'||a=='tj'){const A=a=='tt'?ft:fj,v=b.dataset.v,k=A.indexOf(v);k<0?A.push(v):A.splice(k,1);lim=60;$('#chips').innerHTML=chips();list()}
else if(a=='clr'){ft=[];fj=[];lim=60;$('#chips').innerHTML=chips();list()}
else if(a=='iso'){st.ov[b.dataset.id]=Object.assign({},st.ov[b.dataset.id],{iso:b.checked});save();list()}
else if(a=='edit'){ed=b.dataset.id;list()}
else if(a=='done'){ed=null;list()}
else if(a=='reset'){delete st.ov[b.dataset.id];save();list()}
else if(a=='tcat'){const id=b.dataset.id,e=byId(id),k=b.dataset.k,fl=k[0]=='@'?'j':'c',v=k[0]=='@'?k.slice(1):k,S=new Set(e[fl]||[]);S.has(v)?S.delete(v):S.add(v);st.ov[id]=Object.assign({},st.ov[id],{[fl]:[...S]});save();list()}
else if(a=='tact'){const id=b.dataset.id,e=byId(id),S=new Set(e.a||[]),k=+b.dataset.k;S.has(k)?S.delete(k):S.add(k);st.ov[id]=Object.assign({},st.ov[id],{a:[...S]});save();list()}
else if(a=='more'){lim+=60;list()}
else if(a=='fnew'){const n=$('#fn').value.trim();if(!n||!cc())return;const f={id:uid('f'),name:n,area:'',status:'Activa',dx:'',type:$('#fnt').value,act:$('#fna').value,contact:$('#fnk').value,moment:$('#fnm').value,opened:$('#fnd').value||today(),entries:[]};cs_(cc()).push(f);st.fcase=f.id;save();render()}
else if(a=='fopen'){st.fcase=b.dataset.id;fe=null;fsum='';delArm=null;save();render()}
else if(a=='fgo'){if(b.dataset.id)st.fcase=b.dataset.id;tab='fis';fsum='';delArm=null;save();render()}
else if(a=='fadd'){const f=fcase(),tx=$('#fx').value.trim(),m=grabM(),mm=fdraft.m.slice();if(m)mm.push(m);if(!f||(!tx&&!mm.length)){flash('Escribe la anotación o añade una medida');return}f.entries.push({id:uid('n'),n:Date.now(),date:$('#fd').value||today(),type:$('#ft').value,text:tx,pain:$('#fp').value,meas:mm});fdraft=newDraft();save();render();flash('Anotación guardada')}
else if(a=='madd'){const m=grabM();if(!m){flash('Indica movimiento, músculo o situación y un valor válido (EVA: de 0 a 10)');return}fdraft.m.push(m);fdraft.mk=m.k;fdraft.ms=m.s;fdraft.mu=m.u;snapDraft();render()}
else if(a=='mrm'){fdraft.m.splice(i,1);snapDraft();render()}
else if(a=='fz'){const f=fcase();if(!f)return;f.zones=f.zones||[];const z=b.dataset.z,k=f.zones.indexOf(z);k<0?f.zones.push(z):f.zones.splice(k,1);save();render()}
else if(a=='fzclr'){const f=fcase();if(f){f.zones=[];save();render()}}
else if(a=='fgen'){const f=fcase();if(!f)return;fsum=buildSum(f,cc());render();flash('Resumen generado')}
else if(a=='fcopy'){const t=$('#fsumbox');if(!t)return;t.focus();t.select();const ok=()=>flash('Copiado'),ko=()=>{try{document.execCommand('copy')?ok():flash('Selecciona el texto y cópialo')}catch(e){flash('Selecciona el texto y cópialo')}};try{navigator.clipboard.writeText(t.value).then(ok,ko)}catch(e){ko()}}
else if(a=='feedit'){fe=b.dataset.id;render()}
else if(a=='fecancel'){fe=null;render()}
else if(a=='fesave'){const f=fcase(),e=f.entries.find(x=>x.id==b.dataset.id);e.text=$('#fetxt').value;e.date=$('#fedate').value||e.date;fe=null;save();render()}
else if(a=='fedel'){const f=fcase(),id=b.dataset.id;if(delArm!='e'+id){delArm='e'+id;render();return}f.entries=f.entries.filter(x=>x.id!=id);delArm=null;save();render()}
else if(a=='fcdel'){const f=fcase();if(!f)return;if(delArm!='fc'+f.id){delArm='fc'+f.id;render();return}const L=cs_(cc());L.splice(L.indexOf(f),1);delArm=null;st.fcase=null;save();render()}
else if(a=='ppdf'){const c=cc(),p=c.plans[i];pdfSave(specPlan(c,p),pdfName(c,p.name))}
else if(a=='wpdf'){const c=cc(),w=cw(c)[i];pdfSave(specWeek(c,w),pdfName(c,w.name))}
else if(a=='falta'){const f=fcase();if(!f)return;f.status='Alta';f.closed=$('#fcl').value||today();fsum='';save();render();flash('Lesión dada de alta')}
else if(a=='freopen'){const f=fcase();if(!f)return;f.status='Activa';delete f.closed;fsum='';save();render();flash('Lesión reabierta')}
else if(a=='gnew'){const n=$('#gn').value.trim();if(!n)return;const g={id:uid('g'),name:n,members:[]};st.groups.push(g);st.gsel=g.id;save();render()}
else if(a=='gdel'){const g=curG();if(!g)return;if(delArm!='g'+g.id){delArm='g'+g.id;render();return}st.groups=st.groups.filter(x=>x.id!=g.id);st.gsel=null;delArm=null;save();render()}
else if(a=='gpdf'){const g=curG();if(!g||!g.members.length){flash('Añade deportistas al grupo');return}const R=grpReport(g);pdfSave({group:true,R,title:g.name,athlete:g.name},('Informe_grupo_'+g.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\-]+/g,'_')+'_'+today()+'.pdf')}
else if(a=='fpan'){fpan=!fpan;const p=$('#fpanel');if(p)p.classList.toggle('open',fpan)}
else if(a=='ui'){const u=b.dataset.u,v=b.dataset.v;ui[u]=(u=='fs'||u=='dens')?+v:v;saveUI();applyUI();render()}
else if(a=='uit'){ui[b.dataset.u]=b.checked?1:0;saveUI();render()}
else if(a=='qa'){const k=b.dataset.k;if(k=='nr'){const r={id:uid('r'),name:'Rutina '+(st.routines.length+1),items:[]};st.routines.push(r);st.active=r.id;save();tab='rut';render()}else{tab=k;render();setTimeout(()=>{const i=$(k=='cli'?'#cn':'#fn');if(i)i.focus()},60)}}
else if(a=='fichac'){st.cc=b.dataset.id;save();tab='cli';render()}
else if(a=='fgo2'){st.cc=b.dataset.c;st.fcase=b.dataset.id;save();tab='fis';render()}
else if(a=='selc'){st.cc=b.dataset.id;save();render()}
else if(a=='selr'){st.active=b.dataset.id;save();render()}
else if(a=='fsec'){fsec[b.dataset.k]=!secOn(b.dataset.k);render()}
else if(a=='fback'){st.fcase=null;fe=null;fsum='';save();render()}
else if(a=='expf'){expFile()}
else if(a=='gobk'){tab='dat';render()}
else if(a=='pdfshare'){pdfGo()}
else if(a=='pdfx'){pdfX()}
else if(a=='updgo'){location.reload()}
else if(a=='newweek'){const has=Object.values(st.week).some(Boolean);if(has&&delArm!='week'){delArm='week';render();return}st.week={};delArm=null;save();render();flash('Semana nueva')}
else if(a=='aw'||a=='awc'){const c=a=='aw'?st.clients.find(x=>x.id==$('#wc').value):cc();if(!c){flash('Elige un deportista');return}const sn=weekSnap();if(!sn.some(d=>d.name)){flash('La semana está vacía');return}const nm=a=='aw'?$('#wn').value.trim():'';cw(c).unshift({id:uid('w'),date:today(),name:nm||'Semana del '+today(),note:'',days:sn});st.week={};delArm=null;save();flash('Semana asignada a '+c.name+' y semana vaciada');render()}
else if(a=='wdel'){cw(cc()).splice(i,1);showTxt='';save();render()}
else if(a=='wcopy'){const w=cw(cc())[i];w.days.forEach((d,k)=>{if(!d.name){delete st.week[k];return}const j=JSON.stringify(d.items);let r=st.routines.find(x=>x.name==d.name&&JSON.stringify(x.items)==j);if(!r){r={id:uid('r'),name:d.name,items:JSON.parse(j)};st.routines.push(r)}st.week[k]=r.id});save();flash('Copiada a Semana')}
else if(a=='wtxt'||a=='ptxt'){const key=(a=='wtxt'?'w':'p')+i;showTxt=showTxt==key?'':key;render();setTimeout(()=>{const t=$('#txtbox');if(t){t.focus();t.select()}},0)}
else if(a=='newc'){const n=$('#cn').value.trim();if(!n)return;const c={id:uid('k'),name:n,notes:'',plans:[]};st.clients.push(c);st.cc=c.id;save();render()}
else if(a=='delc'){const c=cc();if(delArm!=c.id){delArm=c.id;flash('Pulsa otra vez para borrar a '+c.name);return}st.clients=st.clients.filter(x=>x.id!=c.id);(st.groups||[]).forEach(g=>g.members=g.members.filter(id=>id!=c.id));st.cc=null;delArm=null;save();render()}
else if(a=='pdel'){cc().plans.splice(i,1);save();render()}
else if(a=='pcopy'){const p=cc().plans[i],x={id:uid('r'),name:p.name+' (copia)',items:JSON.parse(JSON.stringify(p.items))};st.routines.push(x);st.active=x.id;save();flash('Copiada a Rutinas')}
else if(a=='bulk'){const L=$('#bulk').value.split('\n').map(l=>l.split(/[;\t]/).map(s=>s.trim())).filter(p=>p[0]);const m=(v,A,d)=>A.find(x=>x.toLowerCase()==(v||'').toLowerCase())||d;L.forEach((p,k)=>st.custom.push({id:uid('c'),n:p[0],g:m(p[1],G,'Otro'),f:m(p[2],FN,''),e:p[3]||'',a:(p[4]||'').split(',').map(t=>AM.findIndex((_,k)=>actName(k).toLowerCase()==t.trim().toLowerCase())).filter(i=>i>=0)}));save();render();flash(L.length+' ejercicios importados')}
else if(a=='delex'){st.custom=st.custom.filter(e=>e.id!=b.dataset.id);save();list()}
else if(a=='newr'){const x={id:uid('r'),name:'Rutina '+(st.routines.length+1),items:[]};st.routines.push(x);st.active=x.id;save();render()}
else if(a=='delr'){st.routines=st.routines.filter(x=>x.id!=r.id);st.active=null;save();render()}
else if(a=='rm'){r.items.splice(i,1);save();render()}
else if(a=='up'&&i>0){[r.items[i-1],r.items[i]]=[r.items[i],r.items[i-1]];save();render()}
else if(a=='dn'&&i<r.items.length-1){[r.items[i+1],r.items[i]]=[r.items[i],r.items[i+1]];save();render()}
else if(a=='exp'){bkTouch();$('#bk').value=JSON.stringify(st);$('#bk').select();flash('Copia generada')}
else if(a=='imp'){try{const d=JSON.parse($('#bk').value);if(!d||!Array.isArray(d.routines))throw 0;st=Object.assign({custom:[],routines:[],week:{},active:null,clients:[],cc:null,ov:{},groups:[]},d);fixCases();save();flash('Importado')}catch(e){flash('JSON no válido')}}
else if(a=='theme'){const h=document.documentElement;const dark=h.dataset.theme?h.dataset.theme=='dark':matchMedia('(prefers-color-scheme:dark)').matches;h.dataset.theme=dark?'light':'dark'}});
document.addEventListener('input',ev=>{const t=ev.target;
if(t.id=='q'){fq=t.value;lim=60;list()}
else if(t.id=='cnotes'){cc().notes=t.value;save()}
else if(t.id=='fd'||t.id=='ft'||t.id=='fp'||t.id=='fx'){snapDraft()}
else if(t.id=='fsr'){fsrec=t.value}
else if(t.id=='gnm'){curG().name=t.value;save()}
else if(t.id=='fcn'){fcase().name=t.value;save()}
else if(t.id=='fcd'){fcase().dx=t.value;save()}
else if(t.dataset.wn!==undefined){cw(cc())[+t.dataset.wn].note=t.value;save()}
else if(t.dataset.pn!==undefined){cc().plans[+t.dataset.pn].note=t.value;save()}
else if(t.id=='rn'){cur().name=t.value;save()}
else if(t.dataset.f){cur().items[+t.dataset.i][t.dataset.f]=t.value;save()}});
document.addEventListener('change',ev=>{const t=ev.target;
if(t.id=='fg'){fg=t.value;lim=60;list()}
else if(t.id=='ff'){ff=t.value;lim=60;list()}
else if(t.id=='eg'){st.ov[ed]=Object.assign({},st.ov[ed],{g:t.value});save();list()}
else if(t.id=='ef'){st.ov[ed]=Object.assign({},st.ov[ed],{f:t.value});save();list()}
else if(t.id=='ep'){st.ov[ed]=Object.assign({},st.ov[ed],{p:t.value});save();list()}
else if(t.dataset.fo!==undefined){fopt[t.dataset.fo]=t.checked?1:0}
else if(t.id=='gs'){st.gsel=t.value;save();render()}
else if(t.id=='gp'){gper=t.value;render()}
else if(t.id=='gfrom'){gfrom=t.value;render()}
else if(t.id=='gto'){gto=t.value;render()}
else if(t.dataset.gm!==undefined){const g=curG(),k=g.members.indexOf(t.dataset.gm);if(t.checked){if(k<0)g.members.push(t.dataset.gm)}else if(k>=0)g.members.splice(k,1);save();render()}
else if(t.id=='ftp'){fcase().type=t.value;save();render()}
else if(t.id=='fac'){fcase().act=t.value;save();render()}
else if(t.id=='fco'){fcase().contact=t.value;save();render()}
else if(t.id=='fmo'){fcase().moment=t.value;save();render()}
else if(t.id=='fop'){const f=fcase();if(t.value){f.opened=t.value;save();render()}}
else if(t.id=='frc'){const f=fcase();f.rel=t.checked;if(t.checked){const cd=relCand(f);f.relOf=cd.length?cd[0].x.id:''}else delete f.relOf;save();render()}
else if(t.id=='frs'){fcase().relOf=t.value;save();render()}
else if(t.id=='impf'){const fl=t.files&&t.files[0];if(fl){const r=new FileReader();r.onload=()=>{$('#bk').value=r.result;$('[data-a=imp]').click()};r.readAsText(fl)}}
else if(t.id=='mk'){const u=$('#mu');if(u){if(t.value=='EVA')u.value='/10';else if(u.value=='/10')u.value=t.value=='Fuerza'?'kg':'°'}fdraft.mk=t.value;if(u)fdraft.mu=u.value}
else if(t.id=='fcs'){const f=fcase();f.status=t.value;if(t.value=='Alta'){f.closed=f.closed||today()}else{delete f.closed}save();render()}
else if(t.id=='fcl'){const f=fcase();if(f&&f.status=='Alta'){f.closed=t.value||f.closed;save();render()}}
else if(t.id=='fcn'||t.id=='gnm'){render()}
else if(t.id=='cs'){st.cc=t.value;showTxt='';fsum='';save();render()}
else if(t.id=='ac'&&t.value){const c=st.clients.find(x=>x.id==t.value),r=cur();if(c&&r){c.plans.unshift({id:uid('p'),date:new Date().toISOString().slice(0,10),name:r.name,note:'',items:JSON.parse(JSON.stringify(r.items))});save();flash('Asignada a '+c.name)}render()}
else if(t.id=='rs'){st.active=t.value;save();render()}
else if(t.dataset.a=='wk'){st.week[t.dataset.d]=t.value;delArm=null;save();render()}});
