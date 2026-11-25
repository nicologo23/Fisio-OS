// Capa de datos (IndexedDB): migración, guardar/recuperar, borrados (lápidas), orden, errores y datos dañados.
const { IDBFactory } = require('fake-indexeddb');
const { open } = require('./lib.js');
const demo = require('./demo.js');
const canon = o => Array.isArray(o) ? o.map(canon) : (o && typeof o == 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, canon(o[k])])) : o;
const norm = st => canon({ clients: st.clients.map(c => Object.assign({ plans: [], weeks: [], cases: [] }, c, { cases: (c.cases || []).map(f => Object.assign({ entries: [] }, f)) })), routines: st.routines, groups: st.groups, custom: st.custom, ov: st.ov, week: st.week, active: st.active, cc: st.cc, gsel: st.gsel, fcase: st.fcase });
const abrir = (idb, o) => open(Object.assign({ idb, wait: 500, seed: false }, o || {}));
(async () => {
  const H0 = open({ seed: false, wait: 1 }), { T } = H0;   // solo para T y finish()
  const idb = new IDBFactory();

  // 1. Migración desde la versión anterior (localStorage -> IndexedDB)
  let A = abrir(idb, { seed: true }); await A.ready();
  T('migración: arranca sin errores', A.errs.length == 0);
  T('migración: se importan los 3 deportistas', A.S().clients.length == 3);
  T('migración: los datos son idénticos a los originales', JSON.stringify(norm(A.S())) == JSON.stringify(norm(demo())));
  T('migración: copia antigua conservada y marca puesta', !!A.w.localStorage.getItem('plan_v1') && !!A.w.localStorage.getItem('plan_v1_migrado'));
  const regs = await A.Datos.registros(0);
  T('registros = elementos del estado', regs.length == A.Datos.aplanar(A.S()).size);
  const kinds = new Set(regs.map(r => r.kind));
  T('hay registros de cada tipo', ['client', 'case', 'entry', 'plan', 'week', 'routine', 'group', 'ajuste'].every(k => kinds.has(k)));
  T('registros con id, fecha y sin marca de borrado', regs.every(r => r.id && r.updatedAt > 0 && !r.deletedAt));
  T('identificador de dispositivo', /^d/.test(A.Datos.id()));
  const t0 = Date.now(); await new Promise(r => setTimeout(r, 5));

  // 2. Guardar un cambio escribe solo lo que cambió
  A.w.eval("st.clients[0].cases[0].entries.push({id:uid('n'),n:1,date:'2026-11-20',type:'Nota',text:'prueba',pain:'2',meas:[]});st.cc='k2';save()");
  await A.flush();
  T('añadir 1 anotación escribe 1 registro', A.Datos.ultimaEscritura() == 1);
  A.w.eval("st.clients[0].cases[0].entries[0].text='editado';save()"); await A.flush();
  T('editar 1 anotación escribe 1 registro', A.Datos.ultimaEscritura() == 1);
  A.w.eval("save()"); await A.flush();
  T('guardar sin cambios no escribe nada', A.Datos.ultimaEscritura() == 0);
  const nuevos = await A.Datos.registros(t0);
  T('registros(desde) devuelve solo lo modificado', nuevos.length == 2 && nuevos.every(r => r.updatedAt > t0));

  // 3. Cerrar y abrir (dispositivo nuevo en el mismo navegador, sin datos antiguos): todo vuelve igual
  const antes = norm(A.S()); A.close();
  let B = abrir(idb); await B.ready();
  T('reabrir: sin errores', B.errs.length == 0 && !B.d.getElementById('saveerr'));
  T('reabrir: datos idénticos', JSON.stringify(norm(B.S())) == JSON.stringify(antes));
  T('reabrir: la anotación editada sigue ahí', JSON.stringify(B.S()).includes('"text":"editado"'));
  T('reabrir: selección de este dispositivo recordada', B.S().cc == 'k2');
  T('reabrir: no reimporta lo antiguo', B.w.localStorage.getItem('plan_v1') === null);

  // 4. Borrados: quedan como lápida (para sincronizarlos) y no vuelven
  B.w.eval("st.clients[0].cases=st.clients[0].cases.filter(f=>f.id!='f2');save()"); await B.flush();
  T('borrar lesión con 1 anotación = 2 lápidas', B.Datos.ultimaEscritura() == 2);
  const lap = (await B.Datos.registros(0)).filter(r => r.deletedAt);
  T('las lápidas conservan tipo e id pero no el contenido', lap.length == 2 && lap.every(r => r.data === null && r.id && r.kind));
  B.w.eval("st.clients=st.clients.filter(c=>c.id!='k3');save()"); await B.flush();
  T('borrar deportista con 1 lesión = 2 lápidas', B.Datos.ultimaEscritura() == 2);
  B.close();
  let C = abrir(idb); await C.ready();
  T('tras borrar y reabrir no reaparece nada', C.S().clients.length == 2 && !C.S().clients[0].cases.some(f => f.id == 'f2') && !JSON.stringify(C.S().clients).includes('"k3"'));

  // 5. Orden y casos raros
  C.w.eval("st.routines.reverse();st.clients[0].cases[0].entries.push({id:'rep',n:2,date:'2026-11-21',type:'Nota',text:'a',pain:'',meas:[]},{id:'rep',n:3,date:'2026-11-22',type:'Nota',text:'b',pain:'',meas:[]},{n:4,date:'2026-11-23',type:'Nota',text:'sin id',pain:'',meas:[]});save()");
  const orden = C.S().routines.map(r => r.id), nEnt = C.S().clients[0].cases[0].entries.length; await C.flush(); C.close();
  let D = abrir(idb); await D.ready();
  T('el orden de las rutinas se conserva', JSON.stringify(D.S().routines.map(r => r.id)) == JSON.stringify(orden));
  T('ids repetidos o ausentes: no se pierde ninguna anotación', D.S().clients[0].cases[0].entries.length == nEnt);
  T('ids repetidos o ausentes: todos quedan distintos', new Set(D.S().clients[0].cases[0].entries.map(e => e.id)).size == nEnt);
  T('uid(): 2000 ids distintos', new Set(Array.from({ length: 2000 }, () => D.w.eval("uid('x')"))).size == 2000);
  D.close();

  // 6. Registros huérfanos o dañados: no rompen la app ni borran nada
  const raw = await new Promise((ok, ko) => { const q = idb.open('fisio-os', 1); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error) });
  await new Promise((ok, ko) => { const t = raw.transaction('registros', 'readwrite'), s = t.objectStore('registros');
    s.put({ k: 'entry/huerfana', id: 'huerfana', kind: 'entry', parent: 'no-existe', ord: 0, data: { id: 'huerfana', text: 'x' }, updatedAt: 1, deletedAt: null });
    s.put({ k: 'client/roto', id: 'roto', kind: 'client', parent: null, ord: 99, data: null, updatedAt: 1, deletedAt: null });
    t.oncomplete = ok; t.onerror = () => ko(t.error) }); raw.close();
  let E = abrir(idb); await E.ready();
  T('huérfanos/dañados: la app carga con el resto de datos', E.S().clients.length == 2 && E.errs.length == 0);
  const av = E.d.getElementById('saveerr');
  T('dañados: se avisa al usuario', !!av && /dañado/.test(av.textContent) && av.dataset.tipo == 'carga');
  E.w.eval("save()"); await E.flush();
  T('el aviso de carga no desaparece al guardar', !!E.d.getElementById('saveerr'));
  const aun = await E.Datos.registros(0);
  T('no se ha borrado el registro huérfano', aun.some(r => r.k == 'entry/huerfana' && !r.deletedAt));
  T('no se ha borrado ni tocado el registro dañado', aun.some(r => r.k == 'client/roto' && !r.deletedAt && r.data === null));
  E.close();

  // 7. Fallo al escribir: se avisa, no se pierde lo de memoria y se reintenta
  const idb2 = new IDBFactory(); let F = abrir(idb2, { seed: true }); await F.ready();
  F.w.eval("{const d=Datos._db(),o=d.transaction.bind(d);d.transaction=()=>{d.transaction=o;throw new Error('fallo simulado')}}");
  F.w.eval("st.clients[0].notes='nota importante';save()"); await F.flush();
  const er = F.d.getElementById('saveerr');
  T('fallo al guardar: aviso visible', !!er && er.dataset.tipo == 'guardado' && /No se han podido guardar/.test(er.textContent));
  T('fallo al guardar: los datos siguen en memoria', F.S().clients[0].notes == 'nota importante');
  F.w.eval("save()"); await F.flush();
  T('reintento: el aviso desaparece', !F.d.getElementById('saveerr'));
  F.close();
  let G = abrir(idb2); await G.ready();
  T('reintento: el cambio llegó a disco', G.S().clients[0].notes == 'nota importante');
  G.close();

  // 8. Dispositivo nuevo (sin nada) y datos antiguos dañados
  const idb3 = new IDBFactory(); let N = abrir(idb3); await N.ready();
  T('dispositivo nuevo: vacío y sin errores ni avisos', N.S().clients.length == 0 && N.errs.length == 0 && !N.d.getElementById('saveerr'));
  N.w.eval("st.routines.push({id:uid('r'),name:'Mi rutina',items:[]});save()"); await N.flush(); N.close();
  let M = abrir(idb3); await M.ready(); T('dispositivo nuevo: lo creado se conserva', M.S().routines.length == 1 && M.S().routines[0].name == 'Mi rutina'); M.close();
  const idb4 = new IDBFactory(); let X = abrir(idb4, { ls: { plan_v1: '{esto no es json' } }); await X.ready();
  T('datos antiguos dañados: no se importan, se avisa y se conservan', X.S().clients.length == 0 && !!X.d.getElementById('saveerr') && X.w.localStorage.getItem('plan_v1') == '{esto no es json' && !X.w.localStorage.getItem('plan_v1_migrado'));
  X.close();

  // 9. Migración del esquema 1 al 2 (versiones por registro para sincronizar): no se pierde nada
  const idb5 = new IDBFactory(); let P = abrir(idb5, { seed: true }); await P.ready();
  await P.w.eval(`(async()=>{const d=Datos._db(),t=d.transaction(['registros','meta'],'readwrite'),R=t.objectStore('registros');
    const todos=await new Promise(ok=>{const q=R.getAll();q.onsuccess=()=>ok(q.result)});
    todos.forEach(r=>{delete r.vv;delete r.pend;R.put(r)});t.objectStore('meta').put(1,'esquema');await new Promise(ok=>{t.oncomplete=ok})})()`);
  const antes9 = JSON.stringify(norm(P.S())); P.close();
  let Q = abrir(idb5); await Q.ready();
  const rq = await Q.Datos.registros(0), dev = Q.Datos.id();
  T('esquema 1 -> 2: los datos son idénticos', JSON.stringify(norm(Q.S())) == antes9 && Q.errs.length == 0);
  T('esquema 1 -> 2: todos los registros reciben versión de este dispositivo y quedan pendientes de subir', rq.length > 0 && rq.every(r => r.vv && r.vv[dev] == 1 && r.pend == 1));
  T('esquema 1 -> 2: el esquema queda anotado', await Q.w.eval(`new Promise(ok=>{const q=Datos._db().transaction('meta').objectStore('meta').get('esquema');q.onsuccess=()=>ok(q.result)})`) == 2);
  T('esquema 1 -> 2: pendientes = registros', Q.Datos.pendientes() == rq.length);
  Q.close();
  let Q2 = abrir(idb5); await Q2.ready();
  T('esquema 2: reabrir no vuelve a migrar ni a escribir', Q2.Datos.pendientes() == rq.length && (await Q2.Datos.registros(0)).every(r => r.vv[dev] == 1));
  Q2.close();

  // 10. Cada cambio local sube la versión del registro y deja lápida con versión al borrar
  const idb6 = new IDBFactory(); let V6 = abrir(idb6, { seed: true }); await V6.ready();
  V6.w.eval("st.clients[0].notes='uno';save()"); await V6.flush();
  const d6 = V6.Datos.id(), r6 = (await V6.Datos.registros(0)).find(r => r.k == 'client/' + V6.S().clients[0].id);
  T('versión: editar suma 1 al contador de este dispositivo', r6.vv[d6] == 2 && r6.pend == 1);
  V6.w.eval("st.clients.splice(2,1);save()"); await V6.flush();
  const lap6 = (await V6.Datos.registros(0)).filter(r => r.deletedAt);
  T('versión: la lápida lleva versión y está pendiente', lap6.length >= 1 && lap6.every(r => r.vv[d6] == 2 && r.pend == 1 && r.data === null));
  V6.close();
  H0.finish();
})().catch(e => { console.log('EXCEPCIÓN:', e.stack); process.exit(1); });
