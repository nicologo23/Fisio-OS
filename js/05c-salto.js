// Pestaña Salto de la ficha del paciente: analiza un vídeo fotograma a fotograma, calcula la altura del salto y guarda los resultados.
// El vídeo NO se guarda en ningún sitio (solo se ve mientras la pantalla está abierta); se guardan únicamente los números del salto.
// Registro de cada salto (st.clients[].saltos[], tipo de registro «salto»): {id,date,tipo,fps,fd,fa,fc?,note?,video?}
//   fd = fotograma de despegue (primero sin contacto), fa = fotograma de aterrizaje (primero con contacto), fc = contacto inicial (solo Drop jump).
//   Lo demás (tiempo de vuelo, altura, RSI…) se CALCULA al mostrarlo, nunca se guarda: así no puede quedar desfasado.
const SJ_TIPOS=['CMJ','SJ','Abalakov','Drop jump','Otro'];
const SJ_G=9.81;
let sj={c:'',url:'',name:'',est:'',ok:false,n:0,fps:240,tipo:'CMJ',date:'',fd:null,fa:null,fc:null,note:'',dur:0,real:null,err:''};

const sjFr=(x,d=1)=>(Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const sjEnt=v=>{const n=Number(v);return v!==''&&v!=null&&Number.isInteger(n)&&n>=0&&n<=10000000?n:null};
const sjFps=v=>{const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=1&&n<=2000?n:null};
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
function sjSoltar(){if(sj.url){try{URL.revokeObjectURL(sj.url)}catch(e){}}sj.url='';sj.name='';sj.est='';sj.ok=false;clearTimeout(sj.tm);sj.n=0;sj.dur=0;sj.real=null;sj.err=''}
const sjV=()=>$('#sjv');
const sjTot=()=>sj.dur&&sj.fps?Math.max(1,Math.round(sj.dur*sj.fps)):0;
const sjT=n=>(n+0.5)/sj.fps;        // se pide el centro del fotograma, así no depende de redondeos
function sjIr(n){const v=sjV();if(!v||!sj.url)return;const t=sjTot();n=Math.max(0,Math.min(t?t-1:0,Math.round(n)));sj.n=n;try{v.currentTime=sjT(n)}catch(e){}sjPintar()}
// Fotograma en el que está de verdad el vídeo (puede no coincidir si los fotogramas por segundo no son los del vídeo)
function sjSeek(){const v=sjV();if(!v)return;sj.real=Math.floor(v.currentTime*sj.fps+1e-3);sjPintar()}
// Mensaje de estado de la carga (así se ve qué pasa si el móvil tarda o no puede abrir el vídeo)
function sjEst(t,mal){sj.est=t;const e=$('#sjest');if(e){e.textContent=t;e.classList.toggle('sjw',!!mal)}}
function sjMeta(){const v=sjV();if(!v)return;sj.dur=v.duration||0;sj.err='';sj.ok=true;clearTimeout(sj.tm);
  sjEst('Vídeo listo: '+v.videoWidth+'×'+v.videoHeight+' px, '+sjFr(sj.dur,2)+' s. Con '+sj.fps+' fps son '+sjTot()+' fotogramas.');
  // En iPhone el primer fotograma no se pinta hasta que el vídeo arranca una vez: se pone en marcha en silencio y se para
  let p=null;try{p=v.play()}catch(e){}
  if(p&&p.then)p.then(()=>{v.pause();sjIr(sj.n)}).catch(()=>sjIr(sj.n));else sjIr(sj.n)}
function sjEsperar(){clearTimeout(sj.tm);sj.tm=setTimeout(()=>{if(sj.url&&!sj.ok)sjEst('El vídeo todavía no se ha abierto. Si es muy largo o pesado, espera unos segundos más. Si no aparece, prueba a elegirlo desde la app Archivos o a grabar un clip más corto.',true)},8000)}
function sjErr(){const v=sjV(),c=v&&v.error?v.error.code:'?';sj.err='Este navegador no ha podido abrir ese vídeo (código '+c+'). Prueba con el archivo original de la cámara (.mov o .mp4).';const e=$('#sjerr');if(e)e.textContent=sj.err;sjEst('No se pudo abrir el vídeo.',true)}

function sjMarcasHTML(){
  const m=[['fd','Despegue','Primer fotograma con los pies en el aire'],['fa','Aterrizaje','Primer fotograma con los pies en contacto']];
  if(sj.tipo=='Drop jump')m.unshift(['fc','Contacto inicial','Primer fotograma al caer desde el cajón']);
  return m.map(([k,t,h])=>`<div class="sjm"><button class="chip" data-a="sjm" data-v="${k}" title="${h}">Marcar ${t.toLowerCase()}</button><input id="sjm-${k}" class="sjmi" inputmode="numeric" aria-label="Fotograma de ${t.toLowerCase()}" placeholder="—" value="${sj[k]==null?'':sj[k]}"><button class="chip" data-a="sjg" data-v="${k}" ${sj[k]==null?'disabled':''}>Ir</button></div>`).join('')}
function sjInfoHTML(){
  const t=sjTot(),r=sjRes(sj),desv=sj.real!=null&&sj.url&&sj.real!=sj.n;
  let h=`<div class="sjn"><b>Fotograma ${sj.n}</b>${t?` <span class="mut">de ${t-1}</span>`:''}${sj.fps?` · <span class="mut">${sjFr(sj.n/sj.fps,3)} s</span>`:''}</div>`;
  if(desv)h+=`<div class="sjw">⚠ El vídeo está en el fotograma ${sj.real}, no en el ${sj.n}. Revisa los fotogramas por segundo del vídeo.</div>`;
  h+=`<div class="sjmk">${sjMarcasHTML()}</div>`;
  if(r.ok){h+=`<div class="sjrs"><div><span class="mut">Tiempo de vuelo</span><b>${sjFr(r.t,3)} s</b><small>${r.fv} fotogramas</small></div><div><span class="mut">Altura</span><b>${sjFr(r.h)} cm</b></div>`+(r.tc!=null?`<div><span class="mut">Contacto</span><b>${sjFr(r.tc,3)} s</b><small>${r.fcn} fotogramas</small></div><div><span class="mut">RSI</span><b>${sjFr(r.rsi,2)}</b></div>`:'')+`</div>`}
  if(r.msg)h+=`<p class="mut pcn sjhint">${r.msg}</p>`;
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
  <div class="sjpar"><label class="lb">Fotogramas por segundo del vídeo<input id="sjfps" inputmode="decimal" value="${sj.fps}"></label><label class="lb">Tipo de salto<select id="sjtipo">${SJ_TIPOS.map(t=>`<option${t==sj.tipo?' selected':''}>${t}</option>`).join('')}</select></label><label class="lb">Fecha<input id="sjd" type="date" max="${today()}" value="${esc(sj.date)}"></label></div>
  <label class="lb sjnl">Nota (opcional)<input id="sjnote" maxlength="200" autocomplete="off" value="${esc(sj.note)}"></label>
  <div class="row sjgd"><button class="pri" data-a="sjsave">Guardar salto</button></div></div>
  <div class="card pcd"><div class="pct">${ic('clock',20)}<b>Saltos guardados</b></div><div id="sjlist">${sjListaHTML(c)}</div></div>
  <div class="card pcd"><div class="pct">${ic('file',20)}<b>Comparativas</b></div><div id="sjind">${sjIndHTML(c)}</div></div>`}

// Acciones (data-a="sj…") y campos
function sjAccion(a,b){
  const c=cc();if(!c)return false;
  if(a=='sjs'){sjIr(sj.n+(+b.dataset.v));return true}
  if(a=='sjm'){if(!sj.url){flash('Primero elige un vídeo');return true}sj[b.dataset.v]=sj.n;sjPintar();return true}
  if(a=='sjg'){const n=sj[b.dataset.v];if(n!=null)sjIr(n);return true}
  if(a=='sjx'){sjSoltar();sj.fd=sj.fa=sj.fc=null;render();return true}
  if(a=='sjdel'){const i=(c.saltos||[]).findIndex(s=>s.id==b.dataset.id);if(i<0)return true;if(!confirm('¿Eliminar este salto? Esta acción no se puede deshacer.'))return true;c.saltos.splice(i,1);if(!c.saltos.length)delete c.saltos;save();sjListasPintar();flash('Salto eliminado');return true}
  if(a=='sjsave'){
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
  if(t.id=='sjf'){const f=t.files&&t.files[0];if(!f)return true;sjSoltar();sj.url=URL.createObjectURL(f);sj.name=f.name;sj.n=0;sj.fd=sj.fa=sj.fc=null;sj.est='Cargando «'+f.name+'» ('+sjFr((f.size||0)/1048576,1)+' MB)…';render();sjEsperar();return true}
  if(t.id=='sjfps'){const n=sjFps(t.value);if(n){sj.fps=n;sjIr(sj.n)}return true}
  if(t.id=='sjtipo'){sj.tipo=t.value;if(sj.tipo!='Drop jump')sj.fc=null;sjPintar();return true}
  if(t.id=='sjd'){sj.date=t.value;return true}
  if(t.id=='sjnote'){sj.note=t.value;return true}
  if(t.id=='sjr'){sjIr(+t.value);return true}
  const m=/^sjm-(fd|fa|fc)$/.exec(t.id);if(m){sj[m[1]]=sjEnt(t.value.trim());sjPintar();return true}
  return false}
// Flechas del teclado (ordenador): fotograma a fotograma
document.addEventListener('keydown',ev=>{if(typeof tab=='undefined'||tab!='cli'||ptab!='sal'||!sj.url)return;const t=ev.target&&ev.target.tagName;if(t=='INPUT'||t=='SELECT'||t=='TEXTAREA')return;
  if(ev.key=='ArrowRight'){sjIr(sj.n+(ev.shiftKey?10:1));ev.preventDefault()}else if(ev.key=='ArrowLeft'){sjIr(sj.n-(ev.shiftKey?10:1));ev.preventDefault()}});
