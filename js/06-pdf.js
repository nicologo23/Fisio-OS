// Informes en PDF (rutinas, semanas y grupos) y compartir/descargar
const svgPng=(svg,px,py)=>new Promise((res,rej)=>{py=py||px;const t=svg.replace(/currentColor/g,'#222222').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ width="\d+" height="\d+"/,` width="${px}" height="${py}"`),im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=px;c.height=py;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,px,py);g.drawImage(im,0,0,px,py);res(c.toDataURL('image/png'))};im.onerror=()=>rej(new Error('svg'));im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(t)});
const PDFX={png:svgPng},pdfText=x=>String(x??'').replace(/→/g,'->').replace(/[–—]/g,'-').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/•/g,'-').replace(/[^\x00-\xFF]/g,'?');
async function buildPDF(sp){const J=window.jspdf&&window.jspdf.jsPDF;if(!J)throw new Error('nolib');
const doc=new J({unit:'mm',format:'a4',compress:true}),W=210,M=14,CW=W-2*M,AC=[15,118,110],T=pdfText;let y=M;
const need=h=>{if(y+h>284){doc.addPage();y=M}},txt=(x,px,py,sz,st,col,op)=>{doc.setFont('helvetica',st||'normal');doc.setFontSize(sz);doc.setTextColor(...(col||[30,30,30]));doc.text(T(x),px,py,op)},wrap=(x,wd,sz,st)=>{doc.setFont('helvetica',st||'normal');doc.setFontSize(sz);return doc.splitTextToSize(T(x),wd)};
const sets=its=>its.reduce((a,it)=>a+(+it.sets||0),0);
txt(sp.title,M,y+6,18,'bold',AC);y+=12;txt(sp.sub||'',M,y,10,'normal',[90,90,90]);y+=5;txt('Paciente: '+sp.athlete,M,y,10,'bold');y+=6;
if(sp.note){wrap('Notas: '+sp.note,CW,9).forEach(l=>{txt(l,M,y,9,'italic',[70,70,70]);y+=4});y+=1}
doc.setDrawColor(...AC);doc.setLineWidth(.6);doc.line(M,y,W-M,y);y+=5;
if(sp.week){txt('Resumen semanal',M,y+4,11,'bold');y+=8;sp.week.forEach(d=>{txt(d.day+':',M,y,10,'bold');txt(d.name?`${d.name}  (${d.n} ejercicios, ${d.sets} series)`:'Descanso',M+28,y,10,'normal',d.name?[30,30,30]:[130,130,130]);y+=6})}
else{const its=sp.sections[0].items;txt(`${its.length} ejercicios · ${sets(its)} series en total`,M,y+1,9.5,'normal',[90,90,90]);y+=7}
const block=async(it,n)=>{const e=byId(it.e),fr=e?(pic(e,120).match(/<svg[\s\S]*?<\/svg>/g)||[]):[],imgs=await Promise.all(fr.map(x=>PDFX.png(x,300)));
const iso=e&&isoOf(e),vol=iso?`${it.sets} series x ${it.hold||30} s de mantenimiento`:`${it.sets} series x ${it.reps} repeticiones`,tr=!iso&&/^\d+$/.test(String(it.reps))&&+it.sets?` (${it.sets*it.reps} repeticiones en total)`:'';
const info=[vol+tr];if(it.load)info.push('Carga: '+it.load);if(it.rest!==''&&it.rest!=null)info.push('Descanso: '+it.rest+' s');if(it.note)info.push('Notas: '+it.note);
const ix=M+imgs.length*31+3,iw=W-M-ix,ins=e&&e.i?wrap(e.i,CW,8.5):[],nm=wrap(n+'. '+(e?e.n:'(ejercicio no disponible)'),iw,12,'bold'),il=[];info.forEach(x=>wrap(x,iw,9.5).forEach(l=>il.push(l)));
const top=Math.max(30,nm.length*5+il.length*4.6+4),h=top+(ins.length?ins.length*3.7+9:0)+6;need(h);
imgs.forEach((im,i)=>{doc.addImage(im,'PNG',M+i*31,y,30,30);doc.setDrawColor(215);doc.setLineWidth(.2);doc.rect(M+i*31,y,30,30)});
let ty=y+5;nm.forEach(l=>{txt(l,ix,ty,12,'bold');ty+=5});ty+=1;il.forEach(l=>{txt(l,ix,ty,9.5,'normal',[40,40,40]);ty+=4.6});
y+=top+1;if(ins.length){txt('Instrucciones',M,y+3,8.5,'bold',AC);y+=6;ins.forEach(l=>{txt(l,M,y+1,8.5,'normal',[60,60,60]);y+=3.7})}
y+=3;doc.setDrawColor(230);doc.setLineWidth(.2);doc.line(M,y,W-M,y);y+=4};
for(let si=0;si<sp.sections.length;si++){const S=sp.sections[si];
if(sp.week){doc.addPage();y=M;txt(S.heading,M,y+5,14,'bold',AC);y+=9;txt(`${S.items.length} ejercicios · ${sets(S.items)} series en total`,M,y,9.5,'normal',[90,90,90]);y+=6}
for(let k=0;k<S.items.length;k++)await block(S.items[k],k+1)}
const N=doc.getNumberOfPages();for(let i=1;i<=N;i++){doc.setPage(i);txt(sp.athlete+' · '+sp.title,M,291,8,'normal',[130,130,130]);txt('Página '+i+' de '+N,W-M,291,8,'normal',[130,130,130],{align:'right'})}
return doc}
let pdfBusy=false,pdfPend=null;
async function pdfShare(blob,nm){const f=new File([blob],nm,{type:'application/pdf'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:nm});return true}return false}
function pdfDownload(blob,nm){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=nm;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
function pdfBar(){let b=document.getElementById('pdfbar');if(!b){b=document.createElement('div');b.id='pdfbar';document.body.appendChild(b)}b.innerHTML=`<span style="flex:1;min-width:150px">PDF listo: <b>${esc(pdfPend.nm)}</b></span><button class="pri" data-a="pdfshare">Compartir / Guardar</button><button data-a="pdfx">Cerrar</button>`}
function pdfX(){const b=document.getElementById('pdfbar');if(b)b.remove();pdfPend=null}
async function pdfGo(){if(!pdfPend)return;try{if(await pdfShare(pdfPend.blob,pdfPend.nm)){pdfX();return}}catch(e){if(e&&e.name=='AbortError')return}pdfDownload(pdfPend.blob,pdfPend.nm);pdfX();flash('PDF descargado')}
async function pdfSave(sp,nm){if(pdfBusy)return;pdfBusy=true;flash('Generando PDF…');try{const doc=await (sp.group?buildGroupPDF(sp.R):buildPDF(sp)),blob=doc.output('blob');try{if(await pdfShare(blob,nm)){flash('PDF listo');return}}catch(e){if(e&&e.name=='AbortError')return;pdfPend={blob,nm};pdfBar();return}pdfDownload(blob,nm);flash('PDF descargado')}catch(e){flash(e&&e.message=='nolib'?'No se pudo cargar el generador de PDF':'No se pudo crear el PDF')}finally{pdfBusy=false}}
const pdfName=(c,t)=>('Informe_'+c.name+'_'+t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\-]+/g,'_')+(/\d{4}-\d{2}-\d{2}/.test(t)?'':'_'+today())+'.pdf';
const specPlan=(c,p)=>({athlete:c.name,title:p.name,sub:'Rutina asignada el '+fmtD(p.date),note:p.note||'',sections:[{items:p.items}]});
const specWeek=(c,w)=>({athlete:c.name,title:w.name,sub:'Plan semanal · semana del '+fmtD(wkInicio(w).iso)+' (asignado el '+fmtD(w.date)+')',note:w.note||'',week:w.days.map(d=>({day:d.day,name:d.name,n:d.items.length,sets:d.items.reduce((a,it)=>a+(+it.sets||0),0)})),sections:w.days.filter(d=>d.name).map(d=>({heading:d.day+' - '+d.name,items:d.items}))});
async function buildGroupPDF(R){const J=window.jspdf&&window.jspdf.jsPDF;if(!J)throw new Error('nolib');
const doc=new J({unit:'mm',format:'a4',compress:true}),W=210,M=14,AC=[15,118,110],T=pdfText;let y=M;
const need=h=>{if(y+h>284){doc.addPage();y=M}},txt=(x,px,py,sz,st_,col,op)=>{doc.setFont('helvetica',st_||'normal');doc.setFontSize(sz);doc.setTextColor(...(col||[30,30,30]));doc.text(T(x),px,py,op)};
const H2=t=>{need(16);y+=3;txt(t,M,y+5,12,'bold',AC);y+=9},bars=rows=>{const mx=Math.max(1,...rows.map(r=>r[1]));if(!rows.length){txt('Sin datos en el período.',M,y+3,9,'normal',[130,130,130]);y+=6;return}rows.forEach(([k,v,sub])=>{need(6);const w=Math.max(.8,v/mx*80);txt(k,M,y+3.4,9);doc.setFillColor(...AC);doc.rect(M+58,y+.8,w,3.2,'F');txt(String(v)+(sub?'  ('+sub+')':''),M+58+w+2,y+3.4,9,'normal',[60,60,60]);y+=5.6})};
txt('Informe de lesiones del grupo',M,y+6,18,'bold',AC);y+=12;txt(R.g.name,M,y,13,'bold');y+=6;txt(`Período: ${fmtD(R.from)} - ${fmtD(R.to)} · ${R.mem.length} pacientes · generado el ${fmtD(today())}`,M,y,9.5,'normal',[90,90,90]);y+=4;
doc.setDrawColor(...AC);doc.setLineWidth(.6);doc.line(M,y,W-M,y);y+=6;
grpSent(R).forEach(l=>{need(6);txt('- '+l,M,y,10);y+=5.6});
y+=1;txt('Severidad según días en tratamiento, calculada al dar el alta: leve 0 días, mínima 1-3, ligera 4-7, moderada 8-28, severa más de 28.',M,y+2,8,'italic',[110,110,110]);y+=6;
H2('Severidad');bars(R.sev.concat(R.act?[['En curso',R.act]]:[]));H2('Tipo');bars(R.type);H2('Acción');bars(R.action);H2('Contacto');bars(R.contact);H2('Momento');bars(R.moment);H2('Lado');bars(R.side);
need(100);H2('Localización');const ims=await Promise.all(['f','b'].map(v=>PDFX.png(heatSvg(R.zones,v),200,400)));need(82);
ims.forEach((im,i)=>{doc.addImage(im,'PNG',M+i*40,y,38,76);txt(i?'Espalda':'Frente',M+i*40+19,y+79,8,'normal',[110,110,110],{align:'center'})});
let zy=y+3;regRows(R).forEach(([k,n,sub])=>{txt(`${k}: ${n}${sub?'  ('+sub+')':''}`,M+86,zy,9.5);zy+=5.4});if(R.nozone)txt(`${R.nozone} lesiones sin zona marcada`,M+86,zy,8.5,'italic',[110,110,110]);if(!R.rlist.length)txt('Sin zonas marcadas.',M+86,zy,9.5,'normal',[130,130,130]);y+=84;
H2('Tiempo hasta el alta');if(R.days){txt(`Media ${r1c(R.days.avg)} días · mediana ${r1c(R.days.med)} · máximo ${R.days.max} (${R.days.n} lesiones con alta)`,M,y+3,10);y+=7;bars(R.dtype.map(([k,n,a])=>[k,Math.round(a*10)/10,n+(n>1?' altas':' alta')]))}else{txt('Aún no hay lesiones con alta en el período.',M,y+3,9.5,'normal',[130,130,130]);y+=6}
H2('Recaídas');if(R.rel.length)R.rel.forEach(r=>{need(11);txt(`${r.c.name}: ${r.f.name}`,M,y+3,9.5,'bold');y+=5;txt(r.prev?`Recaída de: ${r.prev.name}`:'Lesión anterior no vinculada',M+4,y+3,9,'normal',[90,90,90]);y+=6.5});else{txt('Sin recaídas en el período.',M,y+3,9.5,'normal',[130,130,130]);y+=6}
H2('Por paciente');const cx=[M,M+68,M+88,M+108,M+128,M+150];need(8);['Paciente','Lesiones','En curso','Severas','Recaídas','Días medios hasta alta'].forEach((h,i)=>txt(h,cx[i],y+3,8.5,'bold',[90,90,90]));y+=5.5;
R.per.forEach(r=>{need(6);[r.name,r.n,r.act,r.sv,r.rel,r.avg==null?'-':r1c(r.avg)].forEach((v,i)=>txt(String(v),cx[i],y+3,9.5));doc.setDrawColor(230);doc.setLineWidth(.2);doc.line(M,y+4.6,W-M,y+4.6);y+=6});if(!R.per.length){txt('Sin lesiones en el período.',M,y+3,9.5,'normal',[130,130,130]);y+=6}
H2('Lesiones en curso');if(R.active.length)R.active.forEach(l=>{need(6);txt(`${l.c.name}: ${l.f.name}  (${l.s.days} días en tratamiento)`,M,y+3,9.5);y+=5.6});else{txt('No hay lesiones en curso en el período.',M,y+3,9.5,'normal',[130,130,130]);y+=6}
const N=doc.getNumberOfPages();for(let i=1;i<=N;i++){doc.setPage(i);txt('Informe de grupo · '+R.g.name,M,291,8,'normal',[130,130,130]);txt('Página '+i+' de '+N,W-M,291,8,'normal',[130,130,130],{align:'right'})}
return doc}
