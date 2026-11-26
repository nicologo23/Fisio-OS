// Progreso del paciente: variables (EVA, mediciones, carga planificada), gráfico de líneas/barras, dos ejes y selección de X/Y.
const { open } = require('./lib.js');
const H = open();
H.run(async ({ w, d, clk, set, tab, app, T, errs, S }) => {
  const ev = code => w.eval(code);
  const dia = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const ids = ev('all().slice(0,3).map(e=>e.id)'), nom = ids.map(i => ev(`byId(${JSON.stringify(i)}).n`));
  const it = (e, load) => ({ e, sets: 3, reps: '8', hold: 30, rest: 90, load, note: '' });
  const me = (n, date, pain, fz, rom) => ({ id: 'pm' + n, n, date, type: 'Evaluación', text: '', pain: String(pain), meas: [{ k: 'Fuerza', l: 'Cuádriceps', s: 'Der', v: String(fz), u: 'kg' }, { k: 'Rango de movimiento', l: 'Flexión de rodilla', s: 'Der', v: String(rom), u: '°' }] });
  const caso = (id, name, status, opened, entries) => ({ id, name, status, opened, dx: '', type: '', act: '', contact: '', moment: '', zones: [], entries });
  ev(`(()=>{const k=st.clients;
    k.push({id:'kp',name:'Prueba Progreso',notes:'',cases:[${JSON.stringify(caso('cp1', 'Tendinopatía', 'Activa', dia(40), [me(1, dia(30), 7, 18, 95), me(2, dia(20), 5, 26, 110), me(3, dia(20), 4, 28, 112), me(4, dia(5), 3, 34, 125)]))},${JSON.stringify(caso('cp2', 'Lumbar', 'Alta', dia(100), []))}],
      plans:[{id:'pp1',date:'${dia(4)}',name:'Fase II',note:'',items:[${JSON.stringify(it(ids[0], '50 kg'))},${JSON.stringify(it(ids[1], '12,5 kg'))},${JSON.stringify(it(ids[2], 'RPE 7'))}]},{id:'pp2',date:'${dia(25)}',name:'Fase I',note:'',items:[${JSON.stringify(it(ids[0], '40 kg'))},${JSON.stringify(it(ids[1], 'peso corporal'))},${JSON.stringify(it(ids[2], '6'))}]}],
      weeks:[{id:'pw1',date:'${dia(25)}',name:'Semana',note:'',days:[{day:'Lunes',name:'R',items:[${JSON.stringify(it(ids[0], '45 kg'))}]},{day:'Martes',name:'',items:[]},{day:'Miércoles',name:'R',items:[${JSON.stringify(it(ids[0], '42 kg'))}]},{day:'Jueves',name:'',items:[]},{day:'Viernes',name:'',items:[]},{day:'Sábado',name:'',items:[]},{day:'Domingo',name:'',items:[]}]}]},
     {id:'kv',name:'Sin datos',notes:'',plans:[],weeks:[],cases:[]});
    save();render()})()`);
  const antes = JSON.stringify(S().clients);
  tab('cli'); clk('#plist [data-a=selc][data-id=kp]'); clk('[data-a=ptab][data-v=pro]');

  // Variables: cada una tiene un tipo (Dolor EVA, Fuerza, ROM, Carga, RPE) y un detalle (músculo, movimiento o ejercicio)
  const V = ev('prVars(cc())'), por = id => V.find(z => z.id == id);
  const FZ = 'm:Fuerza|Cuádriceps|Der|kg', RM = 'm:Rango de movimiento|Flexión de rodilla|Der|°';
  T('hay variables con su tipo: dolor EVA, fuerza, ROM, carga y RPE', por('eva').t == 'eva' && por(FZ).t == 'fuerza' && por(RM).t == 'rom' && por('c:' + ids[0]).t == 'carga' && por('c:' + ids[2]).t == 'rpe');
  T('el dolor EVA sale de las anotaciones: un punto por día (el último del día) y orden por fecha', JSON.stringify(por('eva').p.map(q => q.v)) == '[7,4,3]' && por('eva').p[1].d == dia(20));
  T('la fuerza tiene su unidad y una sola lectura por día', por(FZ).u == 'kg' && JSON.stringify(por(FZ).p.map(q => q.v)) == '[18,28,34]' && por(FZ).s == 'Cuádriceps Der');
  const c0 = por('c:' + ids[0]);
  T('carga planificada del ejercicio: sale de planes y de planes semanales (el mayor del día) con nombre del ejercicio y unidad kg', c0.s == nom[0] && c0.u == 'kg' && JSON.stringify(c0.p.map(q => q.v)) == '[45,50]' && c0.p[0].d == dia(25));
  T('«12,5 kg» se lee como 12,5; «peso corporal» sin número no cuenta; «RPE 7» → tipo RPE (con su dato sin unidad incluido)', JSON.stringify(por('c:' + ids[1]).p.map(q => q.v)) == '[12.5]' && por('c:' + ids[2]).u == 'RPE' && por('c:' + ids[2]).p.length == 2);

  // Controles y valores iniciales (ya no hay «segunda variable»)
  const op = id => [...d.getElementById(id).options].map(o => o.value);
  T('Progreso muestra Variable Y, su detalle y Variable X, y el tipo de gráfico', !!d.getElementById('pry') && !!d.getElementById('pryd') && !!d.getElementById('prx') && d.querySelectorAll('.prtype button').length == 2);
  T('ya no existe la segunda variable', !d.getElementById('pry2') && !/Segunda variable/.test(d.getElementById('prg').textContent));
  T('valores iniciales: Y = Dolor (EVA), X = Fecha (sin detalle), líneas con puntos', d.getElementById('pry').value == 'eva' && d.getElementById('pryd').value == 'eva' && d.getElementById('prx').value == 'fecha' && !d.getElementById('prxd') && d.querySelector('.prtype .on').dataset.v == 'lin');
  T('el desplegable de variable ofrece solo los tipos con datos: EVA, Fuerza, ROM, Carga, RPE', JSON.stringify(op('pry')) == '["eva","fuerza","rom","carga","rpe"]');
  T('el eje X ofrece Fecha, días desde el inicio de la lesión y los mismos tipos', JSON.stringify(op('prx')) == '["fecha","dias","eva","fuerza","rom","carga","rpe"]');
  const svg = () => d.querySelector('.prsvg');
  T('líneas con puntos: una línea y tantos puntos como fechas (3)', !!svg() && svg().querySelectorAll('polyline').length == 1 && svg().querySelectorAll('circle:not(.prh)').length == 3);
  T('eje vertical de dolor fijo de 0 a 10', /<text[^>]*>10<\/text>/.test(svg().innerHTML) && /<text[^>]*>0<\/text>/.test(svg().innerHTML));
  T('los valores salen también en una tabla («Ver los datos del gráfico»)', d.querySelectorAll('.prtb tbody tr').length == 3 && /Fecha/.test(d.querySelector('.prtb th').textContent));

  // Elegir tipo y luego «de qué»
  set('#pry', 'fuerza');
  T('Fuerza → segundo desplegable «Músculo o movimiento» con solo las fuerzas, y se elige la primera', /Músculo o movimiento/.test(d.getElementById('prg').textContent) && JSON.stringify(op('pryd')) == JSON.stringify([FZ]) && d.getElementById('pryd').value == FZ && /Fuerza · Cuádriceps Der/.test(d.querySelector('.prleg').textContent));
  set('#pry', 'rom');
  T('ROM → solo los movimientos de ROM, con su unidad en la lista', JSON.stringify(op('pryd')) == JSON.stringify([RM]) && /Flexión de rodilla Der \(°\)/.test(d.getElementById('pryd').options[0].textContent) && /Movimiento/.test(d.getElementById('prg').textContent));
  set('#pry', 'carga');
  T('Carga → segundo desplegable «Ejercicio» con los ejercicios con carga (kg) de sus rutinas y planes', /Ejercicio/.test(d.getElementById('prg').textContent) && JSON.stringify(op('pryd')) == JSON.stringify(['c:' + ids[0], 'c:' + ids[1]]) && /\(kg\)/.test(d.getElementById('pryd').options[0].textContent));
  set('#pryd', 'c:' + ids[1]);
  T('elegir otro ejercicio cambia el gráfico y la leyenda', d.getElementById('pryd').value == 'c:' + ids[1] && new RegExp(nom[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(d.querySelector('.prleg').textContent) && svg().querySelectorAll('circle:not(.prh)').length == 1);
  set('#pry', 'rpe');
  T('RPE → los ejercicios en los que la carga se da en RPE', JSON.stringify(op('pryd')) == JSON.stringify(['c:' + ids[2]]) && svg().querySelectorAll('circle:not(.prh)').length == 2);
  set('#pry', 'carga'); set('#pryd', 'c:' + ids[0]);
  T('Carga del ejercicio 1: dos fechas (planes y semana)', svg().querySelectorAll('circle:not(.prh)').length == 2 && /kg/.test(svg().textContent));

  // Barras
  clk('.prtype [data-a=prt][data-v=bar]');
  T('barras: una barra por fecha, ejes desde cero y sin línea', d.querySelector('.prtype .on').dataset.v == 'bar' && svg().querySelectorAll('rect.prb').length == 2 && !svg().querySelector('polyline') && /<text[^>]*>0<\/text>/.test(svg().innerHTML));
  clk('.prtype [data-a=prt][data-v=lin]'); T('volver a líneas', !!svg().querySelector('polyline'));

  // Eje X con otra variable (se emparejan por fecha) y días desde la lesión
  set('#pry', 'eva'); set('#prx', 'fuerza');
  T('X = tipo Fuerza: aparece su detalle (músculo) y se dibujan las fechas comunes (3 puntos: dolor frente a fuerza)', !!d.getElementById('prxd') && d.getElementById('prxd').value == FZ && svg().querySelectorAll('circle:not(.prh)').length == 3 && /Fuerza · Cuádriceps Der \(kg\)/.test(svg().textContent) && /solo se dibujan las fechas/.test(d.getElementById('prg').textContent));
  set('#prx', 'dias');
  T('X = días desde el inicio de la lesión (día 0 = lesión activa más reciente), con aviso y título del eje', !d.getElementById('prxd') && /Día 0 = inicio de «Tendinopatía»/.test(d.getElementById('prg').textContent) && /Días desde el inicio de la lesión/.test(svg().textContent));
  const pts = ev('prPuntos(prVars(cc()),cc(),"dias",prVars(cc()).find(z=>z.id=="eva"))');
  T('los días se cuentan desde la fecha de la lesión (30 d antes de hoy = día 10)', pts[0].x == 10 && pts[2].x == 35);
  set('#pry', 'rom'); set('#prx', 'carga'); set('#prxd', 'c:' + ids[1]);
  T('sin fechas en común entre las variables: mensaje claro en lugar de un gráfico vacío', !svg() && /No hay fechas en común/.test(d.getElementById('prg').textContent));
  set('#prx', 'fecha');

  // Tocar un punto muestra su valor (para iPhone/iPad, donde no hay «hover»)
  const h = d.querySelector('.prsvg .prh'); h.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  T('tocar un punto muestra su valor y fecha debajo del gráfico', /ROM · Flexión de rodilla Der/.test(d.getElementById('prread').textContent) && /°/.test(d.getElementById('prread').textContent));

  // Otro paciente: sin datos, mensaje; y la selección no se arrastra
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=kv]'); clk('[data-a=ptab][data-v=pro]');
  T('paciente sin datos: mensaje explicativo y sin selectores', /Todavía no hay nada que dibujar/.test(d.getElementById('prg').textContent) && !d.getElementById('pry'));
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=kp]'); clk('[data-a=ptab][data-v=pro]');
  T('al volver a otro paciente la selección empieza de nuevo (Y = dolor, X = fecha)', d.getElementById('pry').value == 'eva' && d.getElementById('prx').value == 'fecha');

  // Solo lectura: el gráfico no cambia los datos
  T('el gráfico solo lee: los datos de los pacientes no cambian', JSON.stringify(S().clients) == antes);
  const css = require('fs').readFileSync(__dirname + '/../css/app.css', 'utf8');
  T('estilos del gráfico (SVG ajustable al ancho, selectores en rejilla)', /\.prsvg\{[^}]*width:100%/.test(css) && /\.prsel\{display:grid/.test(css));
  T('sin errores', errs.length == 0);
});
