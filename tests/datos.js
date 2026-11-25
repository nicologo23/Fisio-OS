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
  H0.finish();
})().catch(e => { console.log('EXCEPCIÓN:', e.stack); process.exit(1); });
