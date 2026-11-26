// Progreso del paciente: variables (EVA, mediciones, cargas registradas), lesión de referencia, registros por día de los planes semanales,
// varios registros el mismo día, unidades y leyendas en los ejes, gráfico de líneas/barras y selección de X/Y.
const { open } = require('./lib.js');
const H = open();
H.run(async ({ w, d, clk, set, tab, app, T, errs, S }) => {
  const ev = code => w.eval(code);
  const dia = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const ids = ev('all().slice(0,3).map(e=>e.id)'), nom = ids.map(i => ev(`byId(${JSON.stringify(i)}).n`));
  const it = (e, load) => ({ e, sets: 3, reps: '8', hold: 30, rest: 90, load, note: '' });
  const me = (n, date, pain, fz, rom, mus = 'Cuádriceps') => ({ id: 'pm' + n, n, date, type: 'Evaluación', text: '', pain: String(pain), meas: [{ k: 'Fuerza', l: mus, s: 'Der', v: String(fz), u: 'kg' }, { k: 'Rango de movimiento', l: 'Flexión de rodilla', s: 'Der', v: String(rom), u: '°' }] });
  const caso = (id, name, status, opened, entries, closed) => Object.assign({ id, name, status, opened, dx: '', type: '', act: '', contact: '', moment: '', zones: [], entries }, closed ? { closed } : {});
  const dias = (n, plan) => ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((x, i) => plan[i] ? { day: x, name: n, items: plan[i] } : { day: x, name: '', items: [] });
  const sq = ids[0];
  ev(`(()=>{const k=st.clients;
    k.push({id:'kp',name:'Prueba Progreso',notes:'',cases:[${JSON.stringify(caso('cp1', 'Tendinopatía', 'Activa', dia(40), [me(1, dia(30), 7, 18, 95), me(2, dia(20), 5, 26, 110), me(3, dia(20), 4, 28, 112), me(4, dia(5), 3, 34, 125)]))},
        ${JSON.stringify(caso('cp2', 'Lumbar', 'Alta', dia(100), [me(5, dia(95), 6, 40, 70, 'Isquios'), me(6, dia(80), 3, 48, 85, 'Isquios'), me(7, dia(90), 5, 22, 100)], dia(70)))}],
      plans:[{id:'pp1',date:'${dia(4)}',name:'Fase II',note:'',items:[${JSON.stringify(it(sq, '50 kg'))},${JSON.stringify(it(ids[1], '12,5 kg'))},${JSON.stringify(it(ids[2], 'RPE 7'))},${JSON.stringify(it(sq, '70 % RM'))},${JSON.stringify(it(ids[1], '2 × 15 kg'))}]},
             {id:'pp2',date:'${dia(25)}',name:'Fase I',note:'',items:[${JSON.stringify(it(sq, '40 kg'))},${JSON.stringify(it(ids[1], 'goma roja'))},${JSON.stringify(it(ids[2], '6'))}]},
             {id:'pp3',date:'${dia(20)}',name:'Una sola carga',note:'',items:[${JSON.stringify(it(ids[2], '60 kg'))}]}],
      weeks:[{id:'pw1',date:'2026-12-30',start:'2026-12-28',name:'Semana fin de año',note:'',days:${JSON.stringify(dias('Fuerza', { 0: [it(sq, '30 kg')], 2: [it(sq, '35 kg')], 4: [it(sq, '40 kg')] }))}},
             {id:'pw2',date:'2026-11-04',name:'Semana antigua',note:'',days:${JSON.stringify(dias('Antigua', { 0: [it(sq, '22 kg')] }))}},
             {id:'pw3',date:'2027-01-04',start:'2027-01-04',name:'Dos veces el mismo día',note:'',days:${JSON.stringify(dias('Doble', { 0: [it(sq, '50 kg'), it(sq, '55 kg')] }))}}]},
     {id:'kv',name:'Sin datos',notes:'',plans:[],weeks:[],cases:[]});
    save();render()})()`);
  const antes = JSON.stringify(S().clients);
  tab('cli'); clk('#plist [data-a=selc][data-id=kp]'); clk('[data-a=ptab][data-v=pro]');
  const V = les => ev(`prVars(cc(),${JSON.stringify(les || '')})`), por = (L, id) => L.find(z => z.id == id);
  const FZ = 'm:Fuerza|Cuádriceps|Der|kg', RM = 'm:Rango de movimiento|Flexión de rodilla|Der|°';
  const KG = 'c:' + sq + '|kg';

  // ---- Variables y tipos ----
  const A = V('');
  T('tipos: dolor EVA, fuerza, ROM, carga, intensidad (% RM) y RPE', por(A, 'eva').t == 'eva' && por(A, FZ).t == 'fuerza' && por(A, RM).t == 'rom' && por(A, KG).t == 'carga' && por(A, 'c:' + sq + '|% RM').t == 'inten' && por(A, 'c:' + ids[2] + '|RPE').t == 'rpe');
  T('el mismo ejercicio con otra unidad es otra serie: kg y % RM del ejercicio 1 no se mezclan', por(A, KG).p.every(q => !/%/.test(q.raw)) && JSON.stringify(por(A, 'c:' + sq + '|% RM').p.map(q => q.v)) == '[70]');
  T('«12,5 kg» se lee como 12,5; «2 × 15 kg» y «goma roja» no se interpretan', JSON.stringify(por(A, 'c:' + ids[1] + '|kg').p.map(q => q.v)) == '[12.5]' && !por(A, 'c:' + ids[1] + '|sin'));
  T('las cargas no interpretadas se avisan (con el texto original) y no se dibujan como 0', A.exc.length == 2 && A.exc.some(x => x.raw == '2 × 15 kg') && A.exc.some(x => x.raw == 'goma roja') && A.every(z => z.p.every(q => q.v > 0)));
  T('un número sin unidad es su propia serie «sin unidad» (nunca se le pone kg)', por(A, 'c:' + ids[2] + '|sin').p.length == 1 && por(A, 'c:' + ids[2] + '|sin').u == '' && por(A, 'c:' + ids[2] + '|sin').p[0].v == 6);

  // ---- Planes semanales: cada día genera sus registros ----
  const k1 = por(A, KG).p;
  const sem = k1.filter(q => /fin de año/.test(q.src));
  T('plan semanal: lunes 30 kg, miércoles 35 kg y viernes 40 kg dan tres registros en sus fechas (no solo el máximo)', JSON.stringify(sem.map(q => [q.d, q.v])) == '[["2026-12-28",30],["2026-12-30",35],["2027-01-01",40]]');
  T('semana que cambia de mes y de año: el viernes es el 1 de enero de 2027', ev('wkDia({start:"2026-12-28"},4)') == '2027-01-01' && ev('wkDia({start:"2026-12-28"},3)') == '2026-12-31');
  T('año bisiesto: lunes 28 feb 2028 → el miércoles es 1 de marzo', ev('wkDia({start:"2028-02-28"},1)') == '2028-02-29' && ev('wkDia({start:"2028-02-28"},2)') == '2028-03-01');
  T('plan antiguo sin fecha de inicio: se deduce el lunes de la semana de la asignación (miércoles 4 nov → lunes 2 nov) y se marca como deducida', ev('wkInicio({date:"2026-11-04"}).iso') == '2026-11-02' && ev('wkInicio({date:"2026-11-04"}).ded') === true && ev('wkInicio({date:"2026-11-04",start:"2026-11-09"}).ded') === false);
  const ant = k1.filter(q => /antigua/.test(q.src));
  T('el plan antiguo da un único registro (lunes 2 nov), marcado como deducido, y no se repite en semanas posteriores', ant.length == 1 && ant[0].d == '2026-11-02' && ant[0].ded === true);
  T('los registros salen en orden cronológico', k1.every((q, i) => !i || k1[i - 1].d <= q.d));
  T('varios registros del mismo día se conservan (lunes 4 ene 2027: 50 y 55 kg)', JSON.stringify(k1.filter(q => q.d == '2027-01-04').map(q => q.v)) == '[50,55]');
  T('los días de descanso del plan semanal no generan registros', k1.filter(q => /fin de año/.test(q.src)).length == 3);
  T('lesión actual: dos anotaciones el mismo día (dolor) se conservan', por(A, 'eva').p.filter(q => q.d == dia(20)).length == 2);

  // ---- Controles ----
  const op = id => [...d.getElementById(id).options].map(o => o.value), tx = id => [...d.getElementById(id).options].map(o => o.textContent);
  T('hay desplegable «Lesión de referencia», empieza en «Todas las lesiones»', !!d.getElementById('prles') && /Lesión de referencia/.test(d.getElementById('prg').textContent) && d.getElementById('prles').value == '' && /Todas las lesiones/.test(tx('prles')[0]));
  T('lesiones separadas en activas y dadas de alta, con fecha de inicio', d.querySelectorAll('#prles optgroup').length == 2 && /activas/.test(d.querySelectorAll('#prles optgroup')[0].label) && /dadas de alta/.test(d.querySelectorAll('#prles optgroup')[1].label) && tx('prles').some(t => /^● Tendinopatía · inicio \d+ \w+ \d{4}$/.test(t)) && tx('prles').some(t => /^✓ Lumbar · inicio .* → alta/.test(t)));
  T('ya no existe la segunda variable', !d.getElementById('pry2') && !/Segunda variable/.test(d.getElementById('prg').textContent));
  T('desplegables de Y y X con sus tipos, detalle y tipo de gráfico', !!d.getElementById('pry') && !!d.getElementById('pryd') && !!d.getElementById('prx') && d.querySelectorAll('.prtype button').length == 2);
  T('valores iniciales: Y = Dolor (EVA), X = Fecha, líneas con puntos', d.getElementById('pry').value == 'eva' && d.getElementById('pryd').value == 'eva' && d.getElementById('prx').value == 'fecha' && d.querySelector('.prtype .on').dataset.v == 'lin');
  T('tipos disponibles en Y: EVA, Fuerza, ROM, Carga, Intensidad y RPE', JSON.stringify(op('pry')) == '["eva","fuerza","rom","carga","inten","rpe"]');
  T('el eje X ofrece Fecha, días desde el inicio de la lesión y los mismos tipos', JSON.stringify(op('prx')) == '["fecha","dias","eva","fuerza","rom","carga","inten","rpe"]');

  // ---- Todas las lesiones: el dolor de lesiones distintas no se mezcla en una misma serie ----
  const svg = () => d.querySelector('.prsvg');
  T('Todas las lesiones: el dolor se dibuja en series distintas (una por lesión; la actual con «registro 1/2» por el día repetido)', svg().querySelectorAll('.prm').length == 7 && svg().querySelectorAll('polyline').length == 2 && d.querySelectorAll('.prleg .prlg').length == 3 && /Tendinopatía .* · registro 1/.test(d.querySelector('.prleg').textContent) && /Lumbar/.test(d.querySelector('.prleg').textContent));
  T('los marcadores se distinguen por forma además de por color', svg().querySelectorAll('circle.prm').length > 0 && svg().querySelectorAll('rect.prm,path.prm').length > 0);
  T('con el dolor en pantalla no se habla de cargas sin interpretar (solo aparece con variables de carga)', !d.querySelector('.prexc'));
  T('eje vertical de dolor fijo de 0 a 10', /<text[^>]*>10<\/text>/.test(svg().innerHTML) && /<text[^>]*>0<\/text>/.test(svg().innerHTML));
  T('la tabla de datos tiene todos los registros (7) con su origen', d.querySelectorAll('.prdet:not(.prexc) .prtb tbody tr').length == 7 && /Lumbar/.test(d.querySelector('.prdet:not(.prexc) .prtb tbody').textContent));

  // ---- Ejes con nombre y unidad ----
  T('ejes con nombre y unidad: «Eje Y: Dolor (EVA 0–10)» y «Eje X: Fecha»', /Eje Y:\s*Dolor \(EVA 0–10\)/.test(d.querySelector('.praxl').textContent) && /Eje X:\s*Fecha/.test(d.querySelector('.praxl').textContent) && /Y: Dolor \(EVA 0–10\)/.test(svg().textContent) && /X: Fecha/.test(svg().textContent));
  set('#pry', 'fuerza');
  T('Fuerza → desplegable «Músculo o movimiento» con unidad (kg); eje Y «Fuerza — Cuádriceps Der (kg)»', /Músculo o movimiento/.test(d.getElementById('prg').textContent) && op('pryd').includes(FZ) && tx('pryd').every(t => /\(kg\)$/.test(t)) && /Eje Y:\s*Fuerza — Cuádriceps Der \(kg\)/.test(d.querySelector('.praxl').textContent));
  set('#pryd', FZ);
  T('Todas: la fuerza del cuádriceps de dos lesiones se dibuja en dos series', d.querySelectorAll('.prleg .prlg').length >= 2);
  set('#pry', 'rom');
  T('ROM → unidad (°) en el desplegable y en el eje', /Flexión de rodilla Der \(°\)/.test(tx('pryd')[0]) && /Flexión de rodilla Der \(°\)/.test(d.querySelector('.praxl').textContent));
  set('#pry', 'carga');
  T('Carga → ejercicios con unidad en la lista (kg y «Sin unidad especificada»)', tx('pryd').some(t => /\(kg\)$/.test(t)) && tx('pryd').some(t => /\(Sin unidad especificada\)$/.test(t)));
  set('#pryd', KG);
  T('eje Y de carga: «Carga — Ejercicio (kg)»; nota «Carga registrada» (no afirma que se haya realizado)', new RegExp('Eje Y:\\s*Carga — ' + nom[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\(kg\\)').test(d.querySelector('.praxl').textContent) && /Carga registrada/.test(d.getElementById('prg').textContent) && /no indica que se haya realizado/.test(d.getElementById('prg').textContent));
  const nPts = ev(`prVars(cc(),'').find(z=>z.id=='${KG}').p.length`);
  T('las cargas del plan semanal aparecen en sus fechas: un punto por registro', svg().querySelectorAll('.prm').length == nPts && nPts == 8);
  const sinU = 'c:' + ids[2] + '|sin';
  set('#pryd', sinU);
  T('serie sin unidad: «Sin unidad especificada» en el eje', /Eje Y:.*\(Sin unidad especificada\)/.test(d.querySelector('.praxl').textContent));
  set('#pry', 'inten');
  T('Intensidad → «% RM» en el eje y en el desplegable', /\(% RM\)/.test(tx('pryd')[0]) && /\(% RM\)/.test(d.querySelector('.praxl').textContent));
  set('#pry', 'rpe');
  T('RPE → escala 0–10 en el eje; el eje vertical va de 0 a 10', /Eje Y:.*\(0–10\)/.test(d.querySelector('.praxl').textContent) && /<text[^>]*>10<\/text>/.test(svg().innerHTML));
  clk('.prsvg .prh');
  T('tocar un punto de carga: muestra valor con unidad, «Carga registrada», origen y texto original', /Carga registrada/.test(d.getElementById('prread').textContent) && /RPE 7/.test(d.getElementById('prread').textContent) && /Rutina «Fase II»/.test(d.getElementById('prread').textContent) && /texto «RPE 7»/.test(d.getElementById('prread').textContent));
  T('la tabla muestra la unidad y el origen', /RPE 7/.test(d.querySelector('.prtb').textContent) && /Fase II/.test(d.querySelector('.prtb').textContent));
  T('cargas sin interpretar: se listan aparte con su texto original', /2 cargas sin interpretar/.test(d.querySelector('.prexc summary').textContent) && /«goma roja»/.test(d.querySelector('.prexc').textContent) && /«2 × 15 kg»/.test(d.querySelector('.prexc').textContent));

  // ---- Barras: varios registros el mismo día, uno junto a otro ----
  set('#pry', 'carga'); set('#pryd', KG);
  clk('.prtype [data-a=prt][data-v=bar]');
  const rects = [...svg().querySelectorAll('rect.prb')];
  T('barras: una por registro, sin línea', rects.length == nPts && !svg().querySelector('polyline'));
  const ps = ev(`prPuntos(prVars(cc(),''),cc(),'fecha',prVars(cc(),'').find(z=>z.id=='${KG}')).pts`);
  const doble = ps.filter(q => q.d == '2027-01-04');
  const rr = rects.filter(r => /50 kg|55 kg/.test(r.dataset.t) && /4 ene 2027/.test(r.dataset.t)).sort((a, b) => +a.getAttribute('x') - +b.getAttribute('x'));
  T('las dos barras del mismo día se colocan una junto a otra (no se tapan) y con distinto color', doble.length == 2 && rr.length == 2 && +rr[0].getAttribute('x') + +rr[0].getAttribute('width') <= +rr[1].getAttribute('x') + .5 && rr[0].getAttribute('fill') != rr[1].getAttribute('fill'));
  T('la leyenda identifica «Registro 1» y «Registro 2»', /Registro 1/.test(d.querySelector('.prleg').textContent) && /Registro 2/.test(d.querySelector('.prleg').textContent));
  clk('.prtype [data-a=prt][data-v=lin]');
  T('líneas: cada «registro n» es su propia serie y los dos del mismo día se ven (dos marcadores)', ev(`prVars(cc(),'').find(z=>z.id=='${KG}').p.filter(q=>q.d=='2027-01-04').length`) == 2 && svg().querySelectorAll('.prm').length == nPts);
  T('en las líneas el eje X respeta la distancia real entre fechas (la posición es proporcional a los días)', (() => { const q = ps.slice().sort((a, b) => a.x - b.x), cx = [...svg().querySelectorAll('.prh')].map(e => +e.getAttribute('cx')), n = q.length, m = Math.floor(n / 2); return n >= 4 && cx.length == n && Math.abs((cx[m] - cx[0]) / (cx[n - 1] - cx[0]) - (q[m].x - q[0].x) / (q[n - 1].x - q[0].x)) < .01; })());

  // ---- Lesión de referencia ----
  set('#pry', 'eva'); set('#prles', 'cp1');
  T('lesión concreta: solo sus anotaciones de dolor (4)', svg().querySelectorAll('.prm').length == 4 && d.getElementById('prles').value == 'cp1');
  const A1 = V('cp1'), A2 = V('cp2');
  T('lesión 1: solo sus mediciones (Cuádriceps) y sus cargas del periodo (no las de semanas futuras)', !por(A1, 'm:Fuerza|Isquios|Der|kg') && !!por(A1, FZ) && por(A1, KG).p.every(q => q.d >= dia(40) && q.d <= dia(0)) && por(A1, KG).p.length == por(A, KG).p.filter(q => q.d >= dia(40) && q.d <= dia(0)).length && por(A1, KG).p.length >= 2);
  T('lesión 2 (de alta): su periodo es inicio → alta, sin cargas posteriores; mediciones propias', (!por(A2, KG) || por(A2, KG).p.every(q => q.d >= dia(100) && q.d <= dia(70))) && !!por(A2, 'm:Fuerza|Isquios|Der|kg') && !!por(A2, FZ) && ev(`prPeriodo(cc().cases.find(x=>x.id=='cp2'))`)[1] == dia(70));
  T('los desplegables se actualizan: con la lesión 2 no ofrece Carga ni RPE', (set('#prles', 'cp2'), JSON.stringify(op('pry')) == '["eva","fuerza","rom"]'));
  T('dolor de la lesión de alta: 3 registros', svg().querySelectorAll('.prm').length == 3);
  set('#prx', 'dias');
  const ptsD = ev(`prPuntos(prVars(cc(),'cp2'),cc(),'dias',prVars(cc(),'cp2').find(z=>z.id=='eva')).pts`);
  T('día 0 = inicio de la lesión elegida (alta: 95 d antes → día 5; 80 d antes → día 20)', JSON.stringify(ptsD.map(q => q.x).sort((a, b) => a - b)) == '[5,10,20]' && /Día 0 = inicio de «Lumbar»/.test(d.getElementById('prg').textContent));
  T('eje X «Días desde el inicio de la lesión (días)»', /Eje X:\s*Días desde el inicio de la lesión \(días\)/.test(d.querySelector('.praxl').textContent));
  set('#prles', 'cp1');
  const ptsD1 = ev(`prPuntos(prVars(cc(),'cp1'),cc(),'dias',prVars(cc(),'cp1').find(z=>z.id=='eva')).pts`);
  T('con otra lesión el día 0 cambia (30 d antes de hoy, con lesión de hace 40 d → día 10)', ptsD1.map(q => q.x).includes(10) && ptsD1.map(q => q.x).includes(35));
  set('#prles', '');
  T('«días desde el inicio» con «Todas las lesiones»: pide elegir una lesión y no dibuja', !svg() && /elige una lesión concreta/.test(d.getElementById('prg').textContent) && !!d.getElementById('prles'));
  set('#prx', 'fecha');

  // ---- Emparejar dos variables ----
  set('#pry', 'eva'); set('#prles', 'cp1'); set('#prx', 'fuerza');
  T('X = Fuerza: aparece su detalle; el dolor y la fuerza de la MISMA anotación se emparejan (4 puntos, incluidas las dos del mismo día)', !!d.getElementById('prxd') && svg().querySelectorAll('.prm').length == 4 && /Eje X:\s*Fuerza — Cuádriceps Der \(kg\)/.test(d.querySelector('.praxl').textContent));
  const emp = ev(`prPuntos(prVars(cc(),'cp1'),cc(),'${FZ}',prVars(cc(),'cp1').find(z=>z.id=='eva')).pts`).map(q => [q.y, q.x]).sort((a, b) => a[0] - b[0]);
  T('emparejados por anotación: (3,34) (4,28) (5,26) (7,18) — la de las dos del mismo día no se cruzan', JSON.stringify(emp) == '[[3,34],[4,28],[5,26],[7,18]]');
  set('#prles', ''); set('#pry', 'carga'); set('#pryd', 'c:' + ids[2] + '|kg'); set('#prx', 'fuerza'); set('#prxd', FZ);
  const e2 = ev(`prPuntos(prVars(cc(),''),cc(),'${FZ}',prVars(cc(),'').find(z=>z.id=='c:${ids[2]}|kg'))`);
  T('registros independientes con varias mediciones el mismo día: no se emparejan al azar (la carga de hace 20 d y dos fuerzas ese día)', e2.pts.length == 0 && e2.omit == 1);
  T('aviso de que hay fechas con varios registros sin emparejar', /no se emparejan para no hacer correspondencias arbitrarias/.test(d.getElementById('prg').textContent) || /No hay registros que se puedan emparejar/.test(d.getElementById('prg').textContent));
  set('#prx', 'fecha'); set('#pry', 'eva');

  // ---- Otro paciente y solo lectura ----
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=kv]'); clk('[data-a=ptab][data-v=pro]');
  T('paciente sin datos: mensaje explicativo y sin selectores', /Todavía no hay nada que dibujar/.test(d.getElementById('prg').textContent) && !d.getElementById('pry'));
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=kp]'); clk('[data-a=ptab][data-v=pro]');
  T('al volver a un paciente la selección empieza de nuevo (Y = dolor, X = fecha, todas las lesiones)', d.getElementById('pry').value == 'eva' && d.getElementById('prx').value == 'fecha' && d.getElementById('prles').value == '');
  T('el gráfico solo lee: los datos de los pacientes no cambian', JSON.stringify(S().clients.find(c => c.id == 'kp')) == JSON.stringify(JSON.parse(antes).find(c => c.id == 'kp')));
  const css = require('fs').readFileSync(__dirname + '/../css/app.css', 'utf8');
  T('estilos del gráfico (SVG ajustable al ancho, selectores en rejilla, leyenda de ejes)', /\.prsvg\{[^}]*width:100%/.test(css) && /\.prsel\{display:grid/.test(css) && /\.praxl\{/.test(css));
  T('sin errores', errs.length == 0);
});
