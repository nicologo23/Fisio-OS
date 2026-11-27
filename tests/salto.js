// Pestaña Salto: cálculo de altura/RSI/índices, marcas fotograma a fotograma, guardar/eliminar, que el vídeo no se guarde,
// persistencia al cerrar y abrir, y que los saltos viajan en su propio tipo de registro («salto»), sin tocar lo demás.
// (jsdom no reproduce vídeo: la lectura exacta de fotogramas se probó aparte con Chrome y un vídeo de 240 fps; ver docs/guia-pruebas-manuales.md)
const { IDBFactory } = require('fake-indexeddb');
const { open } = require('./lib.js');
const stubs = w => { w.URL.createObjectURL = () => 'blob:prueba'; w.URL.revokeObjectURL = () => {}; };
const H = open({ before: stubs });
H.run(async ({ w, d, clk, set, tab, T, errs, S, flush, ready, idb, close }) => {
  const ev = c => w.eval(c), near = (a, b, e = 1e-6) => Math.abs(a - b) < e, J = JSON.stringify;
  const cid = S().clients[0].id, otros0 = J(S().clients.slice(1)), reg0 = J(S().routines);

  // ---- Cálculos ----
  const R = (o) => ev(`sjRes(Object.assign({fps:240,tipo:'CMJ',fd:null,fa:null,fc:null},${J(o)}))`);
  let r = R({ fd: 100, fa: 220 });
  T('altura por tiempo de vuelo: 120 fotogramas a 240 fps = 0,5 s → 30,66 cm (g·t²/8)', r.ok && near(r.t, 0.5) && near(r.h, 100 * 9.81 * 0.25 / 8) && r.fv == 120);
  T('sin marcas o con aterrizaje antes del despegue no hay resultado y se explica por qué', !R({}).ok && /Marca/.test(R({}).msg) && !R({ fd: 50, fa: 50 }).ok && !R({ fd: 50, fa: 40 }).ok && /posterior/.test(R({ fd: 50, fa: 40 }).msg));
  r = R({ tipo: 'Drop jump', fc: 50, fd: 100, fa: 220 });
  T('drop jump: tiempo de contacto 50/240 s y RSI = altura(m) / contacto', r.ok && near(r.tc, 50 / 240) && near(r.rsi, (r.h / 100) / (50 / 240)) && r.fcn == 50);
  T('drop jump sin contacto inicial, o con contacto después del despegue: avisa y no da RSI', R({ tipo: 'Drop jump', fd: 100, fa: 220 }).rsi === undefined && /contacto inicial/.test(R({ tipo: 'Drop jump', fd: 100, fa: 220 }).msg) && R({ tipo: 'Drop jump', fc: 120, fd: 100, fa: 220 }).rsi === undefined);
  T('otra velocidad de grabación (120 fps, mismos fotogramas) da otro tiempo: 1 s y 122,6 cm', near(ev("sjRes({fps:120,tipo:'CMJ',fd:0,fa:120}).t"), 1) && near(ev("sjRes({fps:120,tipo:'CMJ',fd:0,fa:120}).h"), 122.625));

  // Línea de tiempo del vídeo (dt) distinta del tiempo real: se avanza por el vídeo y se calcula con los fps de la cámara
  ev('sj.dur=16;sj.dt=1/60'); T('vídeo ralentizado (un fotograma cada 1/60 s de vídeo, 16 s): 960 fotogramas, y el fotograma n está en (n+0,5)/60 s', ev('sjTot()') == 960 && near(ev('sjT(10)'), 10.5 / 60)); ev('sj.dur=0;sj.dt=0');
  T('sin medir, se supone que el vídeo va a los fps indicados', near(ev('sjDt()'), 1 / 240));
  // Cabecera del archivo: fotogramas y duración del sonido → fps de grabación (clip de 120 fps con la línea de tiempo ralentizada a 30)
  const buf = require('fs').readFileSync(require('path').join(__dirname, 'salto-120fps.mp4')), fake = { size: buf.length, slice: (a, b) => ({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset + a, buf.byteOffset + Math.min(b, buf.length)) }) };
  w.__f = fake; const cab = await w.eval('sjCabecera(__f)');
  T('cabecera del .mp4/.mov: fotogramas del vídeo, duración del sonido y paso de fotograma de la línea de tiempo (1/30 s, uniforme)', cab && cab.n >= 158 && cab.n <= 162 && near(cab.adur, 1.333, 0.05) && near(cab.dt, 1 / 30, 1e-4) && cab.irr === false);
  T('fps de grabación = fotogramas / sonido ≈ 120 (se redondea a la velocidad habitual más cercana)', w.eval(`sjAjusta(${cab.n / cab.adur})`) == 120 && w.eval('sjAjusta(117.5)') == 120 && w.eval('sjAjusta(238)') == 240 && w.eval('sjAjusta(77)') === null);
  T('una cabecera ilegible no rompe nada', (w.__g = { size: 100, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(100) }) }, await w.eval('sjCabecera(__g)')) === null);
  // Al elegir ese archivo la app pone sola los fps de la cámara (120) y la línea de tiempo medida (1/30)
  tab('cli'); clk(`#plist [data-a=selc][data-id=${cid}]`); clk('[data-a=ptab][data-v=sal]');
  w.__f.name = 'clip120.mov'; const f0 = d.getElementById('sjf'); Object.defineProperty(f0, 'files', { value: [w.__f] }); f0.dispatchEvent(new w.Event('change', { bubbles: true })); await ready(300);
  T('al elegir el archivo: fps puestos a 120 por el sonido y paso de fotograma 1/30 s de vídeo', ev('sj.fps') == 120 && d.getElementById('sjfps').value == '120' && near(ev('sj.dt'), 1 / 30, 1e-4) && ev('sj.auto.fps') == 120);
  T('clip con el sonido de la misma duración que el vídeo (como al recortar en Fotos): fps NO se deducen, hay que elegirlos', (() => { w.localStorage.setItem('plan_sjfps', '240'); ev('sj.fps=240'); return true; })());
  for (const [fx, patron, nm] of [['salto-sonido-estirado.mp4', /dura lo mismo/, 'sonido estirado'], ['salto-sin-sonido.mp4', /no trae sonido|No he podido medir/, 'sin sonido']]) {
    const b2 = require('fs').readFileSync(require('path').join(__dirname, fx)); w.__f2 = { name: fx, size: b2.length, slice: (a, z) => ({ arrayBuffer: async () => b2.buffer.slice(b2.byteOffset + a, b2.byteOffset + Math.min(z, b2.length)) }) };
    const e2 = d.getElementById('sjf'); Object.defineProperty(e2, 'files', { value: [w.__f2], configurable: true }); e2.dispatchEvent(new w.Event('change', { bubbles: true })); await ready(300);
    ev('sj.meta=true;sj.dur=1.5;sjDecidir()'); ev('sjInforme()');
    T(nm + ': no se fija ningún fps, queda sin confirmar y el texto pide elegirlo', ev('sj.conf') === false && ev('sj.fps') == 240 && patron.test(d.getElementById('sjest').textContent) && /Elige arriba/.test(d.getElementById('sjinfo').textContent));
  }
  ev('sjSoltar()'); ev("sj.fps=240");
  // ---- Pantalla ----
  tab('cli'); clk(`#plist [data-a=selc][data-id=${cid}]`); clk('[data-a=ptab][data-v=sal]');
  const P = () => d.getElementById('ptabc').textContent;
  T('pestaña Salto: elegir vídeo, parámetros (fps 240 por defecto, tipo, fecha), listas vacías', /Elegir vídeo/.test(P()) && d.getElementById('sjfps').value == '240' && d.getElementById('sjd').value == w.eval('today()') && /Todavía no hay saltos/.test(P()) && !d.getElementById('sjv'));
  T('sin vídeo no se puede marcar y avisa', (clk('[data-a=sjm][data-v=fd]'), ev('sj.fd') == null));

  // Cargar un vídeo (jsdom no lo reproduce: se informa de su duración a mano, 4 s a 240 fps = 960 fotogramas)
  const f = d.getElementById('sjf'); Object.defineProperty(f, 'files', { value: [{ name: 'salto1.mov' }] }); f.dispatchEvent(new w.Event('change', { bubbles: true }));
  T('al elegir el vídeo aparece el reproductor con su nombre y los botones de paso', !!d.getElementById('sjv') && /salto1\.mov/.test(P()) && d.querySelectorAll('[data-a=sjs]').length == 4 && /Quitar vídeo/.test(P()));
  ev('sj.dur=4'); w.sjIr(0);
  T('960 fotogramas (del 0 al 959); el contador empieza en el 0', ev('sjTot()') == 960 && /Fotograma 0/.test(d.getElementById('sjinfo').textContent) && /de 959/.test(d.getElementById('sjinfo').textContent));
  // Sin confirmar los fps (el archivo no los dice) no se enseña ninguna altura
  ev('sj.fd=100;sj.fa=220;sjPintar()');
  T('con vídeo y sin elegir los fotogramas por segundo: pide elegirlos y no enseña altura', /Elige arriba/.test(d.getElementById('sjinfo').textContent) && !/Altura/.test(d.getElementById('sjinfo').textContent) && d.querySelectorAll('[data-a=sjf]').length == 4 && !d.querySelector('[data-a=sjf].on'));
  clk('[data-a=sjsave]'); T('y tampoco deja guardar', !(S().clients[0].saltos || []).length);
  clk('[data-a=sjf][data-v="120"]'); T('botón 120: se marca, se confirma y se recuerda en este dispositivo', ev('sj.fps') == 120 && ev('sj.conf') === true && d.querySelector('[data-a=sjf].on').dataset.v == '120' && w.localStorage.getItem('plan_sjfps') == '120' && /30,7|122,6|Altura/.test(d.getElementById('sjinfo').textContent));
  clk('[data-a=sjf][data-v="240"]'); T('botón 240 y el campo «otro valor» se sincronizan', d.getElementById('sjfps').value == '240' && ev('sj.fps') == 240);
  ev('sj.fd=null;sj.fa=null;sjPintar()');
  clk('[data-a=sjs][data-v="10"]'); clk('[data-a=sjs][data-v="1"]'); clk('[data-a=sjs][data-v="-1"]');
  T('+10, +1 y −1 fotograma → 10; el contador y el deslizador lo reflejan', ev('sj.n') == 10 && /Fotograma 10/.test(d.getElementById('sjinfo').textContent) && d.getElementById('sjr').value == '10');
  clk('[data-a=sjs][data-v="-10"]'); clk('[data-a=sjs][data-v="-10"]');
  T('no baja de 0', ev('sj.n') == 0);
  ev('sjIr(5000)'); T('no pasa del último fotograma (959)', ev('sj.n') == 959);
  set('#sjr', '100'); T('el deslizador lleva al fotograma 100', ev('sj.n') == 100);
  clk('[data-a=sjm][data-v=fd]'); ev('sjIr(220)'); clk('[data-a=sjm][data-v=fa]');
  T('marcas: despegue 100, aterrizaje 220 → resultado en pantalla (0,500 s · 30,7 cm)', ev('sj.fd') == 100 && ev('sj.fa') == 220 && /0,500 s/.test(d.getElementById('sjinfo').textContent) && /30,7 cm/.test(d.getElementById('sjinfo').textContent));
  ev('sj.fd=0;sj.fa=472;sjPintar()'); T('474 cm (472 fotogramas): avisa de que no es creíble', /poco creíble/.test(d.getElementById('sjinfo').textContent) && /474/.test(d.getElementById('sjinfo').textContent)); T('el aviso propone los fps que harían creíble el salto (472 fotogramas → unos 674–1573)', /674–1573 fps/.test(d.getElementById('sjinfo').textContent));
  ev('sj.fps=60;sj.fd=0;sj.fa=50;sjPintar()'); T('50 fotogramas a 60 fps = 85,2 cm: avisa y sugiere 71–167 fps (el 120 entra)', /85,2 cm/.test(d.getElementById('sjinfo').textContent) && /poco creíble/.test(d.getElementById('sjinfo').textContent) && /71–167 fps/.test(d.getElementById('sjinfo').textContent));
  ev('sj.fps=120;sjPintar()'); T('esos mismos 50 fotogramas a 120 fps = 21,3 cm y sin aviso', /21,3 cm/.test(d.getElementById('sjinfo').textContent) && !/poco creíble/.test(d.getElementById('sjinfo').textContent)); ev('sj.fps=240');
  ev('sj.fd=100;sj.fa=220;sjPintar()');
  clk('[data-a=sjg][data-v=fd]'); T('«Ir» vuelve a la marca', ev('sj.n') == 100);
  set('#sjm-fa', '230'); T('la marca también se puede escribir a mano (230 → 0,542 s)', ev('sj.fa') == 230 && /0,542 s/.test(d.getElementById('sjinfo').textContent));
  set('#sjm-fa', '90'); T('aterrizaje antes del despegue: no hay resultado y lo dice', /posterior/.test(d.getElementById('sjinfo').textContent) && !/Altura/.test(d.getElementById('sjinfo').textContent));
  clk('[data-a=sjsave]'); T('no se guarda con marcas incorrectas', !(S().clients[0].saltos || []).length);
  set('#sjm-fa', '220');
  ev('sj.real=99;sjPintar()'); T('si el vídeo no está en el fotograma pedido, avisa de revisar los fotogramas por segundo', /Revisa los fotogramas por segundo/.test(d.getElementById('sjinfo').textContent)); ev('sj.real=sj.n;sjPintar()');
  set('#sjfps', '120'); T('cambiar los fotogramas por segundo recalcula (120 fotogramas a 120 fps = 1,000 s)', /1,000 s/.test(d.getElementById('sjinfo').textContent) && ev('sjTot()') == 480); set('#sjfps', '240');
  set('#sjnote', 'Primer intento'); set('#sjd', '2026-11-20');
  clk('[data-a=sjsave]'); await flush();
  let sa = S().clients[0].saltos;
  T('guardar: un salto con tipo, fecha, fps, marcas, nota y nombre del vídeo; NADA más (ni altura ni vídeo)', sa.length == 1 && sa[0].tipo == 'CMJ' && sa[0].date == '2026-11-20' && sa[0].fps == 240 && sa[0].fd == 100 && sa[0].fa == 220 && sa[0].note == 'Primer intento' && sa[0].video == 'salto1.mov' && J(Object.keys(sa[0]).sort()) == J(['date', 'fa', 'fd', 'fps', 'id', 'note', 'tipo', 'video']));
  T('después de guardar se limpian las marcas pero el vídeo sigue cargado; la lista y las comparativas se actualizan', ev('sj.fd') == null && !!d.getElementById('sjv') && /30,7 cm/.test(d.getElementById('sjlist').textContent) && /CMJ/.test(d.getElementById('sjlist').textContent));

  // Más saltos: SJ y Abalakov el mismo día, y un drop jump
  const mete = (tipo, fd, fa, fc, date) => { set('#sjtipo', tipo); set('#sjd', date || '2026-11-20'); ev(`sj.fd=${fd};sj.fa=${fa};sj.fc=${fc == null ? 'null' : fc};sjPintar()`); clk('[data-a=sjsave]'); };
  mete('SJ', 100, 212); mete('Abalakov', 100, 228); mete('CMJ', 100, 210);
  sa = S().clients[0].saltos;
  const alt = n => 100 * 9.81 * (n / 240) ** 2 / 8, cmj = alt(120), sjj = alt(112), abk = alt(128);
  const tabla = d.getElementById('sjind').textContent;
  T('4 saltos guardados; el peor CMJ del día no cuenta, se usa el mejor de cada tipo', sa.length == 4 && ev('sjSesiones(cc())').length == 1 && near(ev('sjSesiones(cc())[0].best.CMJ'), cmj));
  T('índice elástico = (CMJ − SJ) / SJ × 100', near(ev('sjSesiones(cc())[0].elas'), (cmj - sjj) / sjj * 100, 1e-9) && tabla.includes((Math.round((cmj - sjj) / sjj * 1000) / 10).toLocaleString('es-ES', { minimumFractionDigits: 1 }) + ' %'));
  T('uso de brazos = (Abalakov − CMJ) / CMJ × 100', near(ev('sjSesiones(cc())[0].brazos'), (abk - cmj) / cmj * 100, 1e-9));
  const ci = (T, x) => ev(`sjInterp(${T},${x}).corto`);
  T('interpretación IE: límites 0, 5, 10 y 20 % (el límite inferior entra en su tramo)', ci('SJ_IE', -0.1) == 'Negativo' && ci('SJ_IE', 0) == 'Escaso' && ci('SJ_IE', 4.99) == 'Escaso' && ci('SJ_IE', 5) == 'Moderado' && ci('SJ_IE', 10) == 'Considerable' && ci('SJ_IE', 19.9) == 'Considerable' && ci('SJ_IE', 20) == 'Elevado' && ci('SJ_IE', 80) == 'Elevado');
  T('interpretación IUB: límites 0, 5, 10, 20 y 30 %', ci('SJ_IUB', -3) == 'Negativo' && ci('SJ_IUB', 0) == 'Muy reducida' && ci('SJ_IUB', 5) == 'Reducida' && ci('SJ_IUB', 10) == 'Considerable' && ci('SJ_IUB', 20) == 'Elevada' && ci('SJ_IUB', 29.9) == 'Elevada' && ci('SJ_IUB', 30) == 'Muy elevada');
  T('sin dato no hay interpretación', ev('sjInterp(SJ_IE,null)') === null && ev('sjInterp(SJ_IUB,NaN)') === null);
  const tx = d.getElementById('sjind').textContent;
  T('comparativas: etiqueta corta en la tabla, bloque con el texto y los aspectos a valorar de la última sesión', /Considerable/.test(tx) && /Incremento considerable/.test(tx) && /Beneficio relevante del contramovimiento/.test(tx) && /Contribución considerable/.test(tx) && /Beneficio relevante de la acción de los brazos/.test(tx));
  T('aviso de que los intervalos son orientativos y la lista de todos los rangos está disponible', /orientativos y descriptivos/.test(tx) && /Ver todos los rangos/.test(tx) && /Más de 30 %/.test(tx) && /Menos de 0 %/.test(tx) && /Más de 20 %/.test(tx));
  mete('Drop jump', 100, 220, null); T('drop jump sin contacto inicial no se guarda', S().clients[0].saltos.length == 4);
  mete('Drop jump', 100, 220, 40, '2026-11-22');
  T('drop jump con contacto inicial: se guarda con fc y la lista enseña contacto y RSI', S().clients[0].saltos.length == 5 && /RSI/.test(d.getElementById('sjlist').textContent) && /contacto 0,250 s/.test(d.getElementById('sjlist').textContent));
  T('los saltos se muestran del más reciente al más antiguo', d.querySelector('#sjlist li').textContent.includes('Drop jump'));

  // Eliminar
  w.__ok = false; clk('#sjlist [data-a=sjdel]'); T('eliminar pregunta antes y, si se rechaza, no borra', w.__confirms.length == 1 && S().clients[0].saltos.length == 5);
  w.__ok = true; clk('#sjlist [data-a=sjdel]'); await flush(); T('eliminar confirmado quita el salto', S().clients[0].saltos.length == 4 && !/Drop jump/.test(d.getElementById('sjlist').textContent));

  // Quitar vídeo
  clk('[data-a=sjx]'); T('«Quitar vídeo» libera el vídeo y lo deja todo en marcha', !d.getElementById('sjv') && ev('sj.url') == '' && /Elegir vídeo/.test(P()));
  // Cambiar de paciente: el vídeo y las marcas no pasan de uno a otro
  ev("sj.url='blob:x';sj.fd=5"); tab('cli'); clk(`#plist [data-a=selc][data-id=${S().clients[1].id}]`); clk('[data-a=ptab][data-v=sal]');
  T('al abrir otro paciente se descarta el vídeo y las marcas del anterior; no tiene saltos', ev('sj.url') == '' && ev('sj.fd') == null && /Todavía no hay saltos/.test(P()));
  T('los demás pacientes y las rutinas no cambiaron', J(S().clients.slice(1)) == otros0 && J(S().routines) == reg0);
  T('sin errores de JavaScript', errs.length == 0);

  // ---- Datos: registro propio, cerrar y abrir ----
  await flush();
  const regs = await H.Datos.registros(0), rs = regs.filter(x => x.kind == 'salto');
  T('cada salto es un registro propio de tipo «salto» colgando del paciente (el paciente no lo lleva dentro)', rs.length == 4 && rs.every(x => x.parent == cid) && !('saltos' in regs.find(x => x.kind == 'client' && x.id == cid).data));
  const antes = J(S().clients[0].saltos);
  close();
  const H2 = open({ idb, seed: false, before: stubs }); await H2.ready();
  T('al cerrar y abrir los saltos siguen idénticos y en el mismo orden', J(H2.S().clients[0].saltos) == antes && H2.errs.length == 0);
  // Un salto cuyo paciente ya no existe se conserva (no se borra solo) y no rompe la app
  H2.w.eval("st.clients[0].saltos.push({id:'sj-extra',date:'2026-11-01',tipo:'CMJ',fps:240,fd:1,fa:50});save()"); await H2.flush();
  H2.w.eval("const i=st.clients.findIndex(c=>c.saltos&&c.saltos.some(s=>s.id=='sj-extra'));st.clients.splice(i,1);save()"); await H2.flush();
  const reg2 = await H2.Datos.registros(0);
  T('al borrar un paciente, sus saltos quedan como registros borrados (lápida), no se pierden en silencio', reg2.filter(x => x.kind == 'salto' && x.deletedAt).length >= 5);
  H2.close();
});
