// Progreso del paciente: variables (EVA, mediciones clínicas y cargas registradas en rutinas y planes) y gráfico de líneas o barras en SVG
// Solo lee datos (no guarda nada). La selección vive en memoria: prg = {c paciente, t líneas/barras, les lesión de referencia ('' = todas), k tipo de Y, d variable de Y, xk tipo de X, xd variable de X}.
// Cada variable tiene un TIPO (Dolor EVA, Fuerza, ROM, Carga, Intensidad, RPE, RIR) y un detalle (músculo, movimiento o ejercicio): se eligen en dos desplegables.
// Principios: nunca se inventa ni se interpola nada; lo que no se puede leer con fiabilidad NO se dibuja (pero tampoco se borra ni se convierte en 0); cada unidad es su propia serie.
let prg={c:'',t:'lin',les:'',k:'',d:'',xk:'fecha',xd:''};
const PR_ISO=/^\d{4}-\d{2}-\d{2}$/;
const PR_T={eva:'Dolor (EVA)',fuerza:'Fuerza',rom:'ROM',carga:'Carga',inten:'Intensidad',rpe:'RPE',rir:'RIR'},PR_D={eva:'Qué dolor',fuerza:'Músculo o movimiento',rom:'Movimiento',carga:'Ejercicio',inten:'Ejercicio',rpe:'Ejercicio',rir:'Ejercicio'};
const PR_COL=['var(--ac)','#f59e0b','#8b5cf6','#ef4444','#10b981','#ec4899','#0ea5e9','#a16207'];

// ---- Interpretación del texto de «Carga» ----
// Solo se acepta un texto que sea EXACTAMENTE un número (entero o decimal con coma o punto, hasta 2 decimales) con, como mucho, una unidad conocida.
// «2 × 15 kg», «20-30 kg», «goma roja», «1.000 kg»… no se interpretan (no se coge «el primer número»). Cada unidad es una serie distinta; sin unidad = «Sin unidad especificada».
const PR_N='(\\d+(?:[.,]\\d{1,2})?)',PR_CARGAS=[
 [new RegExp('^'+PR_N+' ?(?:kg|kgs|kilo|kilos|kilogramo|kilogramos)\\.?$'),'kg'],
 [new RegExp('^'+PR_N+' ?(?:lb|lbs|libra|libras)\\.?$'),'lb'],
 [new RegExp('^'+PR_N+' ?% ?(?:de )?(?:1 ?)?rm$'),'% RM'],
 [new RegExp('^'+PR_N+' ?%$'),'%'],
 [new RegExp('^(?:rpe ?[:=]? ?'+PR_N+'|'+PR_N+' ?rpe)$'),'RPE'],
 [new RegExp('^(?:rir ?[:=]? ?'+PR_N+'|'+PR_N+' ?rir)$'),'RIR'],
 [new RegExp('^'+PR_N+'$'),'']];
function prCarga(s){const raw=s==null?'':String(s),t=raw.toLowerCase().replace(/ /g,' ').replace(/\s+/g,' ').trim();
 if(!t)return{ok:false,raw};
 for(const[re,u]of PR_CARGAS){const m=re.exec(t);if(!m)continue;const v=parseFloat((m[1]!==undefined?m[1]:m[2]).replace(',','.'));
  if((u=='RPE'||u=='RIR')&&v>10)return{ok:false,raw};   // fuera de la escala 0–10: no es fiable
  return{ok:true,v,u,raw}}
 return{ok:false,raw}}
const prTipoDe=u=>u=='RPE'?'rpe':u=='RIR'?'rir':u=='% RM'||u=='%'?'inten':'carga';
const prFn=v=>String(+(+v).toFixed(2)).replace('.',',');
const prDia=ms=>{const d=new Date(ms);return d.getUTCDate()+' '+MS[d.getUTCMonth()]};
const prFecha=ms=>{const d=new Date(ms);return d.getUTCDate()+' '+MS[d.getUTCMonth()]+' '+d.getUTCFullYear()};
const prCorta=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;

// ---- Lesiones ----
const prCasos=c=>(c.cases||[]).slice();
// Periodo clínico de una lesión: inicio → alta (o hasta hoy si sigue activa). Sin fecha de inicio válida no hay periodo (no se mostrará ninguna carga).
function prPeriodo(x){if(!PR_ISO.test(x.opened||''))return['9','0'];let b;
 if(x.status=='Alta'){const fe=(x.entries||[]).map(e=>e.date).filter(d=>PR_ISO.test(d||'')).sort();b=PR_ISO.test(x.closed||'')?x.closed:(fe.length?fe[fe.length-1]:x.opened)}else b=today();
 return[x.opened,b<x.opened?x.opened:b]}
const prLesTxt=x=>(x.name||'Lesión')+' ('+(PR_ISO.test(x.opened||'')?fmtD(x.opened):'sin fecha de inicio')+')';
function prLesOpts(c){const L=prCasos(c),srt=a=>a.sort((p,q)=>(q.opened||'').localeCompare(p.opened||'')),act=srt(L.filter(x=>x.status!='Alta')),alt=srt(L.filter(x=>x.status=='Alta'));
 const o=x=>`<option value="${esc(x.id)}"${x.id==prg.les?' selected':''}>${esc((x.status=='Alta'?'✓ ':'● ')+(x.name||'Lesión')+' · '+(PR_ISO.test(x.opened||'')?'inicio '+fmtD(x.opened):'sin fecha de inicio')+(x.status=='Alta'?' → alta'+(PR_ISO.test(x.closed||'')?' '+fmtD(x.closed):''):''))}</option>`;
 return`<option value=""${prg.les==''?' selected':''}>Todas las lesiones</option>${act.length?`<optgroup label="Lesiones activas">${act.map(o).join('')}</optgroup>`:''}${alt.length?`<optgroup label="Lesiones dadas de alta">${alt.map(o).join('')}</optgroup>`:''}`}

// ---- Variables ----
// {id, t tipo, s detalle, l nombre completo, u unidad registrada, p registros [{d fecha, v valor, ent anotación, les lesión, raw texto original, src origen, ded}], fix escala fija}
// Se conservan TODOS los registros (también varios el mismo día). `les` = id de una lesión concreta o '' (todas); las cargas se limitan al periodo de esa lesión.
function prVars(c,les){const L=[],cas=prCasos(c),sel=les?cas.find(x=>x.id==les):null,add=(id,t,sd,u,p,fix,extra)=>{if(p.length)L.push(Object.assign({id,t,s:sd,l:PR_T[t]+' · '+sd,u,p,fix:fix||null},extra||{}))};
 if(les&&!sel)return Object.assign([],{exc:[],ded:0});
 const ens=(sel?[sel]:cas).flatMap(x=>(x.entries||[]).map(e=>Object.assign({},e,{_c:x.id}))).filter(e=>PR_ISO.test(e.date||'')),ord=(a,b)=>a.d.localeCompare(b.d)||a.n-b.n;
 add('eva','eva','General (anotaciones)','',ens.filter(hasP).map(e=>({d:e.date,v:+e.pain,ent:e.id,les:e._c,n:e.n||0,src:'Anotación'})).sort(ord),[0,10],{cli:1});
 const ms={};ens.forEach(e=>(e.meas||[]).forEach(x=>{const v=+x.v;if(x.v===''||x.v==null||isNaN(v))return;const key=[x.k,x.l,x.s||'',x.u].join('|');(ms[key]=ms[key]||{k:x.k,l:x.l,s:x.s||'',u:x.u,p:[]}).p.push({d:e.date,v,ent:e.id,les:e._c,n:e.n||0,src:'Anotación'})}));
 Object.entries(ms).forEach(([key,q])=>{const eva=q.k=='EVA';add('m:'+key,eva?'eva':q.k=='Fuerza'?'fuerza':'rom',q.l+(q.s?' '+q.s:''),eva&&(q.u==''||q.u=='/10')?'':q.u,q.p.sort(ord),eva&&(q.u==''||q.u=='/10')?[0,10]:null,{cli:1})});
 // Cargas escritas en rutinas y planes: datos generales del paciente (no van ligados a una lesión). Con una lesión elegida, solo las de su periodo.
 const per=sel?prPeriodo(sel):null,dentro=d=>!per||(d>=per[0]&&d<=per[1]),car={},exc=[];let o=0,ded=0;
 const ad=(d,it,src,dd)=>{if(!PR_ISO.test(d||'')||!dentro(d))return;const r=prCarga(it.load);
  if(!r.ok){if(String(it.load==null?'':it.load).trim())exc.push({d,e:it.e,raw:String(it.load),src});return}
  const k=it.e+'|'+(r.u||'sin'),q=car[k]||(car[k]={e:it.e,u:r.u,p:[]});q.p.push({d,v:r.v,n:o++,raw:r.raw,src,ded:!!dd})};
 (c.plans||[]).forEach(p=>(p.items||[]).forEach(it=>ad(p.date,it,'Rutina «'+p.name+'»')));
 (c.weeks||[]).forEach(w=>{const ini=wkInicio(w);(w.days||[]).forEach((dy,i)=>(dy.items||[]).forEach(it=>ad(wkDia(w,i),it,'Plan «'+w.name+'» · '+(dy.day||D[i])+(dy.name?' ('+dy.name+')':''),ini.ded)))});
 Object.values(car).forEach(q=>{const e=byId(q.e),t=prTipoDe(q.u);add('c:'+q.e+'|'+(q.u||'sin'),t,e?e.n:'Ejercicio',q.u,q.p.sort(ord),t=='rpe'||t=='rir'?[0,10]:null,{car:1})});
 L.exc=exc;L.ded=L.some(z=>z.p.some(q=>q.ded))?1:0;return L}
const prTipos=V=>Object.keys(PR_T).filter(k=>V.some(z=>z.t==k));
// Unidad tal como se muestra (en ejes, desplegables, tabla y leyendas)
const prUE=z=>z.t=='eva'?'EVA 0–10':z.t=='rpe'?'0–10':z.t=='rir'?'repeticiones en reserva':(z.u||'Sin unidad especificada');
const prOpt=z=>z.s+' ('+prUE(z)+')';
// Título de eje: «Fuerza — Cuádriceps derecho (N)», «Dolor (EVA 0–10)»
const prTit=z=>z.t=='eva'&&z.s=='General (anotaciones)'?'Dolor (EVA 0–10)':(z.t=='eva'?'Dolor':PR_T[z.t])+' — '+z.s+' ('+prUE(z)+')';
// Valor con su unidad: «40 kg», «RPE 7», «6/10», «40 (sin unidad especificada)»
const prVal=(z,v)=>z.t=='rpe'?'RPE '+prFn(v):z.t=='rir'?'RIR '+prFn(v):z.t=='eva'?prFn(v)+'/10':prFn(v)+(z.u?' '+z.u:' (sin unidad especificada)');
const prNombre=z=>z.car?'Carga registrada':PR_T[z.t].replace(' (EVA)','');
// Ajusta la selección a lo que existe y pone valores iniciales razonables
function prAjustar(c,V){if(prg.c!=c.id)prg={c:c.id,t:'lin',les:'',k:'',d:'',xk:'fecha',xd:''};
 const T=prTipos(V),de=k=>V.filter(z=>z.t==k);
 if(!T.includes(prg.k))prg.k=T.includes('eva')?'eva':T[0];
 if(!de(prg.k).some(z=>z.id==prg.d))prg.d=de(prg.k)[0].id;
 if(prg.xk=='dias'&&!prCasos(c).some(x=>PR_ISO.test(x.opened||'')))prg.xk='fecha';
 if(prg.xk!='fecha'&&prg.xk!='dias'){if(!T.includes(prg.xk))prg.xk='fecha';else if(!de(prg.xk).some(z=>z.id==prg.xd))prg.xd=de(prg.xk)[0].id}}
const prIdX=()=>prg.xk=='fecha'||prg.xk=='dias'?prg.xk:prg.xd;

// ---- Puntos del gráfico ----
// Cada punto: {x, y, d, g etiqueta de serie, gi nº de serie, + datos del registro}. Devuelve {pts, omit, prompt}
// Con otra variable en X: se emparejan primero las mediciones de la MISMA anotación; el resto solo por fecha y solo si hay exactamente un registro de cada variable ese día (nunca correspondencias arbitrarias).
function prPuntos(V,c,xid,v){const R={pts:[],omit:0,prompt:''};if(!v)return R;let base;
 if(xid=='fecha')base=v.p.map(q=>Object.assign({},q,{x:pd(q.d)/864e5,y:q.v}));
 else if(xid=='dias'){const l=prg.les?prCasos(c).find(x=>x.id==prg.les):null;if(!l||!PR_ISO.test(l.opened||'')){R.prompt='Para ver los días desde el inicio de la lesión, elige una lesión concreta en «Lesión de referencia».';return R}
  const o=pd(l.opened)/864e5;base=v.p.map(q=>Object.assign({},q,{x:pd(q.d)/864e5-o,y:q.v}))}
 else{const vx=V.find(z=>z.id==xid);if(!vx)return R;const used=new Set(),par=[];
  v.p.forEach((q,i)=>{if(!q.ent)return;const m=vx.p.map((z,j)=>[z,j]).filter(([z])=>z.ent==q.ent);if(m.length==1&&!used.has(m[0][1])){used.add(m[0][1]);par.push([i,m[0][0]])}});
  const pi=new Set(par.map(a=>a[0])),rest=new Map();
  v.p.forEach((q,i)=>{if(!pi.has(i))(rest.get(q.d)||rest.set(q.d,{y:[],x:[]}).get(q.d)).y.push(q)});
  vx.p.forEach((z,j)=>{if(!used.has(j))(rest.get(z.d)||rest.set(z.d,{y:[],x:[]}).get(z.d)).x.push(z)});
  rest.forEach(g=>{if(g.y.length&&g.x.length){if(g.y.length==1&&g.x.length==1)par.push([-1,g.x[0],g.y[0]]);else R.omit++}});
  base=par.map(a=>{const q=a[0]>=0?v.p[a[0]]:a[2];return Object.assign({},q,{x:a[1].v,y:q.v})})}
 // series: por lesión (solo cuando hay varias lesiones mezcladas) y «registro n» cuando hay varios registros el mismo día
 const cas=prCasos(c),ln=id=>{const x=cas.find(z=>z.id==id);return x?prLesTxt(x):''},multi=new Set(base.map(q=>q.les).filter(Boolean)).size>1;
 const cnt=new Map();base.sort((a,b)=>a.d.localeCompare(b.d)||(a.n||0)-(b.n||0)).forEach(q=>{const b=multi?ln(q.les):'',k=b+'|'+q.d;q.o=(cnt.get(k)||0)+1;cnt.set(k,q.o);q.b=b});
 const rep=new Set();base.forEach(q=>{if(q.o>1)rep.add(q.b)});
 base.forEach(q=>{q.g=(q.b?q.b+(rep.has(q.b)?' · registro '+q.o:''):rep.has(q.b)?'Registro '+q.o:'')});
 const G=[...new Set(base.map(q=>q.g))],ordl=g=>{const m=base.find(q=>q.g==g);return[multi?cas.findIndex(x=>x.id==m.les):0,m.o]};
 G.sort((a,b)=>{const p=ordl(a),q=ordl(b);return p[0]-q[0]||p[1]-q[1]});
 base.forEach(q=>q.gi=G.indexOf(q.g));R.G=G;R.pts=base;return R}
function prNice(lo,hi,n){if(!(hi>lo))hi=lo+1;const raw=(hi-lo)/n,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p,s=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p,a=Math.floor(lo/s+1e-9)*s,b=Math.ceil(hi/s-1e-9)*s,t=[];for(let v=a;v<=b+s/1e6;v+=s)t.push(+v.toFixed(6));return{a,b,t}}
const prTip=(c,V,q,vy,xid)=>{const vx=V.find(z=>z.id==xid),xt=xid=='fecha'?prFecha(q.x*864e5):xid=='dias'?'día '+prFn(q.x):vx?prVal(vx,q.x):'';
 return`${prNombre(vy)}: ${vy.s}: ${prVal(vy,q.y)} · ${xt}${q.g?' · '+q.g:''}${vy.car&&q.src?' · '+q.src:''}${vy.car&&q.raw!==undefined?' · texto «'+q.raw+'»':''}`};
// Marcadores distintos por serie (círculo, cuadrado, triángulo, rombo) para no depender solo del color
const prMark=(i,x,y,col,tt)=>{const s=i%4,a=`class="prm" fill="${col}" stroke="var(--card)" stroke-width="1.5"`;
 return s==0?`<circle ${a} cx="${x}" cy="${y}" r="4.8"><title>${tt}</title></circle>`:s==1?`<rect ${a} x="${+x-4.2}" y="${+y-4.2}" width="8.4" height="8.4" rx="1.5"><title>${tt}</title></rect>`:s==2?`<path ${a} d="M${x} ${+y-5.6}L${+x+5.2} ${+y+4}H${+x-5.2}Z"><title>${tt}</title></path>`:`<path ${a} d="M${x} ${+y-6}L${+x+5.4} ${y}L${x} ${+y+6}L${+x-5.4} ${y}Z"><title>${tt}</title></path>`};
// Dibujo del gráfico (una variable en Y; una serie por lesión o por registro del mismo día)
function prSVG(c,V,P){const vy=V.find(z=>z.id==prg.d),bar=prg.t=='bar',xid=prIdX(),p=P.pts.slice().sort((a,b)=>a.x-b.x||a.gi-b.gi);if(!p.length)return null;
 const narrow=typeof innerWidth=='number'&&innerWidth<560,ng=Math.max(1,(P.G||[]).length),ncat=bar?new Set(p.map(q=>q.x)).size:0,W=narrow?380:720,ml=44,mr=14,mt=30,ph=236,pw=W-ml-mr,rot=ncat*(xid=='fecha'?66:40)>pw,mb=rot?86:58,H=mt+ph+mb;
 const vs=p.map(q=>q.y);let lo=Math.min(...vs),hi=Math.max(...vs),dm;
 if(vy.fix)dm={a:vy.fix[0],b:vy.fix[1],t:prNice(vy.fix[0],vy.fix[1],5).t};
 else{if(bar)lo=Math.min(0,lo);else{const pad=(hi-lo)*.12||Math.abs(hi)*.1||1;lo-=pad;hi+=pad;if(lo<0&&Math.min(...vs)>=0)lo=0}dm=prNice(lo,hi,4)}
 const Y=v=>mt+ph-(v-dm.a)/(dm.b-dm.a)*ph,col=q=>PR_COL[q.gi%PR_COL.length],tip=q=>prTip(c,V,q,vy,xid);let xl,fxl='',g='';
 if(bar){const cats=[...new Set(p.map(q=>q.x))].sort((a,b)=>a-b),n=cats.length,band=pw/Math.max(n,1);xl=x=>ml+band*(cats.indexOf(x)+.5);
  fxl=cats.map(x=>{const t=xid=='fecha'?prFecha(x*864e5):prFn(x),cx=xl(x);return`<text x="${cx}" y="${mt+ph+16}" class="prx" text-anchor="${rot?'end':'middle'}"${rot?` transform="rotate(-40 ${cx} ${mt+ph+16})"`:''}>${esc(t)}</text>`}).join('');
  cats.forEach(x=>{const ps=p.filter(q=>q.x==x),k=ps.length,bw=Math.min(46,band*.8)/k,x0=xl(x)-bw*k/2;   // varios registros el mismo día: barras una junto a otra (nunca una encima de otra)
   ps.forEach((q,j)=>{const y0=Y(Math.max(0,dm.a)),y1=Y(q.y),t=tip(q);g+=`<rect class="prb" data-a="prpt" data-t="${esc(t)}" x="${(x0+bw*j).toFixed(1)}" y="${Math.min(y0,y1).toFixed(1)}" width="${Math.max(bw-2,2).toFixed(1)}" height="${Math.max(Math.abs(y0-y1),1).toFixed(1)}" rx="3" fill="${col(q)}"><title>${esc(t)}</title></rect>`})})}
 else{const all=p.map(q=>q.x);let a=Math.min(...all),b=Math.max(...all);const pad=(b-a)*.05||1;a-=pad;b+=pad;xl=x=>ml+(x-a)/(b-a)*pw;
  const tk=prNice(a,b,5).t.filter(t=>t>=a&&t<=b);fxl=tk.map(t=>`<text x="${xl(t).toFixed(1)}" y="${mt+ph+18}" class="prx" text-anchor="middle">${esc(xid=='fecha'?(b-a>300?prFecha(t*864e5):prDia(t*864e5)):prFn(t))}</text><path d="M${xl(t).toFixed(1)} ${mt}V${mt+ph}" class="prg2"/>`).join('');
  for(let gi=0;gi<ng;gi++){const ps=p.filter(q=>q.gi==gi);if(ps.length>1)g+=`<polyline points="${ps.map(q=>xl(q.x).toFixed(1)+','+Y(q.y).toFixed(1)).join(' ')}" fill="none" stroke="${PR_COL[gi%PR_COL.length]}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`}
  p.forEach(q=>{const t=tip(q),cx=xl(q.x).toFixed(1),cy=Y(q.y).toFixed(1);g+=prMark(q.gi,cx,cy,col(q),esc(t))+`<circle class="prh" data-a="prpt" data-t="${esc(t)}" cx="${cx}" cy="${cy}" r="15"/>`})}
 const ejeY=dm.t.map(t=>`<text x="${ml-8}" y="${(Y(t)+4).toFixed(1)}" class="prx" text-anchor="end">${esc(prFn(t))}</text>`).join(''),rejilla=dm.t.map(t=>`<path d="M${ml} ${Y(t).toFixed(1)}H${ml+pw}" class="prg2"/>`).join('');
 const vx=V.find(z=>z.id==xid),xt=prXTit(vx,xid),n1=narrow?50:100;
 return`<svg class="prsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de progreso">${rejilla}<path d="M${ml} ${mt}V${mt+ph}H${ml+pw}" class="prax"/>${ejeY}${fxl}${g}<text x="4" y="14" class="prx pru prytit" text-anchor="start">${esc('Y: '+prCorta(prTit(vy),n1))}</text><text x="${ml+pw/2}" y="${H-8}" class="prx prxt" text-anchor="middle">${esc('X: '+prCorta(xt,n1))}</text></svg>`}
const prXTit=(vx,xid)=>xid=='fecha'?'Fecha':xid=='dias'?'Días desde el inicio de la lesión (días)':vx?prTit(vx):'';
// Tabla con todos los valores dibujados (para poder comprobarlos), con unidades y origen
function prTabla(c,V,P){const vy=V.find(z=>z.id==prg.d),xid=prIdX(),p=P.pts.slice().sort((a,b)=>a.x-b.x||a.gi-b.gi),vx=V.find(z=>z.id==xid),fx=q=>xid=='fecha'?prFecha(q.x*864e5):xid=='dias'?prFn(q.x):prVal(vx,q.x);
 return`<table class="prtb"><thead><tr><th>${esc(prXTit(vx,xid))}</th><th>${esc(vy.car?'Carga registrada — '+vy.s+' ('+prUE(vy)+')':prTit(vy))}</th><th>Origen</th></tr></thead><tbody>${p.map(q=>`<tr><td>${esc(fx(q))}</td><td>${esc(prVal(vy,q.y))}</td><td>${esc([q.g,q.src,vy.car&&q.raw!==undefined?'texto «'+q.raw+'»':''].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table>`}
function prCuerpo(c){if(prg.c!=c.id)prg={c:c.id,t:'lin',les:'',k:'',d:'',xk:'fecha',xd:''};
 const cas=prCasos(c);if(prg.les&&!cas.some(x=>x.id==prg.les))prg.les='';
 const TODO=prVars(c,'');
 if(!TODO.length)return`<div class="card pcd pvac"><div class="pct">${ic('chart',20)}<b>Progreso</b></div><p class="mut pcn">Todavía no hay nada que dibujar. Aparecerán aquí el dolor (EVA), la fuerza y el rango de movimiento que registres en Clínica, y la carga y el RPE de los ejercicios de sus rutinas y planes semanales.</p></div>`;
 const V=prg.les?prVars(c,prg.les):TODO,sel=prg.les?cas.find(x=>x.id==prg.les):null;
 const lesSel=cas.length?`<label class="lb prles">Lesión de referencia<select id="prles">${prLesOpts(c)}</select></label>`:'';
 const cab=`<div class="card pcd prgc"><div class="pct">${ic('chart',20)}<b>Progreso</b></div>${lesSel}`;
 if(!V.length)return cab+`<p class="mut pcn">Esta lesión no tiene registros clínicos ni cargas en su periodo. Elige otra lesión o «Todas las lesiones».</p></div>`;
 prAjustar(c,V);const T=prTipos(V),de=k=>V.filter(z=>z.t==k),vy=V.find(z=>z.id==prg.d),xid=prIdX(),P=prPuntos(V,c,xid,vy),svg=P.pts.length?prSVG(c,V,P):null,vx=V.find(z=>z.id==xid);
 const sl=(id,sd,etq,dt)=>`<label class="lb">${etq}<select id="${id}">${dt.map(o=>`<option value="${esc(o[0])}"${o[0]==sd?' selected':''}>${esc(o[1])}</option>`).join('')}</select></label>`;
 const tY=T.map(k=>[k,PR_T[k]]),tX=[['fecha','Fecha']].concat(cas.some(x=>PR_ISO.test(x.opened||''))?[['dias','Días desde el inicio de la lesión']]:[]).concat(tY);
 const leg=svg?`<div class="praxl"><div class="prlg"><b>Eje Y:</b> ${esc(prTit(vy))}</div><div class="prlg"><b>Eje X:</b> ${esc(prXTit(vx,xid))}</div></div>${(P.G||[]).length>1?`<div class="prleg">${P.G.map((g,i)=>`<span class="prlg"><i style="background:${PR_COL[i%PR_COL.length]}"></i>${esc(g)}</span>`).join('')}</div>`:''}`:'';
 const notas=[];
 if(prg.xk=='dias'&&sel)notas.push(`Día 0 = inicio de «${esc(sel.name||'Lesión')}» (${esc(fmtD(sel.opened))}).`);
 if(vy.car){notas.push('«Carga registrada» es la que figura escrita en la rutina o el plan semanal; no indica que se haya realizado.');if(sel)notas.push(`Las cargas son datos generales del paciente: aquí se muestran las registradas durante el periodo de esta lesión (${esc(fmtD(prPeriodo(sel)[0]))} – ${esc(fmtD(prPeriodo(sel)[1]))}), sin afirmar que correspondan a su tratamiento.`);if(V.ded&&vy.p.some(q=>q.ded))notas.push('Algunos planes semanales no tienen fecha de inicio: se ha deducido (lunes de la semana en que se asignaron). Puedes corregirla con «Editar» en Ejercicio.')}
 if(xid!='fecha'&&xid!='dias')notas.push('Con otra variable en el eje horizontal, solo se emparejan registros de la misma anotación o, si son independientes, de una misma fecha con un único registro de cada variable.'+(P.omit?` Hay ${P.omit} fecha${P.omit>1?'s':''} con varios registros que no se emparejan para no hacer correspondencias arbitrarias.`:''));
 const aviso=P.prompt?`<p class="mut pcn prprompt">${esc(P.prompt)}</p>`:(!svg?`<p class="mut pcn">No hay registros que se puedan emparejar entre las variables elegidas. Prueba con «Fecha» en el eje horizontal o elige otra variable.</p>`:'');
 return cab+`
<div class="segc prtype" role="group" aria-label="Tipo de gráfico"><button data-a="prt" data-v="lin" class="${prg.t=='lin'?'on':''}">Líneas con puntos</button><button data-a="prt" data-v="bar" class="${prg.t=='bar'?'on':''}">Barras</button></div>
<div class="prsel"><div class="prgrp">${sl('pry',prg.k,'Eje vertical (Y)',tY)}${sl('pryd',prg.d,PR_D[prg.k],de(prg.k).map(z=>[z.id,prOpt(z)]))}</div>
<div class="prgrp">${sl('prx',prg.xk,'Eje horizontal (X)',tX)}${prg.xk!='fecha'&&prg.xk!='dias'?sl('prxd',prg.xd,PR_D[prg.xk],de(prg.xk).map(z=>[z.id,prOpt(z)])):''}</div></div>
${svg?`${leg}${svg}<div id="prread" class="prread mut" aria-live="polite">Toca un punto o una barra para ver su valor.</div>${notas.map(n=>`<p class="mut prnote">${n}</p>`).join('')}<details class="prdet"><summary>Ver los datos del gráfico</summary>${prTabla(c,V,P)}</details>`:aviso+notas.map(n=>`<p class="mut prnote">${n}</p>`).join('')}${prExc(V,vy,vx)}</div>`}
// Cargas que no se han podido interpretar: no se dibujan (ni se tocan en la rutina), pero se avisa de cuáles son
function prExc(V,vy,vx){const x=V.exc||[];if(!x.length||!((vy&&vy.car)||(vx&&vx.car)))return'';return`<details class="prdet prexc"><summary>${x.length} carga${x.length>1?'s':''} sin interpretar (no se dibuja${x.length>1?'n':''})</summary><table class="prtb"><thead><tr><th>Fecha</th><th>Ejercicio</th><th>Texto escrito</th><th>Origen</th></tr></thead><tbody>${x.map(z=>{const e=byId(z.e);return`<tr><td>${esc(fmtD(z.d))}</td><td>${esc(e?e.n:'?')}</td><td>«${esc(z.raw)}»</td><td>${esc(z.src)}</td></tr>`}).join('')}</tbody></table><p class="mut prnote">Solo se dibuja un número solo o con su unidad (p. ej. «40 kg», «12,5 kg», «70 % RM», «RPE 8»). Expresiones como «2 × 15 kg», «20-30 kg» o «goma roja» se conservan tal cual, pero no se interpretan.</p></details>`}
const paProgreso=c=>`<div id="prg">${prCuerpo(c)}</div>`;
function prPintar(){const c=cc(),b=$('#prg');if(c&&b)b.innerHTML=prCuerpo(c)}
