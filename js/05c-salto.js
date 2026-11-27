// Pestaña Salto de la ficha del paciente: analiza un vídeo fotograma a fotograma, calcula la altura del salto y guarda los resultados.
// El vídeo NO se guarda en ningún sitio (solo se ve mientras la pantalla está abierta); se guardan únicamente los números del salto.
// Registro de cada salto (st.clients[].saltos[], tipo de registro «salto»): {id,date,tipo,fps,fd,fa,fc?,note?,video?}
//   fd = fotograma de despegue (primero sin contacto), fa = fotograma de aterrizaje (primero con contacto), fc = contacto inicial (solo Drop jump).
//   Lo demás (tiempo de vuelo, altura, RSI…) se CALCULA al mostrarlo, nunca se guarda: así no puede quedar desfasado.
const SJ_TIPOS=['CMJ','SJ','Abalakov','Drop jump','Otro'];
const SJ_G=9.81;
const sjRecordado=()=>{try{const n=Number(localStorage.getItem('plan_sjfps'));return n>=1&&n<=2000?n:0}catch(e){return 0}};   // último valor elegido en este dispositivo (clave opcional)
const sjGuardaFps=n=>{try{localStorage.setItem('plan_sjfps',String(n))}catch(e){}};
let sj={conf:false,c:'',url:'',name:'',est:'',ok:false,cabOk:null,meta:false,id:0,auto:null,dt:0,irr:false,n:0,fps:240,tipo:'CMJ',date:'',fd:null,fa:null,fc:null,note:'',dur:0,real:null,err:''};
sj.fps=sjRecordado()||240;

const sjFr=(x,d=1)=>(Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const sjEnt=v=>{const n=Number(v);return v!==''&&v!=null&&Number.isInteger(n)&&n>=0&&n<=10000000?n:null};
const sjFps=v=>{const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=1&&n<=2000?n:null};
// Lee la cabecera del archivo (.mov/.mp4) SIN cargarlo entero: cuántos fotogramas tiene el vídeo y cuánto dura el SONIDO.
// El sonido siempre va en tiempo real aunque el vídeo venga ralentizado, así que fotogramas / duración del sonido = fotogramas por segundo a los que se grabó.
async function sjCabecera(f){
  const rd=async(o,l)=>new DataView(await f.slice(o,o+l).arrayBuffer());
  const caja=(dv,o,fin)=>{if(o+8>fin)return null;let t=dv.getUint32(o),h=8;const ty=String.fromCharCode(dv.getUint8(o+4),dv.getUint8(o+5),dv.getUint8(o+6),dv.getUint8(o+7));
    if(t==1){if(o+16>fin)return null;t=dv.getUint32(o+8)*4294967296+dv.getUint32(o+12);h=16}else if(t==0)t=fin-o;
    return t<h||o+t>fin?null:{ty,o,h,fin:o+t}};
  let o=0,moov=null;const total=f.size;
  while(o+16<=total){const dv=await rd(o,16);const b=caja(dv,0,total-o+0);if(!b)break;
    let ty=b.ty,sz=dv.getUint32(0),h=8;if(sz==1){sz=dv.getUint32(8)*4294967296+dv.getUint32(12);h=16}else if(sz==0)sz=total-o;
    if(ty=='moov'){if(sz>64*1048576)return null;moov=await rd(o+h,sz-h);break}
    if(sz<8)break;o+=sz}
  if(!moov)return null;
  const hijos=(dv,a,z)=>{const L=[];let p=a;for(;;){const b=caja(dv,p,z);if(!b)break;L.push(b);p=b.fin}return L};
  const res={};
  for(const t of hijos(moov,0,moov.byteLength).filter(x=>x.ty=='trak')){
    const md=hijos(moov,t.o+t.h,t.fin).find(x=>x.ty=='mdia');if(!md)continue;const K=hijos(moov,md.o+md.h,md.fin);
    const hd=K.find(x=>x.ty=='hdlr'),mh=K.find(x=>x.ty=='mdhd'),mi=K.find(x=>x.ty=='minf');if(!hd||!mh)continue;
    const tipo=String.fromCharCode(moov.getUint8(hd.o+hd.h+8),moov.getUint8(hd.o+hd.h+9),moov.getUint8(hd.o+hd.h+10),moov.getUint8(hd.o+hd.h+11));
    const q=mh.o+mh.h,v1=moov.getUint8(q)==1,ts=moov.getUint32(v1?q+20:q+12),du=v1?moov.getUint32(q+24)*4294967296+moov.getUint32(q+28):moov.getUint32(q+16);
    const r={dur:ts?du/ts:0};
    if(tipo=='vide'&&mi){const sb=hijos(moov,mi.o+mi.h,mi.fin).find(x=>x.ty=='stbl');if(sb){const SB=hijos(moov,sb.o+sb.h,sb.fin),sz=SB.find(x=>x.ty=='stsz'),st=SB.find(x=>x.ty=='stts');if(sz)r.n=moov.getUint32(sz.o+sz.h+8);
      if(st&&ts){const c=moov.getUint32(st.o+st.h+4),D={};let q2=st.o+st.h+8;for(let i=0;i<c&&q2+8<=st.fin;i++,q2+=8){const k=moov.getUint32(q2+4);D[k]=(D[k]||0)+moov.getUint32(q2)}
        const ks=Object.keys(D).map(Number).filter(k=>k>0).sort((a,b)=>D[b]-D[a]);if(ks.length){r.dt=ks[0]/ts;r.irr=ks.some(k=>Math.abs(k/ks[0]-1)>0.02&&D[k]>1)}}}}
    res[tipo]=r}
  return res.vide?{n:res.vide.n,vdur:res.vide.dur,dt:res.vide.dt||0,irr:!!res.vide.irr,adur:res.soun&&res.soun.dur>0?res.soun.dur:0}:null}
// Velocidades de grabación habituales: se redondea a la más cercana si está a menos de un 8 %
const sjFpsNormales=[24,25,30,48,50,60,100,120,200,240,250,480,960];
const sjAjusta=x=>{let b=null;for(const n of sjFpsNormales)if(Math.abs(x/n-1)<0.08&&(b==null||Math.abs(x/n-1)<Math.abs(x/b-1)))b=n;return b};
async function sjLeer(f,id){
  let h=null;try{h=await sjCabecera(f)}catch(e){}
  if(id!==sj.id)return;
  if(h&&h.adur>0&&h.n>0){const real=h.n/h.adur,fp=sjAjusta(real);sj.auto={n:h.n,adur:h.adur,vdur:h.vdur,real:real,fps:fp};if(fp&&!(h.vdur>0&&Math.abs(h.adur/h.vdur-1)<0.03)){sj.fps=fp;sj.conf=true;const i=$('#sjfps');if(i)i.value=fp;sjGuardaFps(fp);sjFpsPintar()}}
  else if(h)sj.auto={n:h.n,adur:0,vdur:h.vdur};
  if(h&&h.dt>=0.0004&&h.dt<=0.2){sj.dt=h.dt;sj.irr=h.irr}   // la cabecera dice cada cuánto va cada fotograma: no hace falta reproducir para medir
  sj.cabOk=!!sj.dt;sjDecidir()}
// Cálculos a partir de las marcas. Altura por tiempo de vuelo: h = g·t²/8 (t = fotogramas de vuelo / fotogramas por segundo).
function sjRes(s){
  const fps=s.fps,o={ok:false,msg:''};if(!fps)return o;
  if(s.fd==null||s.fa==null){o.msg='Marca el despegue y el aterrizaje para ver el resultado.';return o}
  if(s.fa<=s.fd){o.msg='El aterrizaje tiene que ser posterior al despegue.';return o}
  o.ok=true;o.fv=s.fa-s.fd;o.t=o.fv/fps;o.h=100*SJ_G*o.t*o.t/8;
  if(s.tipo=='Drop jump'){
    if(s.fc==null)o.msg='Marca también el contacto inicial para calcular el tiempo de contacto y el RSI.';
    else if(s.fc>=s.fd)o.msg='El contacto inicial tiene que ser anterior al despegue.';
    else{o.fcn=s.fd-s.fc;o.tc=o.fcn/fps;o.rsi=(o.h/100)/o.tc}}
  return o}
const sjDe=c=>(c.saltos||[]).slice().sort((a,b)=>(a.date<b.date?1:a.date>b.date?-1:0));
// Para cada día: mejor altura de cada tipo y comparativas (índice elástico, uso de brazos)
function sjSesiones(c){
  const M={};(c.saltos||[]).forEach(s=>{const r=sjRes(s);if(!r.ok)return;const d=M[s.date]=M[s.date]||{date:s.date,best:{}};if(!d.best[s.tipo]||r.h>d.best[s.tipo])d.best[s.tipo]=r.h});
  return Object.values(M).sort((a,b)=>a.date<b.date?1:-1).map(d=>{const b=d.best;
    d.elas=b.CMJ&&b.SJ?(b.CMJ-b.SJ)/b.SJ*100:null;      // índice elástico = (CMJ − SJ) / SJ × 100
    d.brazos=b.Abalakov&&b.CMJ?(b.Abalakov-b.CMJ)/b.CMJ*100:null;   // uso de brazos = (Abalakov − CMJ) / CMJ × 100
    return d})}

function sjAjustar(c){if(sj.c!=c.id){sjSoltar();sj.c=c.id;sj.date=today();sj.tipo='CMJ';sj.fd=sj.fa=sj.fc=null;sj.note=''}if(!sj.date)sj.date=today()}
function sjSoltar(){if(sj.url){try{URL.revokeObjectURL(sj.url)}catch(e){}}sj.url='';sj.name='';sj.est='';sj.ok=false;clearTimeout(sj.tm);sj.medido=false;sj.cabOk=null;sj.meta=false;sj.dt=0;sj.irr=false;sj.auto=null;sj.conf=false;sj.id++;sj.n=0;sj.dur=0;sj.real=null;sj.err=''}
const sjV=()=>$('#sjv');
// Dos relojes distintos: la LÍNEA DE TIEMPO DEL VÍDEO (sj.dt = segundos del vídeo entre un fotograma y el siguiente, medido) y el TIEMPO REAL
// (cada fotograma dura 1/sj.fps s reales, con sj.fps = fotogramas por segundo a los que se grabó). El iPhone puede entregar el vídeo
// ya ralentizado, y entonces no coinciden: se avanza por la línea de tiempo del vídeo y se calcula con el tiempo real.
const sjDt=()=>sj.dt||(sj.fps?1/sj.fps:0);
const sjTot=()=>sj.dur&&sjDt()?Math.max(1,Math.round(sj.dur/sjDt())):0;
const sjT=n=>(n+0.5)*sjDt();        // se pide el centro del fotograma, así no depende de redondeos
function sjIr(n){const v=sjV();if(!v||!sj.url)return;const t=sjTot();n=Math.max(0,Math.min(t?t-1:0,Math.round(n)));sj.n=n;try{v.currentTime=sjT(n)}catch(e){}sjPintar()}
// Fotograma en el que está de verdad el vídeo (puede no coincidir si los fotogramas por segundo no son los del vídeo)
function sjSeek(){const v=sjV();if(!v)return;sj.real=Math.floor(v.currentTime/sjDt()+1e-3);sjPintar()}
// Mensaje de estado de la carga (así se ve qué pasa si el móvil tarda o no puede abrir el vídeo)
function sjEst(t,mal){sj.est=t;const e=$('#sjest');if(e){e.textContent=t;e.classList.toggle('sjw',!!mal)}}
function sjMeta(){const v=sjV();if(!v)return;sj.dur=v.duration||0;sj.err='';sj.ok=true;sj.meta=true;sj.medido=false;clearTimeout(sj.tm);
  sjEst('Vídeo abierto ('+v.videoWidth+'×'+v.videoHeight+' px, '+sjFr(sj.dur,2)+' s). Midiendo sus fotogramas…');
  if(sj.cabOk===null)setTimeout(()=>{if(sj.cabOk===null){sj.cabOk=false;sjDecidir()}},3000);
  sjDecidir()}
// Con la cabecera del archivo ya se sabe el paso de fotograma; si no (otro formato), se mide reproduciendo un instante
function sjDecidir(){const v=sjV();if(!v||!sj.meta||sj.cabOk===null||sj.medido)return;
  if(sj.dt){sj.medido=true;sjListo();return}
  sj.medido=true;
  if(v.readyState>=3)sjMedir(v);else{let h=0;const go=()=>{if(h)return;h=1;sjMedir(v)};v.addEventListener('canplay',go,{once:true});setTimeout(go,4000)}}
function sjListo(){sjInforme();if(sj.n>=sjTot())sj.n=0;sjIr(sj.n);const r=$('#sjr');if(r)r.max=Math.max(0,sjTot()-1)}
// Mide cuánto dura un fotograma en la línea de tiempo del vídeo: se reproduce muy despacio y en silencio un instante y se anotan las marcas de tiempo
function sjMedir(v){
  let t=[],hecho=false,tm=0;
  const fin=()=>{if(hecho)return;hecho=true;clearTimeout(tm);try{v.pause();v.playbackRate=1}catch(e){}
    const d=[];for(let i=1;i<t.length;i++)if(t[i]>t[i-1])d.push(t[i]-t[i-1]);
    if(d.length>=3){const m=Math.min.apply(null,d);if(m>=0.0004&&m<=0.2){sj.dt=m;sj.irr=d.some(x=>Math.abs(x/m-Math.round(x/m))>0.25)}}
    if(sj.dt&&!sj.irr)sjVerificar(v,sjListo);else sjListo()};
  if(!('requestVideoFrameCallback' in v)){fin();return}
  const cb=(now,md)=>{if(hecho)return;t.push(md.mediaTime);if(t.length>=14)fin();else v.requestVideoFrameCallback(cb)};
  try{v.playbackRate=0.1;v.requestVideoFrameCallback(cb);const p=v.play();if(p&&p.catch)p.catch(fin);tm=setTimeout(fin,7000)}catch(e){fin()}}
// Comprobación: en un vídeo uniforme, el fotograma n está en n·dt (respecto al primero). Si no, la cámara lenta está aplicada a trozos
function sjVerificar(v,fin){
  const tot=sjTot(),L=[0,Math.floor(tot/2),Math.floor(tot*0.75),tot-1].filter((x,i,a)=>a.indexOf(x)==i),dt=sj.dt,P={};let i=0,tm=0;
  const sig=()=>{clearTimeout(tm);if(i>=L.length){const o=P[0];if(o!=null)for(const n of L)if(P[n]!=null&&Math.abs(P[n]-o-n*dt)>1.5*dt)sj.irr=true;fin();return}
    const n=L[i++];let ok=false;const go=(now,md)=>{if(ok)return;ok=true;P[n]=md.mediaTime;sig()};
    try{v.requestVideoFrameCallback(go);v.currentTime=(n+0.5)*dt}catch(e){ok=true;sig();return}
    tm=setTimeout(()=>{if(!ok){ok=true;sig()}},900)};
  if(!('requestVideoFrameCallback' in v)){fin();return}
  sig()}
function sjInforme(){
  const v=sjV(),dt=sjDt(),fv=1/dt,tot=sjTot(),A=sj.auto;let m='Vídeo listo: '+(v?v.videoWidth+'×'+v.videoHeight+' px, ':'')+sjFr(sj.dur,2)+' s de vídeo'+(sj.dt?', '+tot+' fotogramas':'')+'. ',mal=false;
  if(A&&A.adur>0){
    const igual=A.vdur>0&&Math.abs(A.adur/A.vdur-1)<0.03;
    if(!igual)m+='Por el sonido, el clip duró '+sjFr(A.adur,2)+' s reales: '+A.n+' fotogramas en ese tiempo son unos '+sjFr(A.real,0)+' por segundo'+(A.fps?', así que se grabó a '+A.fps+' fps':'')+'. ';
    if(A.vdur>0&&Math.abs(A.adur/A.vdur-1)<0.03){m+='⚠ El sonido dura lo mismo que el vídeo: o es un vídeo normal, o el iPhone lo ha convertido (por ejemplo al recortarlo en Fotos) y ha estirado también el sonido. En ese caso el archivo no dice a qué velocidad se grabó: elige tú abajo los fotogramas por segundo (30 o 60 si era normal; 120 o 240 si era cámara lenta).';mal=true}
    else if(A.fps&&sj.fps==A.fps)m+='Ya he puesto '+A.fps+' fotogramas por segundo abajo.';
    else if(A.fps){m+='⚠ Abajo tienes '+sj.fps+'; si no lo cambiaste tú a propósito, vuelve a poner '+A.fps+'.';mal=true}
    else{m+='⚠ No coincide con una velocidad de grabación habitual: revisa los fotogramas por segundo de abajo.';mal=true}}
  else if(!sj.dt)m+='No he podido medir sus fotogramas. Elige abajo a cuántos fotogramas por segundo grabaste.';
  else{m+='Este vídeo no trae sonido, así que no puedo saber a qué velocidad se grabó (su línea de tiempo va a '+sjFr(fv,0)+' fotogramas por segundo). Elige abajo cómo lo grabaste: 30 o 60 si era normal; 120 o 240 si era cámara lenta.';mal=true}
  if(sj.irr){m+=' ⚠ La velocidad del vídeo no es uniforme (cámara lenta aplicada a trozos): las medidas no serían fiables. Usa el vídeo original sin editar.';mal=true}
  sjEst(m,mal)}
function sjEsperar(){clearTimeout(sj.tm);sj.tm=setTimeout(()=>{if(sj.url&&!sj.ok)sjEst('El vídeo todavía no se ha abierto. Si es muy largo o pesado, espera unos segundos más. Si no aparece, prueba a elegirlo desde la app Archivos o a grabar un clip más corto.',true)},8000)}
function sjErr(){const v=sjV(),c=v&&v.error?v.error.code:'?';sj.err='Este navegador no ha podido abrir ese vídeo (código '+c+'). Prueba con el archivo original de la cámara (.mov o .mp4).';const e=$('#sjerr');if(e)e.textContent=sj.err;sjEst('No se pudo abrir el vídeo.',true)}

function sjFpsHTML(){return`<div class="segc sjfcs" role="group" aria-label="Fotogramas por segundo">${[30,60,120,240].map(n=>`<button data-a="sjf" data-v="${n}" class="${sj.conf&&sj.fps==n?'on':''}">${n}</button>`).join('')}</div><label class="lb sjfo">Otro valor<input id="sjfps" inputmode="decimal" value="${sj.fps}"></label>`}
function sjFpsPintar(){const e=$('#sjfc');if(e)e.innerHTML=sjFpsHTML()}
function sjMarcasHTML(){
  const m=[['fd','Despegue','Primer fotograma con los pies en el aire'],['fa','Aterrizaje','Primer fotograma con los pies en contacto']];
  if(sj.tipo=='Drop jump')m.unshift(['fc','Contacto inicial','Primer fotograma al caer desde el cajón']);
  return m.map(([k,t,h])=>`<div class="sjm"><button class="chip" data-a="sjm" data-v="${k}" title="${h}">Marcar ${t.toLowerCase()}</button><input id="sjm-${k}" class="sjmi" inputmode="numeric" aria-label="Fotograma de ${t.toLowerCase()}" placeholder="—" value="${sj[k]==null?'':sj[k]}"><button class="chip" data-a="sjg" data-v="${k}" ${sj[k]==null?'disabled':''}>Ir</button></div>`).join('')}
function sjInfoHTML(){
  const t=sjTot(),r=sjRes(sj),desv=sj.real!=null&&sj.url&&sj.real!=sj.n;
  let h=`<div class="sjn"><b>Fotograma ${sj.n}</b>${t?` <span class="mut">de ${t-1}</span>`:''}${sj.fps?` · <span class="mut">${sjFr(sj.n/sj.fps,3)} s</span>`:''}</div>`;
  if(desv)h+=`<div class="sjw">⚠ El vídeo está en el fotograma ${sj.real}, no en el ${sj.n}. Revisa los fotogramas por segundo del vídeo.</div>`;
  h+=`<div class="sjmk">${sjMarcasHTML()}</div>`;
  if(sj.url&&!sj.conf)h+=`<p class="sjw">Elige arriba a cuántos fotogramas por segundo grabaste el vídeo (30 o 60 si era un vídeo normal; 120 o 240 si era cámara lenta) para ver la altura.</p>`;
  else if(r.ok){h+=`<div class="sjrs"><div><span class="mut">Tiempo de vuelo</span><b>${sjFr(r.t,3)} s</b><small>${r.fv} fotogramas</small></div><div><span class="mut">Altura</span><b>${sjFr(r.h)} cm</b></div>`+(r.tc!=null?`<div><span class="mut">Contacto</span><b>${sjFr(r.tc,3)} s</b><small>${r.fcn} fotogramas</small></div><div><span class="mut">RSI</span><b>${sjFr(r.rsi,2)}</b></div>`:'')+`</div>`}
  if(r.ok&&(sj.conf||!sj.url)&&(r.h>70||r.h<3||r.t<0.2||r.t>0.75))h+=`<p class="sjw">⚠ ${sjFr(r.h)} cm (${sjFr(r.t,3)} s en el aire) es poco creíble para un salto. Revisa que despegue y aterrizaje estén bien marcados y que los fotogramas por segundo (${sj.fps}) sean los de la cámara: un salto normal dura en el aire entre 0,3 y 0,7 s, y con ${r.fv} fotogramas eso corresponde a unos ${sjFr(r.fv/0.7,0)}–${sjFr(r.fv/0.3,0)} fps.</p>`;
  if(r.msg&&(sj.conf||!sj.url))h+=`<p class="mut pcn sjhint">${r.msg}</p>`;
  return h}
function sjPintar(){
  const e=$('#sjinfo');if(e&&!(document.activeElement&&e.contains(document.activeElement)&&document.activeElement.tagName=='INPUT'))e.innerHTML=sjInfoHTML();
  else if(e){/* se está escribiendo un número: no se repinta el campo, pero sí el resto */const a=document.activeElement.id;e.innerHTML=sjInfoHTML();const n=$('#'+a);if(n){n.focus();try{const l=n.value.length;n.setSelectionRange(l,l)}catch(x){}}}
  const r=$('#sjr');if(r){r.max=Math.max(0,sjTot()-1);r.value=sj.n}}
function sjListaHTML(c){
  const L=sjDe(c);if(!L.length)return'<p class="mut pcn">Todavía no hay saltos guardados.</p>';
  return`<ul class="sjl">${L.map(s=>{const r=sjRes(s);return`<li><div class="sjla"><b>${r.ok?sjFr(r.h)+' cm':'—'}</b> <span class="sjtp">${esc(s.tipo)}</span><div class="mut sjsub">${esc(fmtC(s.date)||s.date)} · ${r.ok?'vuelo '+sjFr(r.t,3)+' s':'sin resultado'} · ${sjFr(s.fps,0)} fps${r.tc!=null?` · contacto ${sjFr(r.tc,3)} s · RSI ${sjFr(r.rsi,2)}`:''}</div>${s.note?`<div class="sjnt">${esc(s.note)}</div>`:''}</div><button class="chip" data-a="sjdel" data-id="${esc(s.id)}" aria-label="Eliminar salto">${ic('trash',18)}</button></li>`}).join('')}</ul>`}
function sjIndHTML(c){
  const S=sjSesiones(c);if(!S.length)return'<p class="mut pcn">Cuando guardes saltos aparecerán aquí la mejor altura de cada tipo y las comparativas.</p>';
  const f=(x,d=1,u='')=>x==null?'<span class="mut">—</span>':sjFr(x,d)+u;
  return`<div class="sjtw"><table class="prtb"><thead><tr><th>Día</th><th>SJ</th><th>CMJ</th><th>Abalakov</th><th>Índice elástico</th><th>Uso de brazos</th></tr></thead><tbody>${S.map(d=>`<tr><td>${esc(fmtC(d.date)||d.date)}</td><td>${f(d.best.SJ)}</td><td>${f(d.best.CMJ)}</td><td>${f(d.best.Abalakov)}</td><td>${f(d.elas,1,' %')}</td><td>${f(d.brazos,1,' %')}</td></tr>`).join('')}</tbody></table></div><p class="mut prnote">Alturas en cm; se usa el mejor salto de cada tipo del día. Índice elástico = (CMJ − SJ) / SJ × 100. Uso de brazos = (Abalakov − CMJ) / CMJ × 100.</p>`}
function sjListasPintar(){const c=cc();if(!c)return;const a=$('#sjlist'),b=$('#sjind');if(a)a.innerHTML=sjListaHTML(c);if(b)b.innerHTML=sjIndHTML(c)}

function paSalto(c){
  sjAjustar(c);
  const v=sj.url?`<div class="sjvw"><video id="sjv" src="${sj.url}#t=0.001" muted playsinline preload="auto" disablepictureinpicture onloadedmetadata="sjMeta()" onseeked="sjSeek()" onerror="sjErr()"></video></div>
  <div id="sjerr" class="sjw">${esc(sj.err)}</div>
  <div class="sjst"><button class="chip" data-a="sjs" data-v="-10" aria-label="Retroceder 10 fotogramas">−10</button><button class="chip" data-a="sjs" data-v="-1" aria-label="Fotograma anterior">‹ 1</button><button class="chip" data-a="sjs" data-v="1" aria-label="Fotograma siguiente">1 ›</button><button class="chip" data-a="sjs" data-v="10" aria-label="Avanzar 10 fotogramas">+10</button></div>
  <input id="sjr" type="range" min="0" max="${Math.max(0,sjTot()-1)}" value="${sj.n}" step="1" aria-label="Posición en el vídeo">`:'';
  return`<div class="card pcd sjc"><div class="pct">${ic('pulse',20)}<b>Analizar un salto</b></div>
  <p class="mut pcn">Elige el vídeo del salto (cámara fija). El vídeo solo se usa para medir: no se guarda en la app, solo los resultados.</p>
  <details class="sjtips"><summary>Consejos para medir bien</summary><ul><li>Graba a 240 fps con la cámara fija y el cuerpo entero a la vista.</li><li>En iPhone, elige el vídeo original en cámara lenta, sin comprimir. Si al pulsar «1 ›» la imagen salta mucho, el vídeo no conserva todos los fotogramas.</li><li>Despegue = primer fotograma con los pies en el aire. Aterrizaje = primer fotograma con los pies en contacto.</li><li>En ordenador puedes usar las flechas ← → (con Mayús, de 10 en 10).</li></ul></details>
  <div class="row sjfile"><label class="chip pri sjfl">${sj.url?'Cambiar vídeo':'Elegir vídeo'}<input id="sjf" type="file" accept="video/*" hidden></label>${sj.url?`<span class="mut sjnm">${esc(sj.name)}</span><button class="chip" data-a="sjx">Quitar vídeo</button>`:''}</div>
  ${sj.url?`<div id="sjest" class="mut sjest">${esc(sj.est)}</div>`:''}
  ${v}
  <div id="sjinfo">${sjInfoHTML()}</div>
  <div class="sjfq"><div class="lb">¿A cuántos fotogramas por segundo grabaste?</div><div id="sjfc">${sjFpsHTML()}</div></div>
  <div class="sjpar"><label class="lb">Tipo de salto<select id="sjtipo">${SJ_TIPOS.map(t=>`<option${t==sj.tipo?' selected':''}>${t}</option>`).join('')}</select></label><label class="lb">Fecha<input id="sjd" type="date" max="${today()}" value="${esc(sj.date)}"></label></div>
  <label class="lb sjnl">Nota (opcional)<input id="sjnote" maxlength="200" autocomplete="off" value="${esc(sj.note)}"></label>
  <div class="row sjgd"><button class="pri" data-a="sjsave">Guardar salto</button></div></div>
  <div class="card pcd"><div class="pct">${ic('clock',20)}<b>Saltos guardados</b></div><div id="sjlist">${sjListaHTML(c)}</div></div>
  <div class="card pcd"><div class="pct">${ic('file',20)}<b>Comparativas</b></div><div id="sjind">${sjIndHTML(c)}</div></div>`}

// Acciones (data-a="sj…") y campos
function sjAccion(a,b){
  const c=cc();if(!c)return false;
  if(a=='sjf'){sj.fps=+b.dataset.v;sj.conf=true;sjGuardaFps(sj.fps);sjFpsPintar();sjIr(sj.n);if(sj.meta)sjInforme();return true}
  if(a=='sjs'){sjIr(sj.n+(+b.dataset.v));return true}
  if(a=='sjm'){if(!sj.url){flash('Primero elige un vídeo');return true}sj[b.dataset.v]=sj.n;sjPintar();return true}
  if(a=='sjg'){const n=sj[b.dataset.v];if(n!=null)sjIr(n);return true}
  if(a=='sjx'){sjSoltar();sj.fd=sj.fa=sj.fc=null;render();return true}
  if(a=='sjdel'){const i=(c.saltos||[]).findIndex(s=>s.id==b.dataset.id);if(i<0)return true;if(!confirm('¿Eliminar este salto? Esta acción no se puede deshacer.'))return true;c.saltos.splice(i,1);if(!c.saltos.length)delete c.saltos;save();sjListasPintar();flash('Salto eliminado');return true}
  if(a=='sjsave'){
    if(sj.url&&!sj.conf){flash('Elige primero los fotogramas por segundo');return true}
    const r=sjRes(sj);if(!r.ok){flash(r.msg||'Faltan marcas');return true}
    if(sj.tipo=='Drop jump'&&sj.fc==null){flash('Marca el contacto inicial');return true}
    if(sj.tipo=='Drop jump'&&r.tc==null){flash(r.msg);return true}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(sj.date)||sj.date>today()){flash('Revisa la fecha');return true}
    const s={id:uid('j'),date:sj.date,tipo:sj.tipo,fps:sj.fps,fd:sj.fd,fa:sj.fa};
    if(sj.tipo=='Drop jump')s.fc=sj.fc;if(sj.note.trim())s.note=sj.note.trim();if(sj.name)s.video=sj.name;
    (c.saltos=c.saltos||[]).push(s);save();
    sj.fd=sj.fa=sj.fc=null;sj.note='';const n=$('#sjnote');if(n)n.value='';
    sjPintar();sjListasPintar();flash('Salto guardado: '+sjFr(r.h)+' cm');return true}
  return false}
function sjInput(t){
  if(!t||!t.id)return false;
  if(t.id=='sjf'){const f=t.files&&t.files[0];if(!f)return true;sjSoltar();sj.url=URL.createObjectURL(f);sj.name=f.name;sj.n=0;sj.fd=sj.fa=sj.fc=null;sj.est='Cargando «'+f.name+'» ('+sjFr((f.size||0)/1048576,1)+' MB)…';render();sjEsperar();sjLeer(f,sj.id);return true}
  if(t.id=='sjfps'){const n=sjFps(t.value);if(n){sj.fps=n;sj.conf=true;sjGuardaFps(n);const e=$('#sjfc .segc');if(e)e.querySelectorAll('button').forEach(x=>x.classList.toggle('on',+x.dataset.v==n));sjIr(sj.n);if(sj.meta)sjInforme()}return true}
  if(t.id=='sjtipo'){sj.tipo=t.value;if(sj.tipo!='Drop jump')sj.fc=null;sjPintar();return true}
  if(t.id=='sjd'){sj.date=t.value;return true}
  if(t.id=='sjnote'){sj.note=t.value;return true}
  if(t.id=='sjr'){sjIr(+t.value);return true}
  const m=/^sjm-(fd|fa|fc)$/.exec(t.id);if(m){sj[m[1]]=sjEnt(t.value.trim());sjPintar();return true}
  return false}
// Flechas del teclado (ordenador): fotograma a fotograma
document.addEventListener('keydown',ev=>{if(typeof tab=='undefined'||tab!='cli'||ptab!='sal'||!sj.url)return;const t=ev.target&&ev.target.tagName;if(t=='INPUT'||t=='SELECT'||t=='TEXTAREA')return;
  if(ev.key=='ArrowRight'){sjIr(sj.n+(ev.shiftKey?10:1));ev.preventDefault()}else if(ev.key=='ArrowLeft'){sjIr(sj.n-(ev.shiftKey?10:1));ev.preventDefault()}});
