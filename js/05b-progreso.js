// Progreso del paciente: variables (EVA, mediciones, carga planificada) y gráfico de líneas o barras en SVG, con dos ejes verticales
// Solo lee datos (no guarda nada). La selección vive en memoria: prg = {c paciente, t líneas/barras, k tipo de variable del eje Y, d variable concreta de Y, xk tipo del eje X, xd variable concreta de X}.
// Cada variable tiene un TIPO (Dolor EVA, Fuerza, ROM, Carga, RPE) y un detalle (músculo, movimiento o ejercicio): se eligen en dos desplegables.
let prg={c:'',t:'lin',k:'',d:'',xk:'fecha',xd:''};
const PR_T={eva:'Dolor (EVA)',fuerza:'Fuerza',rom:'ROM',carga:'Carga',rpe:'RPE'},PR_D={eva:'Qué dolor',fuerza:'Músculo o movimiento',rom:'Movimiento',carga:'Ejercicio',rpe:'Ejercicio'};
const prNum=s=>{const m=/(\d+(?:[.,]\d+)?)/.exec(String(s==null?'':s));return m?parseFloat(m[1].replace(',','.')):null};
const prUni=s=>/kg/i.test(s)?'kg':/lb/i.test(s)?'lb':/rpe/i.test(s)?'RPE':'';
const prFn=v=>String(+(+v).toFixed(2)).replace('.',',');
const prDia=ms=>{const d=new Date(ms);return d.getUTCDate()+' '+MS[d.getUTCMonth()]};
const prFecha=ms=>{const d=new Date(ms);return d.getUTCDate()+' '+MS[d.getUTCMonth()]+' '+d.getUTCFullYear()};
const prIsoDe=ms=>new Date(ms).toISOString().slice(0,10);
// Un punto por fecha (si hay varios el mismo día, el último de la anotación; en cargas, el mayor)
const prUnPorDia=(pts,modo)=>{const m=new Map();pts.forEach(p=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(p.d||'')||p.v==null||isNaN(p.v))return;const o=m.get(p.d);m.set(p.d,o==null?p.v:modo=='max'?Math.max(o,p.v):p.v)});return[...m].map(([d,v])=>({d,v})).sort((a,b)=>a.d.localeCompare(b.d))};
// Todas las variables que se pueden dibujar de este paciente: {id, t tipo, s detalle, l nombre completo, u unidad, p puntos, fix escala fija}
function prVars(c){const L=[],ens=(c.cases||[]).flatMap(x=>x.entries||[]),add=(id,t,sd,u,p,fix)=>{if(p.length)L.push({id,t,s:sd,l:PR_T[t]+' · '+sd,u,p,fix:fix||null})};
 add('eva','eva','General (anotaciones)','',prUnPorDia(fsort(ens).reverse().filter(hasP).map(e=>({d:e.date,v:+e.pain}))),[0,10]);
 mseries(ens).forEach(q=>add('m:'+[q.k,q.l,q.s,q.u].join('|'),q.k=='Fuerza'?'fuerza':q.k=='EVA'?'eva':'rom',q.l+(q.s?' '+q.s:''),q.u,prUnPorDia(q.p.map(z=>({d:z.d,v:z.v}))),q.k=='EVA'&&(q.u==''||q.u=='/10')?[0,10]:null));
 const car={},ad=(d,it)=>{const v=prNum(it.load);if(v==null)return;const o=car[it.e]||(car[it.e]={e:it.e,u:'',p:[]});o.u=o.u||prUni(it.load);o.p.push({d,v})};
 (c.plans||[]).forEach(p=>(p.items||[]).forEach(it=>ad(p.date,it)));
 (c.weeks||[]).forEach(w=>(w.days||[]).forEach(dy=>(dy.items||[]).forEach(it=>ad(w.date,it))));
 Object.values(car).forEach(o=>{const e=byId(o.e);add('c:'+o.e,o.u=='RPE'?'rpe':'carga',e?e.n:'Ejercicio',o.u,prUnPorDia(o.p,'max'))});
 return L}
// Tipos que tienen datos, en orden fijo
const prTipos=V=>Object.keys(PR_T).filter(k=>V.some(z=>z.t==k));
// Lesión de referencia para «días desde el inicio»: la activa más reciente (o, si no hay, la más reciente)
function prLesion(c){const ls=(c.cases||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.opened||'')),act=ls.filter(x=>x.status!='Alta'),pool=act.length?act:ls;return pool.slice().sort((a,b)=>b.opened.localeCompare(a.opened))[0]||null}
// Puntos de una variable sobre el eje X elegido: [{x, y, d}] (con otra variable en X se emparejan por la misma fecha)
function prPuntos(V,c,xid,v){if(!v)return[];
 if(xid=='fecha')return v.p.map(q=>({x:pd(q.d)/864e5,y:q.v,d:q.d}));
 if(xid=='dias'){const l=prLesion(c);if(!l)return[];const o=pd(l.opened)/864e5;return v.p.map(q=>({x:pd(q.d)/864e5-o,y:q.v,d:q.d}))}
 const vx=V.find(z=>z.id==xid);if(!vx)return[];const m=new Map(vx.p.map(q=>[q.d,q.v]));
 return v.p.filter(q=>m.has(q.d)).map(q=>({x:m.get(q.d),y:q.v,d:q.d}))}
function prNice(lo,hi,n){if(!(hi>lo))hi=lo+1;const raw=(hi-lo)/n,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p,s=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p,a=Math.floor(lo/s+1e-9)*s,b=Math.ceil(hi/s-1e-9)*s,t=[];for(let v=a;v<=b+s/1e6;v+=s)t.push(+v.toFixed(6));return{a,b,t}}
// Ajusta la selección a lo que existe y pone valores iniciales razonables (primer tipo con datos, primera variable de ese tipo)
function prAjustar(c,V){if(prg.c!=c.id)prg={c:c.id,t:'lin',k:'',d:'',xk:'fecha',xd:''};
 const T=prTipos(V),de=k=>V.filter(z=>z.t==k);
 if(!T.includes(prg.k))prg.k=T.includes('eva')?'eva':T[0];
 if(!de(prg.k).some(z=>z.id==prg.d))prg.d=de(prg.k)[0].id;
 if(prg.xk=='dias'&&!prLesion(c))prg.xk='fecha';
 if(prg.xk!='fecha'&&prg.xk!='dias'){if(!T.includes(prg.xk))prg.xk='fecha';else if(!de(prg.xk).some(z=>z.id==prg.xd))prg.xd=de(prg.xk)[0].id}}
const prOpt=z=>z.s+(z.u?' ('+z.u+')':'');
const prIdX=()=>prg.xk=='fecha'||prg.xk=='dias'?prg.xk:prg.xd;
// Dibujo del gráfico (una variable en Y)
function prSVG(c,V){const vy=V.find(z=>z.id==prg.d),bar=prg.t=='bar',xid=prIdX();
 const p=prPuntos(V,c,xid,vy).sort((a,b)=>a.x-b.x||a.d.localeCompare(b.d));if(!p.length)return null;
 const ncat=bar?new Set(p.map(q=>q.x)).size:0,W=(typeof innerWidth=='number'&&innerWidth<560)?380:720,ml=44,mr=14,mt=30,ph=236,pw=W-ml-mr,rot=ncat*(xid=='fecha'?66:40)>pw,mb=rot?86:58,H=mt+ph+mb,col='var(--ac)';
 const vs=p.map(q=>q.y);let lo=Math.min(...vs),hi=Math.max(...vs),dm;
 if(vy.fix)dm={a:vy.fix[0],b:vy.fix[1],t:prNice(vy.fix[0],vy.fix[1],5).t};
 else{if(bar)lo=Math.min(0,lo);else{const pad=(hi-lo)*.12||Math.abs(hi)*.1||1;lo-=pad;hi+=pad;if(lo<0&&Math.min(...vs)>=0)lo=0}dm=prNice(lo,hi,4)}
 const Y=v=>mt+ph-(v-dm.a)/(dm.b-dm.a)*ph,u=vy.u?' '+vy.u:'',fx=x=>xid=='fecha'?prFecha(x*864e5):xid=='dias'?'día '+prFn(x):prFn(x);
 let xl,fxl='',g='';
 if(bar){const cats=[...new Set(p.map(q=>q.x))].sort((a,b)=>a-b),n=cats.length,band=pw/Math.max(n,1),bw=Math.min(46,band*.72);xl=x=>ml+band*(cats.indexOf(x)+.5);
  fxl=cats.map(x=>{const t=xid=='fecha'?prFecha(x*864e5):prFn(x),cx=xl(x);return`<text x="${cx}" y="${mt+ph+16}" class="prx" text-anchor="${rot?'end':'middle'}"${rot?` transform="rotate(-40 ${cx} ${mt+ph+16})"`:''}>${esc(t)}</text>`}).join('');
  p.forEach(q=>{const cx=xl(q.x)-bw/2,y0=Y(Math.max(0,dm.a)),y1=Y(q.y),t=`${vy.l}: ${prFn(q.y)}${u} · ${fx(q.x)}`;g+=`<rect class="prb" data-a="prpt" data-t="${esc(t)}" x="${cx.toFixed(1)}" y="${Math.min(y0,y1).toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${Math.max(Math.abs(y0-y1),1).toFixed(1)}" rx="3" fill="${col}"><title>${esc(t)}</title></rect>`})}
 else{const all=p.map(q=>q.x);let a=Math.min(...all),b=Math.max(...all);const pad=(b-a)*.05||1;a-=pad;b+=pad;xl=x=>ml+(x-a)/(b-a)*pw;
  const tk=prNice(a,b,5).t.filter(t=>t>=a&&t<=b);fxl=tk.map(t=>`<text x="${xl(t).toFixed(1)}" y="${mt+ph+18}" class="prx" text-anchor="middle">${esc(xid=='fecha'?(b-a>300?prFecha(t*864e5):prDia(t*864e5)):prFn(t))}</text><path d="M${xl(t).toFixed(1)} ${mt}V${mt+ph}" class="prg2"/>`).join('');
  g+=`<polyline points="${p.map(q=>xl(q.x).toFixed(1)+','+Y(q.y).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  p.forEach(q=>{const t=`${vy.l}: ${prFn(q.y)}${u} · ${fx(q.x)}`,cx=xl(q.x).toFixed(1),cy=Y(q.y).toFixed(1);g+=`<circle cx="${cx}" cy="${cy}" r="4.5" fill="${col}" stroke="var(--card)" stroke-width="1.5"><title>${esc(t)}</title></circle><circle class="prh" data-a="prpt" data-t="${esc(t)}" cx="${cx}" cy="${cy}" r="15"/>`})}
 const ejeY=dm.t.map(t=>`<text x="${ml-8}" y="${(Y(t)+4).toFixed(1)}" class="prx" text-anchor="end">${esc(prFn(t))}</text>`).join(''),rejilla=dm.t.map(t=>`<path d="M${ml} ${Y(t).toFixed(1)}H${ml+pw}" class="prg2"/>`).join('');
 const vx=V.find(z=>z.id==xid),xt=xid=='fecha'?'Fecha':xid=='dias'?'Días desde el inicio de la lesión':vx?vx.l+(vx.u?' ('+vx.u+')':''):'';
 return`<svg class="prsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de progreso">${rejilla}<path d="M${ml} ${mt}V${mt+ph}H${ml+pw}" class="prax"/>${ejeY}${fxl}${g}${vy.u?`<text x="${ml-8}" y="14" class="prx pru" text-anchor="end">${esc(vy.u)}</text>`:''}<text x="${ml+pw/2}" y="${H-8}" class="prx prxt" text-anchor="middle">${esc(xt)}</text></svg>`}
function prTabla(c,V){const vy=V.find(z=>z.id==prg.d),xid=prIdX(),p=prPuntos(V,c,xid,vy).sort((a,b)=>a.x-b.x),vx=V.find(z=>z.id==xid),fx=x=>xid=='fecha'?prFecha(x*864e5):prFn(x);
 return`<table class="prtb"><thead><tr><th>${esc(xid=='fecha'?'Fecha':xid=='dias'?'Día':vx?vx.l:'')}</th><th>${esc(vy.l)}</th></tr></thead><tbody>${p.map(q=>`<tr><td>${esc(fx(q.x))}</td><td>${prFn(q.y)}${vy.u?' '+esc(vy.u):''}</td></tr>`).join('')}</tbody></table>`}
function prCuerpo(c){const V=prVars(c);if(prg.c!=c.id)prg={c:c.id,t:'lin',k:'',d:'',xk:'fecha',xd:''};
 if(!V.length)return`<div class="card pcd pvac"><div class="pct">${ic('chart',20)}<b>Progreso</b></div><p class="mut pcn">Todavía no hay nada que dibujar. Aparecerán aquí el dolor (EVA), la fuerza y el rango de movimiento que registres en Clínica, y la carga y el RPE de los ejercicios de sus rutinas y planes semanales.</p></div>`;
 prAjustar(c,V);const T=prTipos(V),de=k=>V.filter(z=>z.t==k),les=prLesion(c),vy=V.find(z=>z.id==prg.d),svg=prSVG(c,V),xid=prIdX();
 const sel=(id,k,sd,etq,dt)=>`<label class="lb">${etq}<select id="${id}">${dt.map(o=>`<option value="${esc(o[0])}"${o[0]==sd?' selected':''}>${esc(o[1])}</option>`).join('')}</select></label>`;
 const tY=T.map(k=>[k,PR_T[k]]),tX=[['fecha','Fecha']].concat(les?[['dias','Días desde el inicio de la lesión']]:[]).concat(tY);
 return`<div class="card pcd prgc"><div class="pct">${ic('chart',20)}<b>Progreso</b></div>
<div class="segc prtype" role="group" aria-label="Tipo de gráfico"><button data-a="prt" data-v="lin" class="${prg.t=='lin'?'on':''}">Líneas con puntos</button><button data-a="prt" data-v="bar" class="${prg.t=='bar'?'on':''}">Barras</button></div>
<div class="prsel"><div class="prgrp">${sel('pry','',prg.k,'Eje vertical (Y)',tY)}${sel('pryd','',prg.d,PR_D[prg.k],de(prg.k).map(z=>[z.id,prOpt(z)]))}</div>
<div class="prgrp">${sel('prx','',prg.xk,'Eje horizontal (X)',tX)}${prg.xk!='fecha'&&prg.xk!='dias'?sel('prxd','',prg.xd,PR_D[prg.xk],de(prg.xk).map(z=>[z.id,prOpt(z)])):''}</div></div>
${svg?`<div class="prleg"><span class="prlg"><i style="background:var(--ac)"></i>${esc(vy.l)}${vy.u?' ('+esc(vy.u)+')':''}</span></div>${svg}<div id="prread" class="prread mut" aria-live="polite">Toca un punto o una barra para ver su valor.</div>${prg.xk=='dias'&&les?`<p class="mut prnote">Día 0 = inicio de «${esc(les.name||'Lesión')}» (${esc(fmtD(les.opened))}).</p>`:''}${xid!='fecha'&&xid!='dias'?'<p class="mut prnote">Con otra variable en el eje horizontal, solo se dibujan las fechas en las que hay registro de las dos.</p>':''}<details class="prdet"><summary>Ver los datos del gráfico</summary>${prTabla(c,V)}</details>`:`<p class="mut pcn">No hay fechas en común entre las variables elegidas. Prueba con «Fecha» en el eje horizontal o elige otra variable.</p>`}</div>`}
const paProgreso=c=>`<div id="prg">${prCuerpo(c)}</div>`;
function prPintar(){const c=cc(),b=$('#prg');if(c&&b)b.innerHTML=prCuerpo(c)}
