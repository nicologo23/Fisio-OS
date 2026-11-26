// Sincronización: varios "dispositivos" (ventanas jsdom con su propia IndexedDB) contra una nube simulada de Google Drive.
// Usa el proveedor REAL (js/13-drive.js) y el motor real (js/12-sync.js); solo se simulan Google y la red. Datos ficticios.
const { IDBFactory } = require('fake-indexeddb');
const { open } = require('./lib.js');
const canon = o => Array.isArray(o) ? o.map(canon) : (o && typeof o == 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, canon(o[k])])) : o;
const norm = st => JSON.stringify(canon({ clients: st.clients.map(c => Object.assign({ plans: [], weeks: [], cases: [] }, c, { cases: (c.cases || []).map(f => Object.assign({ entries: [] }, f)) })), routines: st.routines, groups: st.groups, custom: st.custom, ov: st.ov, week: st.week }));
const CID = '123-abc.apps.googleusercontent.com';

// ---- Nube simulada: Drive (carpeta oculta) + token de Google ----
function crearNube() {
  const N = { files: new Map(), nid: 1, ver: 1, lecturas: 0, escrituras: 0, sinRed: false, caducado: false, limite: 0, llamadas: [] };
  N.fetch = async (url, op = {}) => {
    N.llamadas.push([op.method || 'GET', url]);
    if (N.sinRed) throw new TypeError('Failed to fetch');
    const h = op.headers || {};
    if (N.caducado || h.Authorization !== 'Bearer TOK') return { ok: false, status: 401, text: async () => 'sin permiso' };
    if (N.limite > 0) { N.limite--; return { ok: false, status: 429, text: async () => 'rateLimitExceeded' }; }
    const u = new URL(url), R = (o, s = 200) => ({ ok: s < 300, status: s, json: async () => o, text: async () => JSON.stringify(o) });
    const meta = f => ({ id: f.id, name: f.name, version: String(f.v), modifiedTime: 'T' + f.v });
    const m = (op.method || 'GET');
    if (u.pathname == '/drive/v3/files' && m == 'GET') {
      if (u.searchParams.get('spaces') != 'appDataFolder') return R({}, 400);
      const q = u.searchParams.get('q') || '', c = q.match(/name contains '([^']+)'/);
      return R({ files: [...N.files.values()].filter(f => !c || f.name.includes(c[1])).map(meta) });
    }
    if (u.pathname == '/upload/drive/v3/files' && m == 'POST') {
      const b = /boundary=(.+)$/.exec(h['Content-Type'])[1], partes = op.body.split('--' + b).filter(p => p.trim() && p.trim() != '--');
      const md = JSON.parse(partes[0].split('\r\n\r\n')[1].trim()), cont = partes[1].split('\r\n\r\n')[1].replace(/\r\n$/, '');
      if (!md.parents || md.parents[0] != 'appDataFolder') return R({}, 400);
      const f = { id: 'f' + N.nid++, name: md.name, body: cont, v: N.ver++ }; N.files.set(f.id, f); N.escrituras++; return R(meta(f));
    }
    const mm = u.pathname.match(/^\/(upload\/)?drive\/v3\/files\/(\w+)$/);
    if (mm) {
      const f = N.files.get(mm[2]); if (!f) return R({}, 404);
      if (m == 'PATCH') { f.body = op.body; f.v = N.ver++; N.escrituras++; return R(meta(f)); }
      if (u.searchParams.get('alt') == 'media') { N.lecturas++; return R(JSON.parse(f.body)); }
    }
    return R({}, 404);
  };
  N.poner = (nombre, doc) => { const f = { id: 'f' + N.nid++, name: nombre, body: JSON.stringify(doc), v: N.ver++ }; N.files.set(f.id, f); return f; };
  N.quitar = id => N.files.delete(id);
  N.instalar = w => {
    w.fetch = N.fetch;
    w.google = { accounts: { oauth2: {
      initTokenClient: c => ({ requestAccessToken: () => setTimeout(() => c.callback({ access_token: 'TOK', expires_in: '3599' }), 5) }),
      hasGrantedAllScopes: () => true, revoke: (t, cb) => cb && cb() } } };
  };
  return N;
}

(async () => {
  const H0 = open({ seed: false, wait: 1 }), { T } = H0;
  const nube = crearNube();
  // Un "dispositivo": ventana con su base de datos; ya conectado a Google (permiso vigente) y con la sincronización activada.
  const disp = (idb, o) => open(Object.assign({ idb, wait: 400, seed: false, before: w => nube.instalar(w),
    ls: { plan_cid: CID, plan_sync_on: '1', plan_tok: JSON.stringify({ t: 'TOK', e: Date.now() + 3600e3 }) } }, o || {}));
  const sync = async D => { await D.w.eval('Sync.ahora()'); await D.flush(); };
  const est = D => D.w.eval('Sync.estado()');
  const pend = D => D.Datos.pendientes();
  const edit = async (D, js) => { D.w.eval(js); await D.flush(); };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const C0 = D => D.S().clients[0];

  // 1. Primer dispositivo (con datos) sube todo
  const idbA = new IDBFactory(); let A = disp(idbA, { seed: true }); await A.ready();
  await sync(A);
  T('A: estado "ok" tras sincronizar', est(A).estado == 'ok' && est(A).ultima > 0);
  T('A: se crea su archivo en la nube', nube.files.size == 1 && [...nube.files.values()][0].name == 'fisio-os--' + A.Datos.id() + '.json');
  const docA = JSON.parse([...nube.files.values()][0].body);
  T('A: el archivo tiene formato, esquema y registros', docA.formato == 'fisio-os-sync' && docA.esquema == 2 && docA.dispositivo == A.Datos.id() && docA.registros.length == A.Datos.aplanar(A.S()).size);
  T('A: el archivo no contiene marcas internas (pend)', docA.registros.every(r => !('pend' in r) && r.vv && r.k));
  T('A: nada pendiente tras subir', pend(A) == 0);
  const esc0 = nube.escrituras; await sync(A);
  T('A: sin cambios no vuelve a subir', nube.escrituras == esc0);

  // 2. Dispositivo nuevo (vacío) recupera todo desde la nube
  const idbB = new IDBFactory(); let B = disp(idbB); await B.ready();
  T('B: al abrir la app se sincroniza sola y recupera los datos (sin tocar nada)', B.S().clients.length == 3 && est(B).estado == 'ok');
  await sync(B);
  T('B: recupera exactamente los datos de A', norm(B.S()) == norm(A.S()) && B.S().clients.length == 3);
  T('B: sin errores de JavaScript', B.errs.length == 0);
  T('B: nada pendiente tras recuperar (salvo lo que sube de su archivo)', pend(B) == 0);
  T('B: tiene su propio archivo', nube.files.size == 2);
  T('B: la pantalla se repintó con los pacientes', (B.tab('hoy'), B.d.body.textContent.length > 0));
  const lec0 = nube.lecturas; await sync(B);
  T('B: no vuelve a descargar un archivo que no ha cambiado', nube.lecturas == lec0);

  // 3. Un cambio en A llega a B (solo ese registro)
  const idCaso = C0(A).cases[0].id;
  await edit(A, "st.clients[0].cases[0].entries.push({id:uid('n'),n:9,date:'2026-11-20',type:'Nota',text:'desde A',pain:'1',meas:[]});save()");
  T('A: 1 cambio pendiente tras editar', pend(A) == 1);
  await sync(A); T('A: 0 pendientes tras subir', pend(A) == 0);
  await sync(B);
  T('B: recibe la anotación de A', C0(B).cases[0].entries.some(e => e.text == 'desde A') && est(B).res.nuevos == 1);
  T('A y B iguales', norm(A.S()) == norm(B.S()));

  // 4. Un borrado en B llega a A (lápida)
  await edit(B, "st.clients[0].cases[0].entries=st.clients[0].cases[0].entries.filter(e=>e.text!='desde A');save()");
  await sync(B); await sync(A);
  T('A: ve el borrado de B', !C0(A).cases[0].entries.some(e => e.text == 'desde A'));
  T('A y B iguales tras el borrado', norm(A.S()) == norm(B.S()));

  // 5. Sin conexión: se sigue trabajando; al volver se envía
  nube.sinRed = true;
  await edit(A, "st.clients[0].notes='nota sin conexión';save()");
  await sync(A);
  T('sin red: estado "sin-conexion"', est(A).estado == 'sin-conexion' && /Sin conexión/.test(est(A).texto));
  T('sin red: el cambio sigue pendiente y en memoria', pend(A) == 1 && C0(A).notes == 'nota sin conexión');
  await edit(A, "st.clients[0].notes='nota sin conexión 2';save()");
  A.close();
  let A2 = disp(idbA); await A2.ready();   // se cierra y se reabre la app todavía sin red
  T('sin red: tras reabrir, la nota y lo pendiente se conservan', C0(A2).notes == 'nota sin conexión 2' && pend(A2) == 1);
  A = A2;
  nube.sinRed = false; await sync(A);
  T('red vuelve: estado ok y 0 pendientes', est(A).estado == 'ok' && pend(A) == 0);
  await sync(B);
  T('red vuelve: B recibe la nota', C0(B).notes == 'nota sin conexión 2');

  // 6. Permiso caducado: la app sigue funcionando en local y se avisa; reconectar lo arregla
  nube.caducado = true;
  await edit(A, "st.clients[0].notes='con permiso caducado';save()");
  await sync(A);
  T('permiso caducado: estado "sin-permiso"', est(A).estado == 'sin-permiso' && !A.w.localStorage.getItem('plan_tok'));
  { const ii = A.w.eval('Sync.indicador()'); T('indicador: permiso caducado → ✗ roja y pide atención', ii.k == 'err' && ii.aten && /reconectar/i.test(ii.texto)); }
  T('permiso caducado: la app sigue guardando en local', pend(A) == 1 && C0(A).notes == 'con permiso caducado');
  A.tab('hoy');
  T('permiso caducado: ya no hay tarjeta de aviso en la pantalla', !A.d.getElementById('syncb') && !A.d.querySelector('#app [data-a=syconn]'));
  T('permiso caducado: globito rojo en «Más» y en Ajustes', A.d.querySelector('#tabbar [data-a=mas]').classList.contains('av') && A.d.querySelector('#nav .nv-foot button[data-k=dat]').classList.contains('av'));
  A.tab('dat');
  T('permiso caducado: la pantalla Datos lo explica y muestra pendientes', /Falta el permiso/.test(A.d.getElementById('sy-est').textContent) && /1 cambio sin enviar/.test(A.d.getElementById('sy-pend').textContent));
  nube.caducado = false;
  A.clk('[data-a=syconn]'); await pausa(120); await A.flush();
  { const ii = A.w.eval('Sync.indicador()'); T('indicador: sincronizado → ✓ verde', ii.k == 'ok' && ii.texto == 'Sincronizado' && !ii.aten); }
  T('reconectar: vuelve a sincronizar y envía lo pendiente', est(A).estado == 'ok' && pend(A) == 0);
  await sync(B); T('reconectar: B recibe el cambio', C0(B).notes == 'con permiso caducado');

  // 7. Conflicto real: se edita lo mismo en A y en B sin sincronizar entre medias
  await edit(A, "st.clients[0].notes='versión de A';save()");
  await pausa(8);
  await edit(B, "st.clients[0].notes='versión de B';save()");
  await sync(B);   // B sube primero
  await sync(A);   // A descarga: su versión (más antigua) pierde, pero se guarda
  const cfA = A.S().conflicts;
  T('conflicto: A conserva la versión más reciente (B)', C0(A).notes == 'versión de B');
  T('conflicto: la versión perdedora queda guardada', cfA.length == 1 && cfA[0].kind == 'client' && cfA[0].data.notes == 'versión de A');
  T('conflicto: se avisa en pantalla', est(A).res.conflictos == 1 && (A.tab('hoy'), A.d.querySelector('#tabbar [data-a=mas]').classList.contains('av') && /conflicto/.test(A.w.eval('Sync.indicador().texto'))));
  await sync(A); await sync(B);
  T('conflicto: B llega al mismo estado y ve el mismo conflicto', norm(A.S()) == norm(B.S()) && B.S().conflicts.length == 1 && B.S().conflicts[0].id == cfA[0].id);
  const e1 = nube.escrituras; await sync(A); await sync(B); await sync(A);
  T('conflicto: no se queda discutiendo (sin más escrituras)', nube.escrituras == e1 && pend(A) == 0 && pend(B) == 0);

  // 8. Usar la versión guardada intercambia las dos (no se pierde ninguna) y se sincroniza
  A.tab('dat');
  T('conflicto: la pantalla Datos lo lista', /Conflictos por revisar \(1\)/.test(A.d.body.textContent) && /versión de A/.test(A.d.body.textContent));
  A.clk('[data-a=sycuse]'); await A.flush();
  T('usar versión: A vuelve a "versión de A" y guarda la otra', C0(A).notes == 'versión de A' && A.S().conflicts[0].data.notes == 'versión de B');
  await sync(A); await sync(B);
  T('usar versión: B recibe el cambio', C0(B).notes == 'versión de A' && B.S().conflicts[0].data.notes == 'versión de B');
  A.tab('dat'); A.clk('[data-a=sycdel]');
  T('descartar: pide confirmación', A.S().conflicts.length == 1 && /Confirmar/.test(A.d.body.textContent));
  A.clk('[data-a=sycdel]'); await A.flush();
  T('descartar: se quita', A.S().conflicts.length == 0);
  await sync(A); await sync(B);
  T('descartar: se quita también en B', B.S().conflicts.length == 0 && norm(A.S()) == norm(B.S()));

  // 9. Los dos dispositivos resuelven por su cuenta el mismo conflicto y llegan exactamente al mismo resultado
  await edit(A, "st.clients[1].notes='A decide';save()"); await pausa(8);
  await edit(B, "st.clients[1].notes='B decide';save()");
  const rA = JSON.parse(JSON.stringify(A.Datos.exportar())), rB = JSON.parse(JSON.stringify(B.Datos.exportar()));
  A.w.eval('Datos.fusionar(st,' + JSON.stringify(rB) + ')'); B.w.eval('Datos.fusionar(st,' + JSON.stringify(rA) + ')');
  await A.flush(); await B.flush();
  const kc = D => D.Datos.exportar().find(r => r.k == 'client/' + D.S().clients[1].id);
  T('resolución independiente: mismo texto ganador', C1txt(A) == 'B decide' && C1txt(B) == 'B decide');
  function C1txt(D) { return D.S().clients[1].notes; }
  T('resolución independiente: misma versión y mismo conflicto en los dos', JSON.stringify(canon(kc(A).vv)) == JSON.stringify(canon(kc(B).vv)) && A.S().conflicts.length == 1 && B.S().conflicts.length == 1 && A.S().conflicts[0].id == B.S().conflicts[0].id);
  await sync(A); await sync(B); await sync(A);
  T('resolución independiente: convergen sin más conflictos', norm(A.S()) == norm(B.S()) && A.S().conflicts.length == 1 && B.S().conflicts.length == 1 && pend(A) == 0 && pend(B) == 0);

  // 10. Editado en un sitio y borrado en otro: se conserva lo editado
  await edit(A, "st.clients[0].cases[0].entries.push({id:'nBorra',n:5,date:'2026-11-21',type:'Nota',text:'original',pain:'0',meas:[]});save()");
  await sync(A); await sync(B);
  await edit(A, "st.clients[0].cases[0].entries.find(e=>e.id=='nBorra').text='editada en A';save()"); await pausa(8);
  await edit(B, "{const f=st.clients[0].cases[0];f.entries=f.entries.filter(e=>e.id!='nBorra')};save()");
  await sync(B); await sync(A); await sync(B);
  T('editar vs borrar: la anotación sobrevive con la edición', C0(A).cases[0].entries.some(e => e.id == 'nBorra' && e.text == 'editada en A') && C0(B).cases[0].entries.some(e => e.id == 'nBorra' && e.text == 'editada en A'));

  // 11. Reloj atrasado en un dispositivo: lo que edita sigue contando como "más nuevo" que lo que ya vio
  await sync(A); await sync(B);
  const visto = B.Datos.exportar().reduce((m, r) => Math.max(m, r.updatedAt), 0);
  B.w.Date.now = () => 1000;
  await edit(B, "st.clients[2].notes='reloj atrasado';save()");
  const rr = B.Datos.exportar().find(r => r.k == 'client/' + B.S().clients[2].id);
  T('reloj atrasado: la edición sigue siendo posterior a lo ya visto', rr.updatedAt > visto);
  B.w.Date.now = () => Date.now();
  await sync(B); await sync(A);
  T('reloj atrasado: A recibe el cambio', A.S().clients[2].notes == 'reloj atrasado');

  // 12. Dispositivo nuevo con la base de datos vacía (p. ej. app reinstalada): restaura TODO desde la nube
  const idbC = new IDBFactory(); let Cd = disp(idbC); await Cd.ready();
  await sync(Cd);
  T('restaurar: dispositivo nuevo recupera todo (incl. lo de A y B)', norm(Cd.S()) == norm(A.S()) && Cd.S().conflicts.length == A.S().conflicts.length && Cd.errs.length == 0);
  T('restaurar: lo restaurado se guarda en el dispositivo (sobrevive a cerrar y abrir)', (Cd.close(), true));
  Cd = disp(idbC); await Cd.ready();
  T('restaurar: tras reabrir sin red los datos siguen', (nube.sinRed = true, norm(Cd.S()) == norm(A.S())));
  nube.sinRed = false; Cd.close();

  // 13. Archivos extraños en la nube no estropean nada
  const antes = norm(A.S());
  const mal = nube.poner('fisio-os--zzz.json', { formato: 'otra-cosa' });
  await sync(A);
  T('archivo con otro formato: error claro y datos intactos', est(A).estado == 'error' && /formato/.test(est(A).texto) && norm(A.S()) == antes);
  nube.quitar(mal.id);
  const nueva = nube.poner('fisio-os--yyy.json', { formato: 'fisio-os-sync', esquema: 99, dispositivo: 'yyy', generado: '', registros: [] });
  await sync(A);
  T('archivo de una versión más nueva: se avisa y no se toca nada', est(A).estado == 'error' && /más nueva/.test(est(A).texto) && norm(A.S()) == antes);
  nube.quitar(nueva.id);
  const roto = nube.poner('fisio-os--xxx.json', { formato: 'fisio-os-sync', esquema: 2, dispositivo: 'xxx', generado: '', registros: [
    null, { k: 'client/mal', kind: 'client', id: 'otro' }, { k: 'client/sinversion', kind: 'client', id: 'sinversion', updatedAt: 1, data: { id: 'sinversion', name: 'x' } },
    { k: 'client/bueno', kind: 'client', id: 'bueno', parent: null, ord: 9, data: { id: 'bueno', name: 'Deportista nuevo', notes: '' }, updatedAt: Date.now(), deletedAt: null, vv: { xxx: 1 } }] });
  await sync(A);
  T('registros inválidos: se ignoran los malos y se aplica el bueno', est(A).estado == 'ok' && est(A).res.ignorados == 3 && A.S().clients.some(c => c.id == 'bueno'));
  nube.quitar(roto.id);

  // 14. Google limita (429): se reintenta y acaba bien
  A.w.eval('Drive.espera=1'); nube.limite = 2;
  await edit(A, "st.clients[0].notes='tras límite';save()"); await sync(A);
  T('límite de Google: reintenta y sincroniza', est(A).estado == 'ok' && pend(A) == 0);

  // 15. Desconectar: la app sigue con sus datos y deja de sincronizar
  A.tab('dat'); A.clk('[data-a=sydis]');
  T('desconectar: se desactiva, sin permiso guardado y con los datos intactos', !A.w.localStorage.getItem('plan_sync_on') && !A.w.localStorage.getItem('plan_tok') && est(A).estado == 'apagado' && A.S().clients.length >= 3);
  const ll = nube.llamadas.length; await edit(A, "st.clients[0].notes='sin nube';save()"); await sync(A);
  T('desconectado: no llama a Google', nube.llamadas.length == ll && C0(A).notes == 'sin nube');
  { const ii = A.w.eval('Sync.indicador()'); T('indicador: desconectado → neutro «Sin sincronizar»', ii.k == 'off' && !ii.aten); }
  T('desconectado: sin globito rojo', !A.d.querySelector('#tabbar [data-a=mas]').classList.contains('av'));

  // 16. Pantalla Datos sin configurar: pide el ID y lo valida; ningún token ni ID viaja en el código
  const idbD = new IDBFactory(); let Dv = open({ idb: idbD, wait: 300, seed: false, before: w => nube.instalar(w) }); await Dv.ready();
  Dv.tab('dat');
  T('sin configurar: la tarjeta pide el ID de cliente', /Sincronización entre dispositivos/.test(Dv.d.body.textContent) && !!Dv.d.getElementById('sycid') && !Dv.d.querySelector('#tabbar [data-a=mas]').classList.contains('av'));
  Dv.set('#sycid', 'esto no vale'); Dv.clk('[data-a=sycid]');
  T('ID mal formado: se rechaza', !Dv.w.localStorage.getItem('plan_cid'));
  Dv.set('#sycid', CID); Dv.clk('[data-a=sycid]');
  T('ID válido: se guarda en este dispositivo', Dv.w.localStorage.getItem('plan_cid') == CID && !!Dv.d.querySelector('[data-a=syconn]'));
  Dv.clk('[data-a=syconn]'); await pausa(120); await Dv.flush();
  T('conectar con Google: queda activada y sincronizada', Dv.w.localStorage.getItem('plan_sync_on') == '1' && est(Dv).estado == 'ok' && nube.files.size >= 2);
  T('el permiso pedido es solo la carpeta oculta', Dv.w.eval('Drive').conectado() && require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '13-drive.js'), 'utf8').match(/https:\/\/www\.googleapis\.com\/auth\/[\w.]+/g).every(s => s.endsWith('/drive.appdata')));
  T('ningún dispositivo dio error de JavaScript', [A, B, Dv].every(D => D.errs.length == 0));
  const src = ['js/12-sync.js', 'js/13-drive.js', 'index.html'].map(f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')).join('\n');
  T('el código no incluye ID de cliente ni claves', !/\d{6,}-[\w]+\.apps\.googleusercontent\.com/.test(src) && !/AIza|GOCSPX|ya29\./.test(src));

  // 17. Simulación al azar: 3 dispositivos hacen cambios y sincronizan en desorden; al final todos tienen lo mismo
  let semilla = +process.env.SEMILLA || 12345; const rnd = n => { semilla = (semilla * 1103515245 + 12345) & 0x7fffffff; return semilla % n; };
  nube.sinRed = false;
  const idbX = new IDBFactory(), idbY = new IDBFactory(), idbZ = new IDBFactory();
  const X = disp(idbX), Y = disp(idbY), Z = disp(idbZ); await Promise.all([X.ready(), Y.ready(), Z.ready()]);
  await edit(X, "st.clients.push({id:'cx1',name:'Ficticio 1',notes:'',plans:[],weeks:[],cases:[{id:'fx1',name:'Lesión 1',status:'Activa',zones:[],entries:[]}]},{id:'cx2',name:'Ficticio 2',notes:'',plans:[],weeks:[],cases:[]});save()");
  await sync(X); await sync(Y); await sync(Z);
  const D3 = [X, Y, Z]; const conf0 = X.S().conflicts.length;
  for (let i = 0; i < 45; i++) {
    const D = D3[rnd(3)], op = rnd(6);
    if (op == 0) await edit(D, "st.clients[0].notes='n" + i + "';save()");
    else if (op == 1) await edit(D, "st.clients[1].notes='m" + i + "';save()");
    else if (op == 2) await edit(D, "st.clients[0].cases[0].entries.push({id:uid('n'),n:" + i + ",date:'2026-11-2" + (i % 9) + "',type:'Nota',text:'t" + i + "',pain:'1',meas:[]});save()");
    else if (op == 3) await edit(D, "{const e=st.clients[0].cases[0].entries;if(e.length)e[0].text='ed" + i + "'};save()");
    else if (op == 4) await edit(D, "{const e=st.clients[0].cases[0].entries;if(e.length)e.splice(e.length-1,1)};save()");
    else await sync(D);
    if (rnd(4) == 0) await pausa(2);
  }
  for (let r = 0; r < 3; r++) for (const D of D3) await sync(D);
  const e2 = nube.escrituras; for (const D of D3) await sync(D);
  T('azar: los 3 dispositivos acaban con los mismos datos', norm(X.S()) == norm(Y.S()) && norm(Y.S()) == norm(Z.S()));
  T('azar: los mismos conflictos', JSON.stringify(X.S().conflicts.map(c => c.id).sort()) == JSON.stringify(Y.S().conflicts.map(c => c.id).sort()) && JSON.stringify(Y.S().conflicts.map(c => c.id).sort()) == JSON.stringify(Z.S().conflicts.map(c => c.id).sort()));
  T('azar: nada pendiente y la nube está estable', D3.every(D => pend(D) == 0) && nube.escrituras == e2);
  T('azar: sin errores', D3.every(D => D.errs.length == 0));
  console.log('  (azar: ' + X.S().clients[0].cases[0].entries.length + ' anotaciones, ' + (X.S().conflicts.length - conf0) + ' conflictos nuevos conservados, ' + conf0 + ' de antes)');
  // Restaurar desde cero reproduce lo mismo
  const idbW = new IDBFactory(); const W = disp(idbW); await W.ready(); await sync(W);
  T('azar: un dispositivo nuevo restaura el mismo estado final', norm(W.S()) == norm(X.S()) && W.S().conflicts.length == X.S().conflicts.length);


  // 18. Importar una copia sustituye todo y esa sustitución llega a los demás dispositivos (decisión del usuario); exportar incluye todo
  const nube2 = crearNube(); const disp2 = (idb, o) => open(Object.assign({ idb, wait: 400, seed: false, before: w => nube2.instalar(w),
    ls: { plan_cid: CID, plan_sync_on: '1', plan_tok: JSON.stringify({ t: 'TOK', e: Date.now() + 3600e3 }) } }, o || {}));
  const P = disp2(new IDBFactory(), { seed: true }); await P.ready(); await sync(P);
  const Q = disp2(new IDBFactory()); await Q.ready(); await sync(Q);
  T('importar+sync: partimos de dos dispositivos iguales', norm(P.S()) == norm(Q.S()) && P.S().clients.length == 3);
  P.tab('dat'); P.clk('[data-a=exp]'); const copia = P.d.querySelector('#bk').value;
  await edit(P, "st.clients.splice(0,1);st.clients.push({id:'nuevoP',name:'Añadido después',notes:'',plans:[],weeks:[],cases:[]});save()");
  await sync(P); await sync(Q);
  T('importar+sync: el cambio posterior llega a Q', Q.S().clients.length == 3 && Q.S().clients.some(c => c.id == 'nuevoP'));
  P.set('#bk', copia); P.clk('[data-a=imp]'); await P.flush();
  T('importar+sync: P vuelve exactamente a la copia', norm(P.S()) == norm(JSON.parse(copia)));
  await sync(P); await sync(Q);
  T('importar+sync: Q recibe la sustitución completa (vuelve el borrado y se va lo añadido)', norm(Q.S()) == norm(P.S()) && !Q.S().clients.some(c => c.id == 'nuevoP') && Q.S().clients.length == 3 && Q.S().conflicts.length == 0);
  T('importar+sync: sin errores', P.errs.length == 0 && Q.errs.length == 0);
  // Tiempo "real": un cambio en P llega a Q solo con abrir/volver a primer plano (sin pulsar nada)
  await edit(P, "st.clients[0].notes='sin pulsar nada';save()"); await pausa(2900); await P.flush();
  T('envío automático: a los pocos segundos P queda "Todo enviado" sin pulsar nada', pend(P) == 0 && C0(P).notes == 'sin pulsar nada');
  Q.d.dispatchEvent(new Q.w.Event('visibilitychange')); await pausa(900); await Q.flush();
  T('al volver a primer plano Q se actualiza solo', C0(Q).notes == 'sin pulsar nada');
  // Edición de rutinas y planes semanales ya asignados: el cambio viaja a los demás dispositivos (el id se conserva)
  {
    const cid = C0(P).id, pid = C0(P).plans[0].id, wid = C0(P).weeks[0].id, off = D => D.d.querySelector('[data-a=aecancel]');
    P.tab('cli'); P.clk(`#plist [data-a=selc][data-id=${cid}]`); P.clk('[data-a=ptab][data-v=ej]');
    P.clk(`#pp-${pid} [data-a=aeedit][data-k=p]`); P.set('#aen', 'Rutina ajustada en P'); P.set('.aed [data-ef=load][data-i="0"]', '99 kg'); P.clk('[data-a=aesave]');
    P.clk(`#pw-${wid} [data-a=aeedit][data-k=w]`); P.set('#aef', '2026-12-28'); P.clk('[data-a=aesave]');
    T('editar: el plan asignado y el plan semanal quedan con los cambios en P y con su mismo id', C0(P).plans[0].id == pid && C0(P).plans[0].name == 'Rutina ajustada en P' && C0(P).weeks[0].id == wid && C0(P).weeks[0].start == '2026-12-28');
    await P.flush(); T('editar: 2 registros pendientes (el plan y el plan semanal, nada más)', pend(P) == 2);
    await sync(P); await sync(Q);
    T('editar: Q recibe la rutina editada y el nuevo inicio del plan semanal, con los mismos ids', C0(Q).plans[0].id == pid && C0(Q).plans[0].name == 'Rutina ajustada en P' && C0(Q).plans[0].items[0].load == '99 kg' && C0(Q).weeks[0].id == wid && C0(Q).weeks[0].start == '2026-12-28');
    T('editar: P y Q quedan iguales y sin conflictos nuevos', norm(P.S()) == norm(Q.S()));
    // Cambios simultáneos en el mismo plan desde dos dispositivos: se conserva uno y el otro queda como conflicto (nunca se pierde)
    const c0 = Q.S().conflicts ? Q.S().conflicts.length : 0;
    Q.tab('cli'); Q.clk(`#plist [data-a=selc][data-id=${cid}]`); Q.clk('[data-a=ptab][data-v=ej]');
    P.clk(`#pp-${pid} [data-a=aeedit][data-k=p]`); P.set('#aen', 'Versión de P'); P.clk('[data-a=aesave]');
    Q.clk(`#pp-${pid} [data-a=aeedit][data-k=p]`); Q.set('#aen', 'Versión de Q'); Q.clk('[data-a=aesave]');
    await P.flush(); await Q.flush(); await sync(P); await sync(Q); await sync(P);
    T('edición simultánea del mismo plan: los dos dispositivos terminan con el mismo resultado', C0(P).plans[0].name == C0(Q).plans[0].name && /^Versión de [PQ]$/.test(C0(P).plans[0].name));
    T('edición simultánea: la versión perdedora se guarda como conflicto restaurable', (P.S().conflicts || []).length > c0 || (Q.S().conflicts || []).length > c0);
    T('editar y sincronizar: sin errores de JavaScript', P.errs.length == 0 && Q.errs.length == 0);
  }
  [P, Q].forEach(D => D.close());
  [A, B, Dv, X, Y, Z, W].forEach(D => D.close());
  H0.finish();
})().catch(e => { console.log('EXCEPCIÓN:', e.stack); process.exit(1); });
