// Interpretación del texto de «Carga» (prCarga): solo se acepta un número solo o con una unidad conocida; lo ambiguo no se interpreta.
const { open } = require('./lib.js');
const H = open();
H.run(async ({ w, T, errs }) => {
  const c = s => JSON.parse(JSON.stringify(w.eval(`prCarga(${JSON.stringify(s)})`)));
  const ok = (s, v, u) => { const r = c(s); return r.ok && r.v === v && r.u === u && r.raw === s; };
  const no = s => { const r = c(s); return r.ok === false && r.raw === (s == null ? '' : String(s)); };

  T('enteros y decimales con coma o con punto: 40 kg, 12,5 kg, 12.5 kg, 0,5 kg', ok('40 kg', 40, 'kg') && ok('12,5 kg', 12.5, 'kg') && ok('12.5 kg', 12.5, 'kg') && ok('0,5 kg', 0.5, 'kg'));
  T('distintas formas de escribir kg: 40kg, 40 KG, 40 kgs, 40 kilos, 40 Kg.', ['40kg', '40 KG', '40 kgs', '40 kilos', '40 Kg.', '40 kilogramos'].every(s => ok(s, 40, 'kg')));
  T('libras: 45 lb, 45 lbs, 45 libras', ['45 lb', '45 lbs', '45 libras'].every(s => ok(s, 45, 'lb')));
  T('% de RM: 70 % RM, 70%RM, 70 % 1RM, 70 % de RM → «% RM»', ['70 % RM', '70%RM', '70 % 1RM', '70 % de RM', '70% rm'].every(s => ok(s, 70, '% RM')));
  T('porcentaje sin referencia: 70 % → «%» (serie aparte de % RM)', ok('70 %', 70, '%') && ok('70%', 70, '%'));
  T('RPE en varias formas: RPE 8, rpe8, RPE: 8, 8 RPE, RPE 7,5', ok('RPE 8', 8, 'RPE') && ok('rpe8', 8, 'RPE') && ok('RPE: 8', 8, 'RPE') && ok('8 RPE', 8, 'RPE') && ok('RPE 7,5', 7.5, 'RPE'));
  T('RIR: RIR 2, 2 RIR', ok('RIR 2', 2, 'RIR') && ok('2 RIR', 2, 'RIR'));
  T('un número solo es válido pero SIN unidad (no se le asigna kg)', ok('40', 40, '') && ok('12,5', 12.5, ''));
  T('el espacio de más y los espacios duros no estorban', ok('  40  kg ', 40, 'kg') && c('40 kg').ok && c('40 kg').u == 'kg');
  T('se conserva siempre el texto original tal como se escribió', c(' 12,5 KG ').raw == ' 12,5 KG ' && c('RPE 8').raw == 'RPE 8');

  T('ambiguos: «2 × 15 kg», «2x15», «3 x 10 x 20 kg» no se interpretan (no se coge el primer número)', ['2 × 15 kg', '2x15', '3 x 10 x 20 kg', '2 × 15'].every(no));
  T('rangos: «20-30 kg», «20 – 30 kg», «20 a 30 kg», «RPE 7-8» no se interpretan', ['20-30 kg', '20 – 30 kg', '20 a 30 kg', 'RPE 7-8', '70-80 % RM'].every(no));
  T('texto sin número: «goma roja», «peso corporal», «banda» no se interpretan ni valen 0', ['goma roja', 'peso corporal', 'banda', 'kg'].every(no));
  T('vacío o nulo: no se interpreta', no('') && no('   ') && no(null) && no(undefined));
  T('sumas y lastres: «+10 kg», «40 kg + 10 kg», «40 kg (con chaleco)» no se interpretan', ['+10 kg', '40 kg + 10 kg', '40 kg (con chaleco)'].every(no));
  T('miles dudosos («1.000 kg») no se interpretan; una unidad desconocida («40 m») tampoco', no('1.000 kg') && no('40 m') && no('40 cm'));
  T('RPE o RIR fuera de la escala 0–10 no es fiable', no('RPE 11') && no('RIR 12') && ok('RPE 10', 10, 'RPE') && ok('RPE 0', 0, 'RPE'));
  T('«0 kg» es un valor escrito (0 kg), no un dato ausente; el vacío nunca se convierte en 0', ok('0 kg', 0, 'kg') && no(''));

  // Cada unidad es su propia serie del ejercicio: 40 kg, 50 kg, 70 % RM y RPE 8 no se mezclan
  const ex = w.eval('all()[0].id');
  w.eval(`(()=>{const k=st.clients;k.push({id:'ku',name:'Prueba Cargas',notes:'',cases:[],weeks:[],plans:[{id:'pu1',date:'2026-11-01',name:'A',note:'',items:[${['40 kg', '50 kg', '70 % RM', 'RPE 8', '2 × 15 kg', '20-30 kg', 'goma roja'].map(l => `{e:${JSON.stringify(ex)},sets:3,reps:'8',hold:30,rest:90,load:${JSON.stringify(l)},note:''}`).join(',')}]}]});save();render()})()`);
  const V = JSON.parse(JSON.stringify(w.eval("(()=>{const L=prVars(cc_ku(),'');return{v:L.map(z=>({id:z.id,t:z.t,u:z.u,p:z.p.map(q=>q.v)})),exc:L.exc.map(x=>x.raw)}})()".replace('cc_ku()', "st.clients.find(c=>c.id=='ku')"))));
  const ser = id => (V.v.find(z => z.id == id) || { p: null }).p;
  T('un mismo ejercicio da series separadas por unidad: kg [40,50], % RM [70], RPE [8]', JSON.stringify(ser('c:' + ex + '|kg')) == '[40,50]' && JSON.stringify(ser('c:' + ex + '|% RM')) == '[70]' && JSON.stringify(ser('c:' + ex + '|RPE')) == '[8]' && V.v.length == 3);
  T('tipos de cada serie: carga, intensidad y RPE', V.v.find(z => z.u == 'kg').t == 'carga' && V.v.find(z => z.u == '% RM').t == 'inten' && V.v.find(z => z.u == 'RPE').t == 'rpe');
  T('lo no interpretable queda fuera de las series (sin ceros) pero se lista con su texto original', V.exc.length == 3 && ['2 × 15 kg', '20-30 kg', 'goma roja'].every(x => V.exc.includes(x)) && V.v.every(z => z.p.every(v => v > 0)));
  T('y las rutinas no se tocan: los textos originales siguen en el plan', JSON.stringify(w.eval("st.clients.find(c=>c.id=='ku').plans[0].items.map(i=>i.load)")) == JSON.stringify(['40 kg', '50 kg', '70 % RM', 'RPE 8', '2 × 15 kg', '20-30 kg', 'goma roja']));
  T('sin errores', errs.length == 0);
});
