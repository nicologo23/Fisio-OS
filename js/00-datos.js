// Capa de datos: guarda TODO en IndexedDB (copia completa en este dispositivo) como registros listos para sincronizar.
// El resto de la app sigue usando el objeto st en memoria; solo save() y el arranque pasan por aquí.
// Identificador único: prefijo + hora + contador (nunca se repite en este dispositivo) + azar (distingue dispositivos).
const uid=(()=>{let n=0;return p=>p+Date.now().toString(36)+(n++).toString(36)+Math.random().toString(36).slice(2,6)})();
const Datos=(()=>{
  const DB='fisio-os',VER=1,ESQUEMA=2;   // esquema 2: cada registro lleva vv (versión por dispositivo) y pend (pendiente de subir)
  // Selecciones de ESTE dispositivo (deportista abierto, rutina activa…): se guardan pero no se sincronizarán.
  const LOCALES=['active','gsel','cc','fcase'];
  const CONOCIDAS=['custom','routines','week','ov','groups','clients','conflicts'].concat(LOCALES);
  let db=null,idx=new Map(),timer=null,cola=Promise.resolve(),fuente=null,selPrev=null,deviceId=null,ult=0,visto=0,porEscribir=new Map();
  const api={alError:()=>{},alOk:()=>{},alAviso:()=>{},alCambios:()=>{},esquema:ESQUEMA};
  const req=r=>new Promise((ok,ko)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});
  const fin=tx=>new Promise((ok,ko)=>{tx.oncomplete=()=>ok();tx.onerror=()=>ko(tx.error);tx.onabort=()=>ko(tx.error||new Error('Transacción cancelada'))});
  const clave=(kind,id)=>kind+'/'+id;
  function abrir(){return new Promise((ok,ko)=>{const r=indexedDB.open(DB,VER);
    r.onupgradeneeded=()=>{const d=r.result;
      if(!d.objectStoreNames.contains('registros')){const s=d.createObjectStore('registros',{keyPath:'k'});s.createIndex('kind','kind');s.createIndex('updatedAt','updatedAt')}
      if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta')};
    r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);r.onblocked=()=>ko(new Error('Base de datos bloqueada por otra pestaña'))})}

  // st (anidado) -> registros planos: {k,id,kind,parent,ord,data}
  function aplanar(st){
    const M=new Map();
    const add=(kind,o,parent,ord,omit)=>{
      if(!o||typeof o!='object')return;
      if(!o.id||M.has(clave(kind,o.id)))o.id=uid(kind[0]);   // sin id o repetido: se le da uno nuevo para no perder nada
      const data={};for(const k in o)if(!omit||!omit.includes(k))data[k]=o[k];
      M.set(clave(kind,o.id),{k:clave(kind,o.id),id:o.id,kind,parent:parent||null,ord,data})};
    (st.clients||[]).forEach((c,i)=>{add('client',c,null,i,['plans','weeks','cases']);
      (c.plans||[]).forEach((p,j)=>add('plan',p,c.id,j));
      (c.weeks||[]).forEach((w,j)=>add('week',w,c.id,j));
      (c.cases||[]).forEach((f,j)=>{add('case',f,c.id,j,['entries']);(f.entries||[]).forEach((e,m)=>add('entry',e,f.id,m))})});
    (st.routines||[]).forEach((r,i)=>add('routine',r,null,i));
    (st.groups||[]).forEach((g,i)=>add('group',g,null,i));
    (st.custom||[]).forEach((e,i)=>add('exercise',e,null,i));
    (st.conflicts||[]).forEach((x,i)=>add('conflicto',x,null,i));
    Object.keys(st.ov||{}).forEach(id=>M.set(clave('override',id),{k:clave('override',id),id,kind:'override',parent:null,ord:0,data:st.ov[id]}));
    M.set(clave('ajuste','semana'),{k:clave('ajuste','semana'),id:'semana',kind:'ajuste',parent:null,ord:0,data:{map:st.week||{}}});
    const resto={};Object.keys(st).forEach(k=>{if(!CONOCIDAS.includes(k))resto[k]=st[k]});
    if(Object.keys(resto).length)M.set(clave('ajuste','resto'),{k:clave('ajuste','resto'),id:'resto',kind:'ajuste',parent:null,ord:0,data:resto});
    return M}

  // registros planos -> st (anidado). Los hijos cuyo padre no existe se ignoran (se cuentan en huerfanos).
  function ensamblar(regs){
    const st={custom:[],routines:[],week:{},active:null,clients:[],cc:null,ov:{},groups:[],conflicts:[]};let huerfanos=0;const usados=new Set();
    const por=k=>regs.filter(r=>r.kind==k).sort((a,b)=>(a.ord-b.ord)||(a.id<b.id?-1:a.id>b.id?1:0)),U=r=>(usados.add(r.k),r.data);
    const cl=new Map(),ca=new Map();
    por('client').forEach(r=>{const c=Object.assign({},U(r),{plans:[],weeks:[],cases:[]});cl.set(r.id,c);st.clients.push(c)});
    por('plan').forEach(r=>{const c=cl.get(r.parent);c?c.plans.push(U(r)):huerfanos++});
    por('week').forEach(r=>{const c=cl.get(r.parent);c?c.weeks.push(U(r)):huerfanos++});
    por('case').forEach(r=>{const c=cl.get(r.parent);if(!c){huerfanos++;return}const f=Object.assign({},U(r),{entries:[]});ca.set(r.id,f);c.cases.push(f)});
    por('entry').forEach(r=>{const f=ca.get(r.parent);f?f.entries.push(U(r)):huerfanos++});
    por('routine').forEach(r=>st.routines.push(U(r)));
    por('group').forEach(r=>st.groups.push(U(r)));
    por('exercise').forEach(r=>st.custom.push(U(r)));
    por('conflicto').forEach(r=>st.conflicts.push(U(r)));
    por('override').forEach(r=>{st.ov[r.id]=U(r)});
    por('ajuste').forEach(r=>{if(r.id=='semana')st.week=U(r).map||{};else Object.assign(st,U(r))});
    return{st,huerfanos,usados}}

  // ---- Versiones por registro (vv) -------------------------------------------------------------
  // vv = {idDispositivo: contador}. Cada cambio local suma 1 al contador de este dispositivo. Al comparar dos versiones:
  // una "domina" si es posterior a la otra; si ninguna domina, se editó lo mismo en dos sitios a la vez (concurrentes).
  const cmp=(a,b)=>{let ma=false,mb=false;for(const k of new Set(Object.keys(a).concat(Object.keys(b)))){const x=a[k]||0,y=b[k]||0;if(x>y)ma=true;else if(y>x)mb=true}return ma&&mb?'conc':ma?'a':mb?'b':'eq'};
  const junta=(a,b)=>{const o=Object.assign({},a);for(const k in b)o[k]=Math.max(o[k]||0,b[k]);return o};
  const sube=vv=>{const o=Object.assign({},vv);o[deviceId]=(o[deviceId]||0)+1;return o};
  // Registro completo (formato de IndexedDB y de los archivos de la nube) a partir de la entrada del índice.
  const aReg=(k,p)=>{const j=p.json?JSON.parse(p.json):null;return{k,id:p.id,kind:p.kind,parent:p.parent,ord:p.ord,data:p.deletedAt||!j?null:j[2],updatedAt:p.updatedAt,deletedAt:p.deletedAt||null,vv:p.vv||{},pend:p.pend?1:0}};
  const dePlano=r=>({json:r.deletedAt?null:JSON.stringify([r.parent,r.ord,r.data]),parent:r.parent,ord:r.ord,kind:r.kind,id:r.id,updatedAt:r.updatedAt,deletedAt:r.deletedAt||null,vv:r.vv||{},pend:!!r.pend});
  const gana=(a,b)=>a.updatedAt!==b.updatedAt?a.updatedAt>b.updatedAt:JSON.stringify([a.parent,a.ord,a.data])>JSON.stringify([b.parent,b.ord,b.data]);   // mismo resultado en cualquier dispositivo

  async function migrar(){   // esquema 1 -> 2: todo lo que había se considera cambio local aún no subido
    const tx=db.transaction(['registros','meta'],'readwrite'),R=tx.objectStore('registros');
    const todos=await req(R.getAll());
    todos.forEach(r=>{if(!r.vv)r.vv={[deviceId]:1};r.pend=1;R.put(r)});
    tx.objectStore('meta').put(ESQUEMA,'esquema');await fin(tx)}

  async function cargar(){
    const tx=db.transaction(['registros','meta'],'readonly');
    const todos=await req(tx.objectStore('registros').getAll()),sel=await req(tx.objectStore('meta').get('sel'));
    idx.clear();const vivos=[];let danados=0;
    for(const r of todos){
      const ok=!r.deletedAt&&r.data&&typeof r.data=='object';
      visto=Math.max(visto,r.updatedAt||0);
      idx.set(r.k,{json:ok?JSON.stringify([r.parent,r.ord,r.data]):null,parent:r.parent,ord:r.ord,kind:r.kind,id:r.id,updatedAt:r.updatedAt,deletedAt:r.deletedAt||null,vv:r.vv||{},pend:!!r.pend});
      if(ok)vivos.push(r);else if(!r.deletedAt)danados++}
    const e=ensamblar(vivos);
    for(const [k,p] of idx)if(!p.deletedAt&&!e.usados.has(k))p.retenido=true;   // dañados u huérfanos: se conservan tal cual, nunca se borran solos
    if(sel){LOCALES.forEach(k=>{if(sel[k]!==null&&sel[k]!==undefined)e.st[k]=sel[k]});selPrev=JSON.stringify(sel)}
    return{st:e.st,total:todos.length,vivos:vivos.length,danados,huerfanos:e.huerfanos}}

  // Compara st con lo ya guardado y actualiza el índice EN MEMORIA (sin esperas). Devuelve los registros cambiados.
  // Lo borrado queda como "lápida" (deletedAt) para poder sincronizarlo.
  function capturar(st){
    const plano=aplanar(st),esc=[];
    // La semana vacía de un dispositivo nuevo no se crea: así no choca con la semana real que venga de otro dispositivo.
    const sem=plano.get('ajuste/semana');if(sem&&!Object.keys(sem.data.map).length&&!idx.has('ajuste/semana'))plano.delete('ajuste/semana');
    const ahora=Math.max(Date.now(),visto+1);   // nunca menor que lo ya visto, aunque el reloj de este dispositivo vaya atrasado
    for(const [k,r] of plano){
      const json=JSON.stringify([r.parent,r.ord,r.data]),p=idx.get(k);
      if(!p||p.json!==json||p.deletedAt){
        const n={json,parent:r.parent,ord:r.ord,kind:r.kind,id:r.id,updatedAt:ahora,deletedAt:null,vv:sube(p&&p.vv),pend:true};
        idx.set(k,n);esc.push(aReg(k,n))}}
    for(const [k,p] of idx){
      if(!plano.has(k)&&!p.deletedAt&&!p.retenido){
        const n=Object.assign({},p,{json:null,updatedAt:ahora,deletedAt:ahora,vv:sube(p.vv),pend:true});
        idx.set(k,n);esc.push(aReg(k,n))}}
    if(esc.length)visto=ahora;
    return esc}

  // Escribe en IndexedDB. Lo que no se pueda escribir se guarda en 'porEscribir' y se reintenta en la siguiente escritura.
  async function grabar(regs,sel){
    regs.forEach(r=>porEscribir.set(r.k,r));
    const lote=[...porEscribir.values()];
    if(!lote.length&&sel===undefined)return 0;
    const tx=db.transaction(['registros','meta'],'readwrite'),R=tx.objectStore('registros');
    lote.forEach(r=>R.put(r));if(sel!==undefined)tx.objectStore('meta').put(sel,'sel');
    await fin(tx);
    lote.forEach(r=>{if(porEscribir.get(r.k)===r)porEscribir.delete(r.k)});
    return lote.length}

  async function persistir(get){
    const st=get();if(!st||!db)return 0;
    const esc=capturar(st);
    const sel={};LOCALES.forEach(x=>{sel[x]=st[x]===undefined?null:st[x]});const selJson=JSON.stringify(sel);
    if(!esc.length&&selJson===selPrev&&!porEscribir.size){ult=0;return 0}
    await grabar(esc,selJson===selPrev?undefined:sel);
    selPrev=selJson;ult=esc.length;return esc.length}

  function vaciar(){clearTimeout(timer);timer=null;
    if(!db||!fuente)return cola;
    cola=cola.then(()=>persistir(fuente)).then(n=>{api.alOk();if(n)api.alCambios(n)},errEscritura);
    return cola}
  function errEscritura(e){
    const cuota=e&&(e.name=='QuotaExceededError'||/quota/i.test(e.message||''));
    api.alError(cuota?'No hay espacio en el dispositivo: los últimos cambios no se han guardado.':'No se han podido guardar los últimos cambios en este dispositivo.',e)}
  function programar(get){if(!db)return;fuente=get;clearTimeout(timer);timer=setTimeout(vaciar,150)}

  // ---- Sincronización: lo que necesita el motor (js/12-sync.js) -----------------------------------
  const pendientes=()=>{let n=0;for(const p of idx.values())if(p.pend&&!p.retenido)n++;return n};
  // Todos los registros de este dispositivo (con lápidas) para subirlos. Llamar tras await vaciar().
  const exportar=()=>[...idx].filter(([k,p])=>!p.retenido).map(([k,p])=>aReg(k,p));
  // Tras subir con éxito: lo que no cambió mientras tanto deja de estar pendiente.
  function marcarSubido(subidos){
    const reg=[];
    for(const s of subidos){const p=idx.get(s.k);if(p&&p.pend&&p.updatedAt===s.updatedAt&&JSON.stringify(p.vv)===JSON.stringify(s.vv)){p.pend=false;reg.push(aReg(s.k,p))}}
    if(reg.length)cola=cola.then(()=>grabar(reg)).then(()=>{},errEscritura);
    return cola}

  // Mezcla los registros de otro dispositivo con los locales. TODO es síncrono (sin esperas entre leer st y reemplazarlo),
  // así que ninguna edición de pantalla se puede perder a mitad. 'st' se modifica en su sitio.
  function fusionar(st,remotos){
    const res={nuevos:0,actualizados:0,conflictos:0,recuperados:0,ignorados:0,huerfanos:0};
    const cambia=new Set();
    capturar(st).forEach(r=>cambia.add(r.k));   // primero se anota lo que hubiera sin guardar
    for(const r of remotos){
      if(!r||typeof r.k!='string'||r.k!==r.kind+'/'+r.id||typeof r.updatedAt!='number'||!r.vv||typeof r.vv!='object'||(!r.deletedAt&&(!r.data||typeof r.data!='object'))){res.ignorados++;continue}
      visto=Math.max(visto,r.updatedAt);
      const p=idx.get(r.k);
      if(!p){idx.set(r.k,dePlano(Object.assign({},r,{pend:false})));cambia.add(r.k);if(!r.deletedAt)res.nuevos++;continue}
      if(p.retenido){res.ignorados++;continue}
      const c=cmp(p.vv||{},r.vv);
      if(c=='eq'||c=='a')continue;                                    // ya lo tenemos, o lo nuestro es más nuevo
      if(c=='b'){idx.set(r.k,dePlano(Object.assign({},r,{pend:false})));cambia.add(r.k);if(!r.deletedAt)res.actualizados++;continue}
      // Concurrentes: se cambió lo mismo en dos dispositivos a la vez.
      const L=aReg(r.k,p),vj=junta(L.vv,r.vv);let g,perd=null;
      if(L.deletedAt&&r.deletedAt)g=gana(L,r)?L:r;
      else if(L.deletedAt){g=r;res.recuperados++}                      // borrado en uno y editado en otro: se conserva lo editado
      else if(r.deletedAt){g=L;res.recuperados++}
      else{g=gana(L,r)?L:r;if(JSON.stringify(L.data)!==JSON.stringify(r.data))perd=g===L?r:L}
      // El resultado es idéntico en todos los dispositivos (misma versión unida, sin sumar), así que no se vuelve a discutir.
      idx.set(r.k,dePlano(Object.assign({},g,{vv:vj,pend:true})));cambia.add(r.k);
      if(perd){   // la versión perdedora no se tira: queda en la lista de conflictos
        const cid='x'+r.k.replace(/[^\w]/g,'_')+'_'+perd.updatedAt,ck='conflicto/'+cid;
        if(!idx.has(ck)){const f=Math.max(L.updatedAt,r.updatedAt);
          idx.set(ck,dePlano({k:ck,id:cid,kind:'conflicto',parent:null,ord:0,data:{id:cid,rk:r.k,kind:perd.kind,rid:perd.id,parent:perd.parent,ord:perd.ord,data:perd.data,fecha:f},updatedAt:f,deletedAt:null,vv:{'*':1},pend:true}));cambia.add(ck)}
        res.conflictos++}}
    {
      const vivos=[];for(const [k,p] of idx)if(!p.deletedAt&&p.json)vivos.push(aReg(k,p));
      const e=ensamblar(vivos);res.huerfanos=e.huerfanos;
      for(const [k,p] of idx){if(!p.deletedAt&&!e.usados.has(k))p.retenido=true;else delete p.retenido}
      const loc={};LOCALES.forEach(k=>{loc[k]=st[k]});
      Object.keys(st).forEach(k=>{delete st[k]});Object.assign(st,e.st);
      LOCALES.forEach(k=>{if(loc[k]!==undefined)st[k]=loc[k]});
      capturar(st).forEach(r=>cambia.add(r.k))}                      // renumera posiciones si hizo falta
    const regs=[...cambia].map(k=>aReg(k,idx.get(k)));
    if(regs.length)cola=cola.then(()=>grabar(regs)).then(()=>api.alOk(),errEscritura);
    return res}

  // Conflictos: cada uno guarda la versión que "perdió". Usarla intercambia las dos versiones (no se pierde ninguna).
  function buscar(st,kind,id){
    const en=l=>(l||[]).find(o=>o&&o.id==id);
    if(kind=='client')return en(st.clients);if(kind=='routine')return en(st.routines);if(kind=='group')return en(st.groups);if(kind=='exercise')return en(st.custom);
    for(const c of st.clients||[]){
      if(kind=='plan'){const o=en(c.plans);if(o)return o}else if(kind=='week'){const o=en(c.weeks);if(o)return o}
      else if(kind=='case'){const o=en(c.cases);if(o)return o}
      else if(kind=='entry')for(const f of c.cases||[]){const o=en(f.entries);if(o)return o}}
    return null}
  const HIJOS={client:['plans','weeks','cases'],case:['entries']};
  function datosDe(st,kind,rid,obj,muestra){
    if(kind=='ajuste'&&rid=='semana')return{map:JSON.parse(JSON.stringify(st.week||{}))};
    if(kind=='ajuste'&&rid=='resto'){const o={};Object.keys(muestra||{}).forEach(k=>{if(st[k]!==undefined)o[k]=JSON.parse(JSON.stringify(st[k]))});return o}
    if(kind=='override')return st.ov[rid]?JSON.parse(JSON.stringify(st.ov[rid])):null;
    if(!obj)return null;const o={};Object.keys(obj).forEach(k=>{if(!(HIJOS[kind]||[]).includes(k))o[k]=JSON.parse(JSON.stringify(obj[k]))});return o}
  function usarConflicto(st,id){
    const c=(st.conflicts||[]).find(x=>x.id==id);if(!c)return{ok:false,msg:'Ese conflicto ya no existe.'};
    const obj=buscar(st,c.kind,c.rid),actual=datosDe(st,c.kind,c.rid,obj,c.data),nuevo=JSON.parse(JSON.stringify(c.data));
    if(c.kind=='ajuste'&&c.rid=='semana')st.week=nuevo.map||{};
    else if(c.kind=='ajuste'&&c.rid=='resto')Object.assign(st,nuevo);
    else if(c.kind=='override'){if(!st.ov)st.ov={};st.ov[c.rid]=nuevo}
    else if(obj){const hijos={};(HIJOS[c.kind]||[]).forEach(k=>{hijos[k]=obj[k]});Object.keys(obj).forEach(k=>{delete obj[k]});Object.assign(obj,nuevo,hijos)}
    else return{ok:false,msg:'Ese elemento ya no existe, así que no se puede restaurar. Puedes consultar el contenido y copiarlo a mano.'};
    c.data=actual;return{ok:true}}
  function descartarConflicto(st,id){const i=(st.conflicts||[]).findIndex(x=>x.id==id);if(i<0)return false;st.conflicts.splice(i,1);return true}

  // Datos de la versión anterior (localStorage). Se importan una sola vez y la copia antigua se conserva sin tocar.
  function leerAntiguo(){try{if(localStorage.getItem('plan_v1_migrado'))return null;const raw=localStorage.getItem('plan_v1');if(!raw)return null;return JSON.parse(raw)}catch(e){api.alAviso('Hay datos antiguos en este dispositivo pero están dañados: no se han importado (siguen guardados).',e);return null}}

  async function iniciar(){
    if(typeof indexedDB=='undefined')throw new Error('Este navegador no permite guardar datos de la app.');
    db=await abrir();
    const m=db.transaction('meta','readonly').objectStore('meta');deviceId=await req(m.get('deviceId'));
    const esq=await req(db.transaction('meta','readonly').objectStore('meta').get('esquema'));
    if(!deviceId){deviceId=uid('d');const t=db.transaction('meta','readwrite');t.objectStore('meta').put(deviceId,'deviceId');t.objectStore('meta').put(ESQUEMA,'esquema');await fin(t)}
    else if((esq||1)<ESQUEMA)await migrar();
    else if(esq>ESQUEMA)api.alAviso('Los datos de este dispositivo los guardó una versión más nueva de la app. Actualiza la app antes de seguir editando.');
    let r=await cargar(),migrado=false;
    if(!r.total){const o=leerAntiguo();if(o&&typeof o=='object'){await persistir(()=>Object.assign({custom:[],routines:[],week:{},clients:[],ov:{},groups:[]},o));try{localStorage.setItem('plan_v1_migrado',new Date().toISOString())}catch(e){}r=await cargar();migrado=true}}
    r.migrado=migrado;return r}

  const meta={async get(k){return req(db.transaction('meta','readonly').objectStore('meta').get(k))},
              async set(k,v){const t=db.transaction('meta','readwrite');t.objectStore('meta').put(v,k);await fin(t)}};

  Object.assign(api,{iniciar,programar,vaciar,aplanar,ensamblar,pendientes,exportar,marcarSubido,fusionar,usarConflicto,descartarConflicto,meta,
    id:()=>deviceId,ultimaEscritura:()=>ult,_db:()=>db,_idx:()=>idx,
    // Todos los registros (incluidas lápidas) modificados después de 'desde'.
    async registros(desde){const t=db.transaction('registros','readonly');const todos=await req(t.objectStore('registros').getAll());return todos.filter(r=>r.updatedAt>(desde||0))}});
  return api})();
