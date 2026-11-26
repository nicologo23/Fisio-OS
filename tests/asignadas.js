// Edición de rutinas y planes semanales YA asignados a un paciente (pestaña Ejercicio → «Editar»), fecha de inicio del plan semanal,
// independencia de los registros, reflejo en Progreso / Resumen / PDF y conservación tras cerrar y abrir la app.
const { IDBFactory } = require('fake-indexeddb');
const { open } = require('./lib.js');
const H = open({ jspdf: true });
H.run(async ({ w, d, clk, set, tab, app, T, errs, S, flush, ready, idb }) => {
  const ev = code => w.eval(code), J = JSON.stringify, canon = o => Array.isArray(o) ? o.map(canon) : (o && typeof o == 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, canon(o[k])])) : o, JC = o => J(canon(o));
  const ids = ev('all().slice(0,6).map(e=>e.id)'), nom = ids.map(i => ev(`byId(${J(i)}).n`));
  const it = (e, o) => Object.assign({ e, sets: 3, reps: '8', hold: 30, rest: 90, load: '', note: '' }, o || {});
  const dias = (plan, nm) => ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((x, i) => plan[i] ? { day: x, name: nm, items: plan[i] } : { day: x, name: '', items: [] });
  const mk = (x = '') => ({ plans: [{ id: 'pa1' + x, date: '2026-11-10', name: 'Fase II', note: 'nota', items: [it(ids[0], { load: '50 kg', note: 'lento' }), it(ids[1], { load: '12,5 kg' }), it(ids[2], { load: 'RPE 7' })] }, { id: 'pa2' + x, date: '2026-11-12', name: 'Otra rutina', note: '', items: [it(ids[0], { load: '20 kg' })] }],
    weeks: [{ id: 'wa1' + x, date: '2026-11-04', start: '2026-11-02', name: 'Semana 1', note: 'sn', days: dias({ 0: [it(ids[0], { load: '30 kg' })], 2: [it(ids[1], { load: '35 kg' })], 4: [it(ids[2], { load: '40 kg' })] }, 'Fuerza') },
            { id: 'wa2' + x, date: '2026-11-18', name: 'Semana sin inicio', note: '', days: dias({ 0: [it(ids[0], { load: '25 kg' })] }, 'Antigua') }] });
  ev(`(()=>{st.routines.push({id:'rlib',name:'De la biblioteca',items:${J([it(ids[0], { load: '50 kg', note: 'lento' }), it(ids[1], { load: '12,5 kg' })])}});
    st.clients.push(Object.assign({id:'ka',name:'Paciente A',notes:'',cases:[]},${J(mk())}),Object.assign({id:'kb',name:'Paciente B',notes:'',cases:[]},${J(mk('b'))}));save();render()})()`);
  const P = () => S().clients.find(c => c.id == 'ka'), B0 = J(S().clients.find(c => c.id == 'kb')), RT0 = J(S().routines);
  tab('cli'); clk('#plist [data-a=selc][data-id=ka]'); clk('[data-a=ptab][data-v=ej]');
  const ed = k => `[data-a=aeedit][data-k=${k}]`, card = id => d.getElementById(id);

  // ---- Botón Editar en las tarjetas ----
  T('cada rutina asignada y cada plan semanal tiene su botón «Editar»', d.querySelectorAll(ed('p')).length == 2 && d.querySelectorAll(ed('w')).length == 2 && /Editar/.test(d.querySelector(ed('p')).textContent));
  T('plan semanal: «Semana del …» con la fecha de inicio y cada día con su fecha (lunes 2 nov … viernes 6 nov)', /Semana del 2 nov 2026/.test(card('pw-wa1').textContent) && /Mié\s*4 nov/.test(card('pw-wa1').textContent) && /Vie\s*6 nov/.test(card('pw-wa1').textContent));
  T('plan antiguo sin inicio: se muestra deducido (lunes 16 nov para la asignación del miércoles 18) y se avisa', /Semana del 16 nov 2026/.test(card('pw-wa2').textContent) && /deducida/.test(card('pw-wa2').textContent) && !/deducida/.test(card('pw-wa1').textContent));
  T('abrir el plan antiguo no cambia sus datos (no se le pone fecha de inicio hasta que se guarde)', !('start' in P().weeks[1]));

  // ---- Rutina asignada: editar ----
  clk(`#pp-pa1 ${ed('p')}`);
  T('se abre el editor con nombre, fecha, notas, ejercicios y los botones Guardar y Cancelar', !!card('pp-pa1').classList.contains('aed') && d.getElementById('aen').value == 'Fase II' && d.getElementById('aef').value == '2026-11-10' && d.getElementById('aeo').value == 'nota' && d.querySelectorAll('.aed .card.item').length == 3 && !!d.querySelector('[data-a=aesave]') && !!d.querySelector('[data-a=aecancel]'));
  T('reutiliza el editor de ejercicio de las rutinas (series, reps, descanso, carga, notas)', ['sets', 'reps', 'rest', 'load', 'note'].every(f => d.querySelector(`.aed [data-ef=${f}][data-i="0"]`)));
  set('#aen', 'Fase II (ajustada)'); set('#aef', '2026-11-11'); set('#aeo', 'Hizo menos');
  set('.aed [data-ef=sets][data-i="0"]', '4'); set('.aed [data-ef=reps][data-i="0"]', '6'); set('.aed [data-ef=rest][data-i="0"]', '120'); set('.aed [data-ef=load][data-i="0"]', '45 kg'); set('.aed [data-ef=note][data-i="0"]', 'sin lastre');
  T('mientras se edita NO se guarda nada (todo es borrador)', J(P().plans[0]) == J(mk().plans[0]));
  clk('.aed [data-a=aedn][data-i="0"]');
  T('mover un ejercicio: el primero pasa a segundo', d.querySelector('.aed [data-ef=load][data-i="1"]').value == '45 kg' && d.querySelector('.aed [data-ef=load][data-i="0"]').value == '12,5 kg');
  clk('.aed [data-a=aerm][data-i="2"]');
  T('quitar un ejercicio', d.querySelectorAll('.aed .card.item').length == 2);
  clk('.aed [data-a=aeadd]'); T('«Añadir ejercicio» abre el buscador de la biblioteca', !!d.getElementById('aeq'));
  set('#aeq', nom[3].slice(0, 5));
  const res = [...d.querySelectorAll('#aeres .aepi')];
  T('el buscador encuentra ejercicios de la biblioteca', res.length > 0 && res.some(b => b.dataset.id == ids[3]));
  clk(`#aeres .aepi[data-id="${ids[3]}"]`);
  T('añadir ejercicio de la biblioteca: queda al final con valores por defecto, y se cierra el buscador', d.querySelectorAll('.aed .card.item').length == 3 && !d.getElementById('aeq') && d.querySelector('.aed [data-ef=sets][data-i="2"]').value == '3');
  clk('.aed [data-a=aesub][data-i="0"]'); set('#aeq', nom[4].slice(0, 5)); clk(`#aeres .aepi[data-id="${ids[4]}"]`);
  T('sustituir un ejercicio: cambia el ejercicio y se conservan sus series, carga y notas', /1\./.test(d.querySelector('.aed .card.item b').textContent) && d.querySelector('.aed .card.item b').textContent.includes(nom[4]) && d.querySelector('.aed [data-ef=load][data-i="0"]').value == '12,5 kg');
  T('hasta ahora el plan guardado sigue intacto (borrador)', J(P().plans[0]) == J(mk().plans[0]) && J(S().routines) == RT0);

  // Cancelar con cambios: pide confirmación y no cambia nada
  w.__confirms.length = 0; w.__ok = false; clk('[data-a=aecancel]');
  T('cancelar con cambios sin guardar avisa y, si no se confirma, se sigue editando', w.__confirms.length == 1 && !!card('pp-pa1').classList.contains('aed'));
  w.__ok = true; clk('[data-a=aecancel]');
  T('cancelar descarta todo: el plan queda exactamente como estaba y desaparece el editor', J(P().plans[0]) == J(mk().plans[0]) && !d.querySelector('.aed') && /Fase II/.test(card('pp-pa1').textContent));

  // Validación y guardar
  clk(`#pp-pa1 ${ed('p')}`); set('#aen', '   ');
  clk('[data-a=aesave]');
  T('nombre vacío: no guarda y sigue el editor', !!d.querySelector('.aed') && P().plans[0].name == 'Fase II');
  set('#aen', 'Fase II (ajustada)'); set('#aef', 'no-es-fecha'); clk('[data-a=aesave]');
  T('fecha no válida: no guarda y sigue el editor', !!d.querySelector('.aed') && P().plans[0].date == '2026-11-10');
  set('#aef', '2026-11-11'); set('#aeo', 'Hizo menos');
  set('.aed [data-ef=load][data-i="0"]', '45 kg'); set('.aed [data-ef=sets][data-i="0"]', '4'); set('.aed [data-ef=note][data-i="0"]', 'sin lastre');
  clk('.aed [data-a=aerm][data-i="2"]');
  clk('[data-a=aesave]');
  const p1 = P().plans[0], orig = mk().plans[0];
  T('guardar: el plan queda con el nombre, la fecha, las notas y los ejercicios editados', p1.name == 'Fase II (ajustada)' && p1.date == '2026-11-11' && p1.note == 'Hizo menos' && p1.items.length == 2 && p1.items[0].sets == '4' && p1.items[0].load == '45 kg' && p1.items[0].note == 'sin lastre' && p1.items[0].e == ids[0]);
  T('se conserva el identificador del registro y no aparecen planes duplicados', p1.id == 'pa1' && P().plans.length == 2 && P().plans[1].id == 'pa2');
  T('no se modifica la rutina original de «Rutinas»', J(S().routines) == RT0);
  T('otros planes del mismo paciente, el plan semanal y otro paciente no cambian', J(P().plans[1]) == J(orig.plans ? orig.plans[1] : mk().plans[1]) && J(P().weeks) == J(mk().weeks) && J(S().clients.find(c => c.id == 'kb')) == B0);
  T('el editor se cierra y la tarjeta muestra los cambios', !d.querySelector('.aed') && /Fase II \(ajustada\)/.test(card('pp-pa1').textContent) && /11 nov 2026/.test(card('pp-pa1').textContent) && /45 kg/.test(card('pp-pa1').textContent));
  T('también cambia lo que ve el informe PDF y el texto para enviar', ev(`(()=>{const p=cc().plans[0],s=specPlan(cc(),p);return s.title=='Fase II (ajustada)'&&/11 nov/.test(s.sub)&&s.note=='Hizo menos'&&s.sections[0].items.length==2&&/Fase II \\(ajustada\\)/.test(planText(p))})()`));
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const pdfOk = await w.eval(`(async()=>{PDFX.png=async()=>'${PNG}';const c=st.clients.find(x=>x.id=='ka');const a=await buildPDF(specPlan(c,c.plans[0])),b=await buildPDF(specWeek(c,c.weeks[0]));return [a,b].map(x=>x.getNumberOfPages()+':'+x.output('arraybuffer').byteLength).join(',')})()`);
  T('los informes PDF del plan editado y del plan semanal se generan', pdfOk.split(',').every(x => +x.split(':')[0] >= 1 && +x.split(':')[1] > 2000));

  // ---- Plan semanal: editar un día sin tocar los demás ----
  const W0 = J(P().weeks[0]);
  clk(`#pw-wa1 ${ed('w')}`);
  T('editor del plan semanal: nombre, fecha de inicio, notas y una pestaña por día', !!card('pw-wa1').classList.contains('aed') && d.getElementById('aen').value == 'Semana 1' && d.getElementById('aef').value == '2026-11-02' && d.querySelectorAll('.aedays button').length == 7 && /Lunes · 2 nov/.test(d.querySelector('.aeday').textContent));
  T('empieza en el primer día con rutina (lunes) y muestra sus ejercicios', d.querySelector('.aedays .on').dataset.d == '0' && d.querySelector('.aed [data-ef=load][data-i="0"]').value == '30 kg' && d.getElementById('aedn').value == 'Fuerza');
  set('.aed [data-ef=load][data-i="0"]', '32,5 kg'); set('#aedn', 'Fuerza A');
  clk('.aedays [data-d="1"]');
  T('martes es descanso: sin ejercicios y con aviso', /Día de descanso/.test(d.querySelector('.aed').textContent) && d.getElementById('aedn').value == '');
  clk('.aed [data-a=aeadd]'); set('#aeq', nom[3].slice(0, 5)); clk(`#aeres .aepi[data-id="${ids[3]}"]`);
  T('añadir un ejercicio a un día de descanso lo convierte en día de entrenamiento («Sesión»)', d.getElementById('aedn').value == 'Sesión' && d.querySelectorAll('.aed .card.item').length == 1);
  clk('.aedays [data-d="2"]'); clk('[data-a=aerest]');
  T('«Marcar como descanso» vacía ese día (miércoles)', d.getElementById('aedn').value == '' && d.querySelectorAll('.aed .card.item').length == 0);
  clk('.aedays [data-d="4"]'); set('.aed [data-ef=load][data-i="0"]', '42 kg');
  set('#aef', '2026-11-09');
  T('cambiar la fecha de inicio actualiza las fechas de los días mostrados (viernes 13 nov)', /Viernes · 13 nov/.test(d.querySelector('.aed').textContent));
  clk('[data-a=aesave]');
  const w0 = P().weeks[0], o0 = JSON.parse(W0);
  T('guardar plan semanal: id conservado, inicio nuevo (la fecha de asignación no cambia) y fechas de los días recalculadas', w0.id == 'wa1' && w0.start == '2026-11-09' && w0.date == '2026-11-04' && ev('wkDia(cc().weeks[0],4)') == '2026-11-13');
  T('lunes editado, martes añadido, miércoles en descanso, viernes editado', w0.days[0].name == 'Fuerza A' && w0.days[0].items[0].load == '32,5 kg' && w0.days[1].name == 'Sesión' && w0.days[1].items.length == 1 && w0.days[2].name == '' && w0.days[2].items.length == 0 && w0.days[4].items[0].load == '42 kg' && w0.days.length == 7 && w0.days.every((x, i) => x.day == o0.days[i].day));
  T('los días que no se tocaron (jueves, sábado, domingo) quedan igual, y el plan que no se editó, igual', [3, 5, 6].every(i => J(w0.days[i]) == J(o0.days[i])) && J(P().weeks[1]) == J(mk().weeks[1]));
  T('editar el lunes no modifica el resto de días ni la rutina de la biblioteca ni al otro paciente', J(S().routines) == RT0 && J(S().clients.find(c => c.id == 'kb')) == B0);
  T('las tarjetas muestran el nuevo inicio y el miércoles como descanso', /Semana del 9 nov 2026/.test(card('pw-wa1').textContent) && /Mié 11 nov descanso/.test(card('pw-wa1').textContent.replace(/\s+/g, ' ')));
  T('también en el informe PDF del plan semanal', ev(`(()=>{const c=cc(),s=specWeek(c,c.weeks[0]);return /semana del 9 nov/.test(s.sub)&&s.week[2].name===''&&s.sections.length==3})()`));

  // Plan antiguo sin fecha de inicio: al editarlo queda explícita
  clk(`#pw-wa2 ${ed('w')}`);
  T('al editar un plan antiguo se propone la fecha deducida (lunes de la semana de la asignación) y se explica', d.getElementById('aef').value == '2026-11-16' && /se había deducido/.test(d.querySelector('.aed').textContent));
  set('#aef', '2026-11-17');
  T('si la fecha de inicio no es lunes, se avisa', /no es lunes/.test(d.querySelector('.aed').textContent));
  set('#aef', '2026-11-16'); clk('[data-a=aesave]');
  T('al guardar queda guardada la fecha de inicio (ya no se deduce)', P().weeks[1].start == '2026-11-16' && !/deducida/.test(card('pw-wa2').textContent));

  // ---- Reflejo en Progreso y Resumen ----
  clk('[data-a=ptab][data-v=pro]'); set('#pry', 'carga');
  const op = id => [...d.getElementById(id).options].map(o => o.value);
  set('#pryd', 'c:' + ids[0] + '|kg');
  const pts = ev(`prVars(cc(),'').find(z=>z.id=='c:${ids[0]}|kg').p.map(q=>[q.d,q.v,q.src])`);
  T('Progreso se actualiza tras editar: el lunes 9 nov (32,5 kg) y la rutina del 11 nov (45 kg); desaparecen las fechas antiguas', pts.some(q => q[0] == '2026-11-09' && q[1] == 32.5 && /Fuerza A/.test(q[2])) && pts.some(q => q[0] == '2026-11-11' && q[1] == 45) && !pts.some(q => q[0] == '2026-11-02' || q[0] == '2026-11-10'));
  T('Progreso: el viernes 13 nov (42 kg) del plan semanal editado, con la fecha de inicio nueva', ev(`prVars(cc(),'').find(z=>z.id=='c:${ids[2]}|kg').p.some(q=>q.d=='2026-11-13'&&q.v==42)`));
  clk('[data-a=ptab][data-v=res]');
  T('el Resumen del paciente muestra el plan semanal editado (lunes «Fuerza A», martes «Sesión»)', /Fuerza A/.test(d.getElementById('ptabc').textContent) && /Sesión/.test(d.getElementById('ptabc').textContent));
  clk('[data-a=ptab][data-v=ej]');

  // ---- Persistencia y sincronización ----
  await flush();
  const regs = await H.Datos.registros(0), rp = regs.find(r => r.kind == 'plan' && r.id == 'pa1'), rw = regs.find(r => r.kind == 'week' && r.id == 'wa1');
  T('el cambio se guarda en la base de datos del dispositivo (registro propio, versión sumada, pendiente de enviar)', !!rp && rp.data.name == 'Fase II (ajustada)' && rp.vv[H.Datos.id()] >= 1 && !!rw && rw.data.start == '2026-11-09');
  T('solo se reescriben los registros editados (los de otro paciente no)', regs.filter(r => r.kind == 'plan' && r.parent == 'kb').every(r => r.updatedAt <= rp.updatedAt));
  const K = open({ idb: H.idb, seed: false, jspdf: false }); await K.ready();
  const Pk = K.S().clients.find(c => c.id == 'ka');
  T('al cerrar y volver a abrir la app, los cambios siguen ahí', Pk.plans[0].name == 'Fase II (ajustada)' && Pk.plans[0].date == '2026-11-11' && Pk.weeks[0].start == '2026-11-09' && Pk.weeks[0].days[2].name == '' && Pk.weeks[0].days[0].items[0].load == '32,5 kg' && Pk.weeks[1].start == '2026-11-16');
  T('y el resto de datos también (otro paciente y rutinas de la biblioteca)', JC(K.S().clients.find(c => c.id == 'kb')) == JC(JSON.parse(B0)) && JC(K.S().routines) == JC(JSON.parse(RT0)));
  K.close();

  // ---- Compatibilidad con registros anteriores ----
  T('registros anteriores sin fecha de inicio siguen funcionando (se deduce)', ev('wkInicio({date:"2026-03-04"}).iso') == '2026-03-02' && ev('wkDia({date:"2026-03-04"},6)') == '2026-03-08');
  T('registros anteriores con fecha de asignación inválida no rompen nada (se usa hoy)', ev('typeof wkInicio({date:"x"}).iso')=='string' && /^\d{4}-\d{2}-\d{2}$/.test(ev('wkInicio({date:"x"}).iso')));
  const css = require('fs').readFileSync(__dirname + '/../css/app.css', 'utf8');
  T('estilos del editor presentes', /\.aed\{/.test(css) && /\.aepick\{/.test(css));
  T('sin errores', errs.length == 0);
});
