// Capa de datos: guarda TODO en IndexedDB (copia completa en este dispositivo) como registros listos para sincronizar.
// El resto de la app sigue usando el objeto st en memoria; solo save() y el arranque pasan por aquí.
// Identificador único: prefijo + hora + contador (nunca se repite en este dispositivo) + azar (distingue dispositivos).
const uid=(()=>{let n=0;return p=>p+Date.now().toString(36)+(n++).toString(36)+Math.random().toString(36).slice(2,6)})();
const Datos=(()=>{
  const DB='fisio-os',VER=1,ESQUEMA=1;
  // Selecciones de ESTE dispositivo (deportista abierto, rutina activa…): se guardan pero no se sincronizarán.
  const LOCALES=['active','gsel','cc','fcase'];
  const CONOCIDAS=['custom','routines','week','ov','groups','clients'].concat(LOCALES);
  let db=null,idx=new Map(),timer=null,cola=Promise.resolve(),fuente=null,selPrev=null,deviceId=null,ult=0;
  const api={alError:()=>{},alOk:()=>{},alAviso:()=>{},esquema:ESQUEMA};
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
    Object.keys(st.ov||{}).forEach(id=>M.set(clave('override',id),{k:clave('override',id),id,kind:'override',parent:null,ord:0,data:st.ov[id]}));
    M.set(clave('ajuste','semana'),{k:clave('ajuste','semana'),id:'semana',kind:'ajuste',parent:null,ord:0,data:{map:st.week||{}}});
    const resto={};Object.keys(st).forEach(k=>{if(!CONOCIDAS.includes(k))resto[k]=st[k]});
    if(Object.keys(resto).length)M.set(clave('ajuste','resto'),{k:clave('ajuste','resto'),id:'resto',kind:'ajuste',parent:null,ord:0,data:resto});
    return M}

  // registros planos -> st (anidado). Los hijos cuyo padre no existe se ignoran (se cuentan en huerfanos).
  function ensamblar(regs){
    const st={custom:[],routines:[],week:{},active:null,clients:[],cc:null,ov:{},groups:[]};let huerfanos=0;const usados=new Set();
    const por=k=>regs.filter(r=>r.kind==k).sort((a,b)=>a.ord-b.ord),U=r=>(usados.add(r.k),r.data);
    const cl=new Map(),ca=new Map();
    por('client').forEach(r=>{const c=Object.assign({},U(r),{plans:[],weeks:[],cases:[]});cl.set(r.id,c);st.clients.push(c)});
    por('plan').forEach(r=>{const c=cl.get(r.parent);c?c.plans.push(U(r)):huerfanos++});
    por('week').forEach(r=>{const c=cl.get(r.parent);c?c.weeks.push(U(r)):huerfanos++});
    por('case').forEach(r=>{const c=cl.get(r.parent);if(!c){huerfanos++;return}const f=Object.assign({},U(r),{entries:[]});ca.set(r.id,f);c.cases.push(f)});
    por('entry').forEach(r=>{const f=ca.get(r.parent);f?f.entries.push(U(r)):huerfanos++});
    por('routine').forEach(r=>st.routines.push(U(r)));
    por('group').forEach(r=>st.groups.push(U(r)));
    por('exercise').forEach(r=>st.custom.push(U(r)));
    por('override').forEach(r=>{st.ov[r.id]=U(r)});
    por('ajuste').forEach(r=>{if(r.id=='semana')st.week=U(r).map||{};else Object.assign(st,U(r))});
    return{st,huerfanos,usados}}

  async function cargar(){
    const tx=db.transaction(['registros','meta'],'readonly');
    const todos=await req(tx.objectStore('registros').getAll()),sel=await req(tx.objectStore('meta').get('sel'));
    idx.clear();const vivos=[];let danados=0;
    for(const r of todos){
      const ok=!r.deletedAt&&r.data&&typeof r.data=='object';
      idx.set(r.k,{json:ok?JSON.stringify([r.parent,r.ord,r.data]):null,parent:r.parent,ord:r.ord,kind:r.kind,id:r.id,updatedAt:r.updatedAt,deletedAt:r.deletedAt||null});
      if(ok)vivos.push(r);else if(!r.deletedAt)danados++}
    const e=ensamblar(vivos);
    for(const [k,p] of idx)if(!p.deletedAt&&!e.usados.has(k))p.retenido=true;   // dañados u huérfanos: se conservan tal cual, nunca se borran solos
    if(sel){LOCALES.forEach(k=>{if(sel[k]!==null&&sel[k]!==undefined)e.st[k]=sel[k]});selPrev=JSON.stringify(sel)}
    return{st:e.st,total:todos.length,vivos:vivos.length,danados,huerfanos:e.huerfanos}}

  // Escribe solo lo que ha cambiado desde la última vez. Lo borrado queda como "lápida" (deletedAt) para poder sincronizarlo.
  async function persistir(get){
    const st=get();if(!st||!db)return 0;
    const plano=aplanar(st),ahora=Date.now(),esc=[],prev=new Map();
    for(const [k,r] of plano){
      const json=JSON.stringify([r.parent,r.ord,r.data]),p=idx.get(k);
      if(!p||p.json!==json||p.deletedAt){prev.set(k,p);esc.push({k:r.k,id:r.id,kind:r.kind,parent:r.parent,ord:r.ord,data:r.data,updatedAt:ahora,deletedAt:null});
        idx.set(k,{json,parent:r.parent,ord:r.ord,kind:r.kind,id:r.id,updatedAt:ahora,deletedAt:null})}}
    for(const [k,p] of idx){
      if(!plano.has(k)&&!p.deletedAt&&!p.retenido){prev.set(k,p);esc.push({k,id:p.id,kind:p.kind,parent:p.parent,ord:p.ord,data:null,updatedAt:ahora,deletedAt:ahora});
        idx.set(k,Object.assign({},p,{json:null,updatedAt:ahora,deletedAt:ahora}))}}
    const sel={};LOCALES.forEach(x=>{sel[x]=st[x]===undefined?null:st[x]});const selJson=JSON.stringify(sel);
    if(!esc.length&&selJson===selPrev){ult=0;return 0}
    try{
      const tx=db.transaction(['registros','meta'],'readwrite'),R=tx.objectStore('registros');
      esc.forEach(r=>R.put(r));tx.objectStore('meta').put(sel,'sel');await fin(tx);
    }catch(e){for(const [k,p] of prev){p?idx.set(k,p):idx.delete(k)}throw e}   // si falla, se reintentará en el próximo guardado
    selPrev=selJson;ult=esc.length;return esc.length}

  function vaciar(){clearTimeout(timer);timer=null;
    if(!db||!fuente)return cola;
    cola=cola.then(()=>persistir(fuente)).then(()=>api.alOk(),e=>{
      const cuota=e&&(e.name=='QuotaExceededError'||/quota/i.test(e.message||''));
      api.alError(cuota?'No hay espacio en el dispositivo: los últimos cambios no se han guardado.':'No se han podido guardar los últimos cambios en este dispositivo.',e)});
    return cola}
  function programar(get){if(!db)return;fuente=get;clearTimeout(timer);timer=setTimeout(vaciar,150)}

  // Datos de la versión anterior (localStorage). Se importan una sola vez y la copia antigua se conserva sin tocar.
  function leerAntiguo(){try{if(localStorage.getItem('plan_v1_migrado'))return null;const raw=localStorage.getItem('plan_v1');if(!raw)return null;return JSON.parse(raw)}catch(e){api.alAviso('Hay datos antiguos en este dispositivo pero están dañados: no se han importado (siguen guardados).',e);return null}}

  async function iniciar(){
    if(typeof indexedDB=='undefined')throw new Error('Este navegador no permite guardar datos de la app.');
    db=await abrir();
    const m=db.transaction('meta','readonly').objectStore('meta');deviceId=await req(m.get('deviceId'));
    if(!deviceId){deviceId=uid('d');const t=db.transaction('meta','readwrite');t.objectStore('meta').put(deviceId,'deviceId');t.objectStore('meta').put(ESQUEMA,'esquema');await fin(t)}
    let r=await cargar(),migrado=false;
    if(!r.total){const o=leerAntiguo();if(o&&typeof o=='object'){await persistir(()=>Object.assign({custom:[],routines:[],week:{},clients:[],ov:{},groups:[]},o));try{localStorage.setItem('plan_v1_migrado',new Date().toISOString())}catch(e){}r=await cargar();migrado=true}}
    r.migrado=migrado;return r}

  Object.assign(api,{iniciar,programar,vaciar,aplanar,ensamblar,
    id:()=>deviceId,ultimaEscritura:()=>ult,_db:()=>db,
    // Para la futura sincronización: todos los registros (incluidas lápidas) modificados después de 'desde'.
    async registros(desde){const t=db.transaction('registros','readonly');const todos=await req(t.objectStore('registros').getAll());return todos.filter(r=>r.updatedAt>(desde||0))}});
  return api})();
