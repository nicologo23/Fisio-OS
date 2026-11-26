// Listado general de Pacientes: tarjetas, resumen de lesiones, grupos, búsqueda, filtros, alta, comportamiento móvil/ancho.
const { open } = require('./lib.js');
const H = open();
H.run(async ({ w, d, clk, set, tab, app, T, errs, S }) => {
  const dia = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const ev = code => w.eval(code);
  const filas = () => [...d.querySelectorAll('#plist .pi')];
  const nombres = () => filas().map(f => f.querySelector('b').textContent);
  const fila = n => filas().find(f => f.querySelector('b').textContent == n);
  const buscar = q => { set('#psq', q); };
  const nac = n => { const t = new Date(Date.now() - 10 * 864e5); t.setUTCFullYear(t.getUTCFullYear() - n); return t.toISOString().slice(0, 10); };   // cumplió n años hace 10 días
  const caso = (id, name, status, opened, closed) => ({ id, name, status, opened, closed, dx: '', type: '', act: '', contact: '', moment: '', zones: [], entries: [] });
  // Datos de prueba ampliados (ficticios): sexo, edad, deporte, varias lesiones, alta, sin historial, grupos
  ev(`(()=>{const k=st.clients;k[0].sex='f';k[0].birth='${nac(28)}';k[0].sport='Voleibol';k[1].sex='m';k[1].birth='1990-01-01';
    k.push({id:'k4',name:'Álvaro Pérez',notes:'',plans:[],weeks:[],sex:'m',cases:[${JSON.stringify(caso('c1', 'Tendinopatía rotuliana', 'Activa', dia(40)))},${JSON.stringify(caso('c2', 'Sobrecarga lumbar', 'Activa', dia(12)))}]},
      {id:'k5',name:'Carla Núñez',notes:'',plans:[],weeks:[],sport:'Natación',cases:[${JSON.stringify(caso('c3', 'Hombro', 'Alta', dia(90), dia(23)))}]},
      {id:'k6',name:'Óscar T.',notes:'',plans:[],weeks:[],cases:[]});
    st.groups=[{id:'g1',name:'Equipo A',members:['k1','k2','k4']},{id:'g2',name:'Juveniles',members:['k5','k1']}];save();render()})()`);
  tab('cli');
  const antes = JSON.stringify(S().clients) + JSON.stringify(S().groups);

  // Orden, contador y tarjetas
  T('orden alfabético por defecto (sin tildes en el orden)', JSON.stringify(nombres()) == JSON.stringify(['Álvaro Pérez', 'Ana García', 'Carla Núñez', 'Luis M.', 'Marta R.', 'Óscar T.'].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))));
  T('contador de pacientes', d.getElementById('pcount').textContent == '6 pacientes');
  const ana = fila('Ana García'), alv = fila('Álvaro Pérez'), car = fila('Carla Núñez'), osc = fila('Óscar T.'), luis = fila('Luis M.');
  T('tarjeta: nombre destacado y chevron de acceso a la ficha', !!ana.querySelector('b') && !!ana.querySelector('.chev svg'));
  T('mujer con edad y deporte: «28 años · Voleibol»', ana.querySelector('.ps').textContent == '28 años · Voleibol');
  const edad = new Date().getUTCFullYear() - 1990 - ((new Date().getUTCMonth() > 0 || new Date().getUTCDate() >= 1) ? 0 : 1);
  T('edad calculada desde la fecha de nacimiento', luis.querySelector('.ps').textContent == edad + ' años');
  T('solo deporte registrado: se muestra sin edad', car.querySelector('.ps').textContent == 'Natación');
  T('sin edad ni deporte: no se inventa nada (sin línea secundaria)', !osc.querySelector('.ps') && !fila('Marta R.').querySelector('.ps'));
  const avatar = f => f.querySelector('.pav').dataset.sx;   // '' neutro · 'm' hombre · 'f' mujer
  const svgDe = f => f.querySelector('.pav svg').innerHTML;
  T('icono de mujer', avatar(ana) == 'f');
  T('icono de hombre', avatar(luis) == 'm');
  T('sexo sin especificar: icono neutro', avatar(osc) == '' && avatar(car) == '');
  T('los tres iconos son distintos (neutro, hombre, mujer)', new Set([svgDe(ana), svgDe(luis), svgDe(osc)]).size == 3);
  T('no hay fotografías ni iniciales', !d.querySelector('#plist img') && !/^[A-Z]{1,2}$/.test(ana.querySelector('.pav').textContent.trim()));

  // Resumen de lesiones
  const res = f => f.querySelector('.pls');
  T('una lesión activa: su nombre, color de advertencia', res(ana).querySelector('.pln').textContent == 'Esguince tobillo derecho' && res(ana).classList.contains('act') && !!res(ana).querySelector('.pdot'));
  T('varias lesiones activas: el número', res(alv).querySelector('.pln').textContent == '2 lesiones activas' && res(alv).classList.contains('act'));
  const diasAna = ev("sev(paActivas(st.clients.find(c=>c.id=='k1'))[0]).days");
  T('una activa: días en tratamiento junto al nombre', res(ana).querySelector('.pdias').textContent == '· ' + (diasAna < 1 ? 'hoy' : diasAna == 1 ? '1 día' : diasAna + ' días'));
  T('varias activas: días de la más antigua (40)', res(alv).querySelector('.pdias').textContent == 'la más antigua: 40 días' && res(alv).classList.contains('multi'));
  T('sin lesión activa: no se muestran días', !res(car).querySelector('.pdias') && !res(osc).querySelector('.pdias') && !res(luis).querySelector('.pdias'));
  T('sin activas pero con historial: tiempo desde la última alta, color neutro', res(car).textContent.trim() == 'Última alta hace 3 semanas' && res(car).classList.contains('ok') && !res(car).classList.contains('act'));
  T('sin historial: «Sin lesiones registradas», neutro', res(osc).textContent.trim() == 'Sin lesiones registradas' && res(osc).classList.contains('none'));
  T('Luis (alta antigua): «Última alta hace …»', /^Última alta hace \d+ (días|semanas|meses)/.test(res(luis).textContent.trim()));

  // Grupos
  const tags = f => [...f.querySelectorAll('.ptag')].map(t => t.textContent.trim());
  T('etiquetas de todos los grupos del paciente', JSON.stringify(tags(ana).sort()) == JSON.stringify(['Equipo A', 'Juveniles']) && JSON.stringify(tags(alv)) == JSON.stringify(['Equipo A']));
  T('sin grupos: sin etiquetas', !osc.querySelector('.ptags'));
  T('cada grupo tiene su color (--h)', new Set([...ana.querySelectorAll('.ptag')].map(t => t.getAttribute('style'))).size == 2);

  // Búsqueda
  buscar('ALVARO'); T('búsqueda sin mayúsculas ni tildes («ALVARO» → Álvaro)', JSON.stringify(nombres()) == '["Álvaro Pérez"]' && d.getElementById('pcount').textContent == '1 de 6 pacientes');
  buscar('nunez'); T('búsqueda «nunez» encuentra Núñez', JSON.stringify(nombres()) == '["Carla Núñez"]');
  buscar('óSCAR'); T('búsqueda con tilde en mayúsculas', nombres().length == 1);
  buscar('natacion'); T('búsqueda también por deporte', JSON.stringify(nombres()) == '["Carla Núñez"]');
  buscar('zzz'); T('sin coincidencias: mensaje', nombres().length == 0 && /Ningún paciente coincide/.test(d.getElementById('plist').textContent));
  T('la búsqueda no recarga la pantalla (el cuadro sigue ahí)', !!d.getElementById('psq') && d.getElementById('psq').value == 'zzz');
  buscar('');

  // Filtros
  clk('[data-a=pfl][data-v=treat]');
  T('filtro «En tratamiento»: solo con lesión activa', JSON.stringify(nombres()) == JSON.stringify(['Álvaro Pérez', 'Ana García']) && d.querySelector('[data-a=pfl][data-v=treat]').classList.contains('on'));
  clk('[data-a=pfl][data-v=all]'); T('filtro «Todos»', nombres().length == 6);
  set('#pgf', 'g2'); T('filtro por grupo', JSON.stringify(nombres()) == JSON.stringify(['Ana García', 'Carla Núñez']));
  clk('[data-a=pfl][data-v=treat]'); T('grupo + en tratamiento', JSON.stringify(nombres()) == '["Ana García"]' && d.getElementById('pcount').textContent == '1 de 6 pacientes');
  buscar('carla'); T('grupo + tratamiento + búsqueda sin resultados', nombres().length == 0);
  buscar(''); set('#pgf', ''); clk('[data-a=pfl][data-v=all]');
  T('quitar filtros: vuelven todos', nombres().length == 6);
  T('buscar y filtrar no modifica los datos', JSON.stringify(S().clients) + JSON.stringify(S().groups) == antes);

  // Móvil: lista a pantalla completa y ficha al pulsar; ancho: lista + ficha (la distribución la decide el CSS con la clase hasdet)
  T('al entrar: lista sin ficha abierta (móvil)', !d.querySelector('.split').classList.contains('hasdet'));
  clk('#plist [data-a=selc][data-id=k2]');
  T('pulsar un paciente abre su ficha', d.querySelector('.split').classList.contains('hasdet') && /Luis M\./.test(d.querySelector('.pane-r .pcab-n').textContent) && w.eval('st.cc') == 'k2');
  T('ficha: abre en «Resumen» y con la edición cerrada', w.eval('ptab') == 'res' && !w.eval('pedit') && !d.getElementById('cnotes') && !!d.querySelector('.pcab'));
  clk('[data-a=ptab][data-v=ej]'); T('ficha, pestaña Ejercicio: planes semanales, rutinas y asignar semana', /Planes semanales/.test(app()) && /Rutinas asignadas/.test(app()) && !!d.querySelector('[data-a=awc]'));
  clk('[data-a=ptab][data-v=res]'); clk('[data-a=pedit]'); T('«Editar datos»: notas del paciente y eliminar paciente', /Notas del paciente/.test(app()) && !!d.getElementById('cnotes') && !!d.querySelector('[data-a=delc]')); clk('[data-a=pedit]');
  T('ficha: botón para volver al listado', !!d.querySelector('.pane-r [data-a=pback]'));
  clk('[data-a=pback]'); T('volver al listado', !d.querySelector('.split').classList.contains('hasdet') && nombres().length == 6);
  clk('#plist [data-a=selc][data-id=k1]'); tab('hoy'); tab('cli');
  T('al volver a la pestaña Pacientes se ve el listado', !d.querySelector('.split').classList.contains('hasdet'));
  tab('hoy'); clk('#app [data-a=fichac]');
  T('desde Hoy («Plan de hoy») se abre la ficha del paciente', w.eval('tab') == 'cli' && d.querySelector('.split').classList.contains('hasdet'));
  tab('cli');

  // Pantalla ancha: ocultar/mostrar la lista de pacientes para centrarse en la ficha
  tab('cli'); clk('#plist [data-a=selc][data-id=k1]');
  const tog = () => d.querySelector('.pane-r [data-a=ptog]');
  T('ficha: botón (flecha) para ocultar la lista, visible solo en pantalla ancha', !!tog() && tog().classList.contains('only-w') && /Ocultar/.test(tog().getAttribute('aria-label')) && !d.querySelector('.split').classList.contains('pcol'));
  clk('.pane-r [data-a=ptog]');
  T('al pulsarlo la lista se oculta y el botón pasa a «Mostrar»', d.querySelector('.split').classList.contains('pcol') && /Mostrar/.test(tog().getAttribute('aria-label')) && /Pacientes/.test(tog().textContent) && /Ana/.test(d.querySelector('.pane-r .pcab-n').textContent));
  clk('.pane-r [data-a=ptog]');
  T('al volver a pulsarlo la lista reaparece', !d.querySelector('.split').classList.contains('pcol') && nombres().length == 6);
  clk('.pane-r [data-a=ptog]'); tab('hoy'); tab('cli');
  T('al salir y volver a Pacientes la lista vuelve a verse', !d.querySelector('.split').classList.contains('pcol'));
  T('el borde del paciente seleccionado se dibuja hacia dentro (no lo recorta el panel)', /\.pi\.on\{box-shadow:inset/.test(require('fs').readFileSync(__dirname + '/../css/app.css', 'utf8')));

  // Alta de paciente
  T('panel de alta oculto al empezar', d.getElementById('pnewp').hidden);
  T('botón visible para crear paciente (flotante en móvil y botón en ancho)', !!d.querySelector('.fab[data-a=pnew]') && !!d.querySelector('button.only-w[data-a=pnew]'));
  clk('.fab[data-a=pnew]'); T('el botón abre el panel de alta', !d.getElementById('pnewp').hidden);
  clk('.fab[data-a=pnew]'); T('y lo cierra', d.getElementById('pnewp').hidden); clk('.fab[data-a=pnew]');
  set('#cn', 'Zoe Prueba'); clk('[data-a=newc]');
  T('crear paciente: se añade, queda seleccionado y se abre su ficha', S().clients.length == 7 && S().clients.some(c => c.name == 'Zoe Prueba') && /Zoe Prueba/.test(d.querySelector('.pane-r .pcab-n').textContent) && d.querySelector('.split').classList.contains('hasdet'));
  clk('[data-a=pback]'); T('el nuevo paciente aparece al final del listado alfabético, con «Sin lesiones registradas»', nombres().slice(-1)[0] == 'Zoe Prueba' && res(fila('Zoe Prueba')).textContent.trim() == 'Sin lesiones registradas' && d.getElementById('pcount').textContent == '7 pacientes');
  tab('hoy'); clk('#app [data-a=qa][data-k=cli]');
  T('«Nuevo paciente» de Hoy abre Pacientes con el panel de alta', w.eval('tab') == 'cli' && !d.getElementById('pnewp').hidden);

  // Campos de la ficha: sexo, edad y deporte
  const abrir = id => { clk('#plist [data-a=selc][data-id=' + id + ']'); if (!d.getElementById('cbirth')) clk('[data-a=pedit]'); };
  T('cada paciente es una tarjeta independiente (hijo directo de la lista)', filas().length == 7 && filas().every(f => f.parentElement.id == '' && f.parentElement.classList.contains('plist')));
  abrir('k6');
  T('ficha: tarjeta «Datos del paciente» con sexo, edad y deporte', !!d.getElementById('cbirth') && d.getElementById('cbirth').type == 'date' && !!d.getElementById('csport') && d.querySelectorAll('[data-a=psx]').length == 3);
  T('sin datos: «Sin indicar» marcado y campos vacíos', d.querySelector('[data-a=psx][data-v=""]').classList.contains('on') && d.getElementById('cbirth').value == '' && d.getElementById('csport').value == '');
  clk('[data-a=psx][data-v=f]');
  T('elegir «Mujer» guarda sex=f y se marca', S().clients.find(c => c.id == 'k6').sex == 'f' && d.querySelector('[data-a=psx][data-v=f]').classList.contains('on'));
  set('#cbirth', nac(33)); set('#csport', 'Baloncesto');
  const oscar = () => S().clients.find(c => c.id == 'k6');
  T('fecha de nacimiento y deporte se guardan en el paciente', oscar().birth == nac(33) && oscar().sport == 'Baloncesto' && !('age' in oscar()));
  T('la ficha muestra la edad calculada', d.getElementById('cedad').textContent == '33 años');
  clk('[data-a=pback]');
  T('el listado refleja icono de mujer, edad y deporte', fila('Óscar T.').querySelector('.ps').textContent == '33 años · Baloncesto' && avatar(fila('Óscar T.')) == 'f');
  buscar('baloncesto'); T('se puede buscar por el deporte recién escrito', JSON.stringify(nombres()) == '["Óscar T."]'); buscar('');
  abrir('k6'); clk('[data-a=psx][data-v=m]');
  T('cambiar a «Hombre»', oscar().sex == 'm'); clk('[data-a=pback]'); T('icono de hombre en el listado', avatar(fila('Óscar T.')) == 'm');
  abrir('k6'); clk('[data-a=psx][data-v=""]'); set('#cbirth', ''); set('#csport', '');
  T('«Sin indicar» y campos vacíos: se quitan las claves (no quedan vacías)', !('sex' in oscar()) && !('birth' in oscar()) && !('sport' in oscar()));
  set('#cbirth', '2999-01-01'); T('fecha futura no se guarda', !('birth' in oscar()));
  set('#cbirth', '1850-05-05'); T('fecha anterior a 1900 no se guarda', !('birth' in oscar()));
  clk('[data-a=pback]'); T('sin datos vuelve el icono genérico y sin línea secundaria', avatar(fila('Óscar T.')) == '' && !fila('Óscar T.').querySelector('.ps'));

  // Deporte: cuadro de texto + flecha que abre la lista de deportes ya usados en otros pacientes
  const listaAb = () => !d.getElementById('csl').hidden;
  const opts = () => [...d.querySelectorAll('#csl [data-a=spp]')].map(o => o.textContent);
  ev("st.clients.forEach(c=>{delete c.sport});render()");
  abrir('k6');
  T('el deporte es un cuadro de texto con flecha y lista oculta', d.getElementById('csport').tagName == 'INPUT' && !!d.querySelector('[data-a=spt]') && !listaAb() && d.querySelector('#csport').getAttribute('role') == 'combobox');
  clk('[data-a=spt]');
  T('sin deportes guardados, la flecha no despliega nada', !listaAb());
  set('#csport', 'Pádel');
  T('se puede escribir libremente y se guarda', S().clients.find(c => c.id == 'k6').sport == 'Pádel');
  T('lo que escribes no sale como sugerencia a ti mismo', !listaAb() && opts().length == 0);
  clk('[data-a=pback]'); abrir('k2');
  clk('[data-a=spt]');
  T('en otro paciente, la flecha abre la lista con el deporte ya usado', listaAb() && JSON.stringify(opts()) == '["Pádel"]');
  clk('[data-a=spt]'); T('la flecha vuelve a cerrar la lista', !listaAb());
  clk('[data-a=spt]'); clk('#csl [data-a=spp]');
  T('elegir de la lista lo escribe en el cuadro y lo guarda, y cierra la lista', d.getElementById('csport').value == 'Pádel' && S().clients.find(c => c.id == 'k2').sport == 'Pádel' && !listaAb());
  set('#csport', '');
  ev("st.clients.find(c=>c.id=='k5').sport='natación ';st.clients.find(c=>c.id=='k1').sport='Voleibol';st.clients.find(c=>c.id=='k4').sport='VOLEIBOL';st.clients.find(c=>c.id=='k6').sport='Fútbol';st.clients.find(c=>c.id=='k2').sport='Pádel';render()");
  abrir('k3'); clk('[data-a=spt]');
  T('sin repetir aunque cambien mayúsculas, tildes o espacios; ordenado', JSON.stringify(opts().map(x => x.trim().toLowerCase())) == JSON.stringify(['fútbol', 'natación', 'pádel', 'voleibol']));
  set('#csport', 'depor');
  T('si lo escrito no coincide con nada, la lista se oculta', !listaAb());
  set('#csport', 'volei');
  T('al escribir «volei» se sugiere Voleibol', listaAb() && JSON.stringify(opts()) == '["Voleibol"]');
  d.body.click();
  T('pulsar fuera cierra la lista', !listaAb());
  set('#csport', '   ');
  T('campo vacío: se quita la clave (no queda vacía)', !('sport' in S().clients.find(c => c.id == 'k3')));
  ev("st.clients.forEach(c=>{delete c.sport});render()");
  abrir('k3'); clk('[data-a=spt]');
  T('si ya nadie usa deportes, la lista queda vacía', !listaAb() && opts().length == 0);

  // ---- Ficha nueva (26/11/2026): cabecera, peso/altura, objetivo, pestañas, Resumen, Ver rutina/plan, atajos y actividad ----
  const css = require('fs').readFileSync(__dirname + '/../css/app.css', 'utf8');
  const pc = id => S().clients.find(c => c.id == id);
  const dato = l => { const x = [...d.querySelectorAll('#pcab .pdc')].find(e => e.querySelector('.pdl').textContent == l); return x ? x.querySelector('.pdv').textContent.trim() : null; };
  const cab = () => d.querySelector('#pcab').textContent.replace(/\s+/g, ' ');
  const rs = () => d.getElementById('pres');
  const ex0 = w.eval('all()[0].id'), ex1 = w.eval('all()[1].id');
  ev(`(()=>{const a=st.clients.find(x=>x.id=='k1');a.sex='f';a.sport='Voleibol';a.birth='${nac(28)}';pdet=false;ptab='res';pedit=false;save();render()})()`);
  clk('#plist [data-a=selc][data-id=k1]');
  T('ficha: la cabecera muestra nombre, «28 años · Voleibol», sexo y los dos grupos', d.querySelector('#pcab .pcab-n').textContent == 'Ana García' && d.querySelector('#pcab .pcab-s span').textContent == '28 años · Voleibol' && dato('Sexo') == 'Mujer' && /Equipo A/.test(d.querySelector('#pcab .pcab-g').textContent) && /Juveniles/.test(d.querySelector('#pcab .pcab-g').textContent));
  T('ficha: cabecera con 4 datos (sexo, nacimiento, peso, altura); sin peso ni altura salen «—»; sin lateralidad', dato('Peso') == '—' && dato('Altura') == '—' && d.querySelectorAll('#pcab .pdc').length == 4 && !/[Ll]ateralidad/.test(app()));
  T('ficha: pestañas Resumen · Clínica · Ejercicio · Progreso · Salto, con Resumen marcada', JSON.stringify([...d.querySelectorAll('.ptabs button')].map(b => b.textContent)) == '["Resumen","Clínica","Ejercicio","Progreso","Salto"]' && d.querySelector('.ptabs button.on').textContent == 'Resumen');
  T('el título de la tarjeta es «Resumen» (no «Resumen clínico»)', /Resumen/.test(d.querySelector('#ptabc .pct').nextElementSibling ? app() : '') && !/Resumen clínico/.test(app()));
  clk('[data-a=pedit]');
  set('#cweight', '78,5'); set('#cheight', '186');
  T('peso y altura se guardan (kg y cm) y la cabecera los muestra', pc('k1').weight == 78.5 && pc('k1').height == 186 && dato('Peso') == '78,5 kg' && dato('Altura') == '1,86 m');
  set('#cheight', '1,86'); T('la altura también se entiende en metros', pc('k1').height == 186);
  set('#cweight', '500'); set('#cheight', '999');
  T('valores imposibles no se guardan y quitan la clave', !('weight' in pc('k1')) && !('height' in pc('k1')) && dato('Peso') == '—' && dato('Altura') == '—');
  set('#cweight', '70'); set('#cweight', ''); T('vaciar el peso quita la clave (no queda vacía)', !('weight' in pc('k1')));
  set('#cgoal', 'Volver a competir sin dolor');
  T('el objetivo se guarda en el paciente (no en la lesión) y ya no existe el campo «Estimado»', pc('k1').goal == 'Volver a competir sin dolor' && !('goalEst' in pc('k1')) && !d.getElementById('cgoalest') && !/Plazo estimado/.test(app()) && !(pc('k1').cases || []).some(c => 'goal' in c));
  set('#cnotes', 'Buena evolución. Mantener progresión.'); clk('[data-a=pedit]');
  T('al cerrar la edición, el Resumen muestra objetivo y notas', !d.getElementById('cnotes') && /Volver a competir sin dolor/.test(rs().textContent) && /Buena evolución/.test(rs().textContent));
  clk('[data-a=pedit]'); set('#cgoal', ''); clk('[data-a=pedit]');
  T('sin objetivo: se quita la clave y el Resumen invita a añadirlo', !('goal' in pc('k1')) && /Sin objetivo definido/.test(rs().textContent));
  clk('#pres [data-a=pedit]'); T('«Sin objetivo definido» abre la edición', !!d.getElementById('cgoal')); clk('[data-a=pedit]');
  // Resumen: lesiones
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=k4]');
  T('Resumen: siempre 3 tarjetas (Lesión · Objetivo · Notas)', d.querySelectorAll('#pres .prs').length == 3 && JSON.stringify([...d.querySelectorAll('#pres .prl')].map(e => e.textContent)) == '["Lesiones","Objetivo","Notas"]');
  T('con dos lesiones activas: una sola tarjeta con «2 lesiones activas», cuáles son y los días', d.querySelectorAll('#pres .prs.act').length == 1 && /2 lesiones activas/.test(rs().textContent) && /Tendinopatía rotuliana · 40 días/.test(rs().textContent) && /Sobrecarga lumbar · 12 días/.test(rs().textContent) && /lesión activa/.test(cab()));
  clk('#pres .prs.act'); T('tocar esa tarjeta lleva al apartado de lesiones (pestaña Clínica) del paciente', w.eval('ptab') == 'cli' && w.eval('tab') == 'cli' && d.querySelectorAll('#ptabc .prs').length == 2);
  clk('#ptabc [data-a=fgo][data-id=c1]'); T('y desde ahí se entra en la lesión que se quiera', w.eval('tab') == 'fis' && S().fcase == 'c1');
  tab('cli'); clk('#plist [data-a=selc][data-id=k1]');
  T('con una sola lesión activa: la tarjeta lleva directa a esa lesión', d.querySelectorAll('#pres .prs.act').length == 1 && /Lesión/.test(rs().textContent) && d.querySelector('#pres .prs.act').dataset.a == 'fgo');
  tab('cli'); clk('#plist [data-a=selc][data-id=k6]');
  T('sin lesiones: tarjeta «Sin lesión activa» con símbolo de sano y sin globo de lesión activa', /Sin lesión activa/.test(rs().textContent) && /Sin lesiones registradas/.test(rs().textContent) && !!d.querySelector('#pres .prs.ok svg') && !/lesión activa/.test(cab()));
  tab('cli'); clk('#plist [data-a=selc][data-id=k5]'); T('con alta: «Última alta hace …»', /Última alta hace/.test(rs().textContent));
  // Rutina actual (la de HOY según el plan semanal) y Plan semanal (Día: rutina)
  const hoy = w.eval('paHoyIdx()'), DN = w.eval('D');
  ev(`(()=>{const c=st.clients.find(x=>x.id=='k4');const it=(e,n)=>({e:e,sets:n,reps:'8',hold:30,rest:90,load:'',note:''});c.plans=[{id:'p1',date:'${dia(3)}',name:'Fuerza tren inferior A',note:'',items:[it('${ex0}',4),it('${ex1}',3)]},{id:'p2',date:'${dia(30)}',name:'Rutina antigua',note:'',items:[it('${ex0}',3)]}];
    const h=paHoyIdx();c.weeks=[{id:'w1',date:'${dia(2)}',name:'Readaptación (semana 3/4)',note:'',days:D.map((x,i)=>({day:x,name:i==h?'Rutina Pecho':i==(h+2)%7?'Rutina Pierna':'',items:i==h?[it('${ex0}',4),it('${ex1}',3)]:i==(h+2)%7?[it('${ex0}',3)]:[]}))}];save();render()})()`);
  tab('cli'); clk('#plist [data-a=selc][data-id=k4]');
  const tarjeta = t => [...d.querySelectorAll('#ptabc .pcd')].find(e => e.querySelector('.pct b') && e.querySelector('.pct b').textContent == t);
  const rutina = () => tarjeta('Rutina actual');
  const plan = () => tarjeta('Plan semanal');
  T('Rutina actual: la rutina de HOY del plan semanal, con ejercicios y series', /Hoy · /.test(rutina().textContent) && rutina().textContent.includes('Hoy · ' + DN[hoy]) && /Rutina Pecho/.test(rutina().textContent) && /2 ejercicios · 7 series/.test(rutina().textContent) && rutina().querySelector('[data-a=pver][data-v=w]').textContent.trim() == 'Ver rutina' && rutina().querySelector('[data-a=pver]').dataset.d == String(hoy));
  const li = [...plan().querySelectorAll('.psem li')];
  T('Plan semanal: nombre del plan y los 7 días con «Día: rutina» (nada de «Sesión»)', /Readaptación \(semana 3\/4\)/.test(plan().textContent) && li.length == 7 && li[hoy].textContent == DN[hoy] + 'Rutina Pecho' && li[(hoy + 2) % 7].textContent == DN[(hoy + 2) % 7] + 'Rutina Pierna' && li[(hoy + 1) % 7].textContent == DN[(hoy + 1) % 7] + 'Descanso' && !/Sesión/.test(plan().textContent));
  T('el día de hoy sale resaltado y hay botón «Ver plan»', li[hoy].classList.contains('hoy') && li.filter(x => x.classList.contains('hoy')).length == 1 && plan().querySelector('[data-a=pver][data-v=w]').textContent.trim() == 'Ver plan');
  T('ya no hay botones «Iniciar rutina» ni «Iniciar plan»', !/Iniciar/.test(app()));
  clk('#ptabc [data-a=pver][data-v=w][data-d]'); T('«Ver rutina» abre Ejercicio, despliega el plan y marca el día de hoy', w.eval('ptab') == 'ej' && d.getElementById('pw-w1').querySelector('details').open && !!d.getElementById('pwd-w1-' + hoy) && d.getElementById('pwd-w1-' + hoy).classList.contains('hl') && /Rutina Pecho/.test(d.getElementById('pwd-w1-' + hoy).textContent));
  clk('[data-a=ptab][data-v=res]'); clk('#ptabc .pgfill [data-a=pver]'); T('«Ver plan» abre Ejercicio con el plan desplegado', w.eval('ptab') == 'ej' && d.getElementById('pw-w1').querySelector('details').open && !d.querySelector('.pwd.hl'));
  clk('[data-a=ptab][data-v=res]');
  ev(`(()=>{const c=st.clients.find(x=>x.id=='k4');c.weeks[0].days[paHoyIdx()].name='';c.weeks[0].days[paHoyIdx()].items=[];render()})()`);
  T('si hoy no hay rutina en el plan: «Hoy toca descanso» y sin botón', /Hoy toca descanso/.test(rutina().textContent) && !rutina().querySelector('[data-a=pver]'));
  const semanas = ev('JSON.stringify(cc().weeks)'); ev('cc().weeks=[];render()');
  T('sin plan semanal: la tarjeta de rutina cae a la última rutina asignada y el plan lo indica', /Última asignada/.test(rutina().textContent) && /Fuerza tren inferior A/.test(rutina().textContent) && /Sin plan semanal asignado/.test(plan().textContent));
  clk('#ptabc [data-a=pver][data-v=p]'); T('«Ver rutina» (rutina suelta) abre Ejercicio en esa rutina', w.eval('ptab') == 'ej' && !!d.getElementById('pp-p1') && /Informe PDF/.test(d.getElementById('pp-p1').textContent));
  ev(`cc().weeks=${semanas};render()`); clk('[data-a=ptab][data-v=res]');
  // Pestañas Progreso y Salto (de momento vacías)
  clk('[data-a=ptab][data-v=pro]'); T('pestaña Progreso: preparada, vacía', w.eval('ptab') == 'pro' && /Progreso/.test(d.getElementById('ptabc').textContent) && /preparación/.test(d.getElementById('ptabc').textContent));
  clk('[data-a=ptab][data-v=sal]'); T('pestaña Salto: preparada, vacía', w.eval('ptab') == 'sal' && /Salto/.test(d.getElementById('ptabc').textContent) && /preparación/.test(d.getElementById('ptabc').textContent));
  clk('[data-a=ptab][data-v=res]');
  // Atajos
  clk('[data-a=ptab][data-v=res]');
  T('atajos: Nueva lesión · Nueva rutina · Nuevo plan semanal · Añadir medición', JSON.stringify([...d.querySelectorAll('.pqa button')].map(b => b.textContent.trim())) == '["Nueva lesión","Nueva rutina","Nuevo plan semanal","Añadir medición"]');
  clk('.pqa [data-a=pnl]'); T('«Nueva lesión» lleva al formulario de lesión de este paciente', w.eval('tab') == 'fis' && S().cc == 'k4' && S().fcase == null && d.querySelector('.fisl .pane-l details').open);
  tab('cli'); clk('#plist [data-a=selc][data-id=k4]'); clk('.pqa [data-a=tab][data-k=rut]'); T('«Nueva rutina» lleva a Rutinas', w.eval('tab') == 'rut');
  tab('cli'); clk('#plist [data-a=selc][data-id=k4]'); clk('.pqa [data-a=tab][data-k=sem]'); T('«Nuevo plan semanal» lleva a Semana', w.eval('tab') == 'sem');
  tab('cli'); clk('#plist [data-a=selc][data-id=k4]'); clk('.pqa [data-a=pmed]'); T('«Añadir medición» abre el seguimiento de su lesión activa', w.eval('tab') == 'fis' && S().fcase == 'c1');
  tab('cli'); clk('#plist [data-a=selc][data-id=k6]'); clk('.pqa [data-a=pmed]'); T('sin lesión, «Añadir medición» avisa y no cambia de pantalla', w.eval('tab') == 'cli' && /Primero registra una lesión/.test(d.getElementById('msg').textContent));
  // Actividad reciente
  ev(`(()=>{const c=st.clients.find(x=>x.id=='k4');c.cases[0].entries=[{id:'n1',n:1,date:'${dia(1)}',type:'Evaluación',text:'Mejora del dolor al subir escaleras',pain:'3',meas:[]},{id:'n2',n:2,date:'${dia(20)}',type:'Tratamiento',text:'',pain:'',meas:[{k:'x',l:'Fuerza',s:'',v:'30',u:'kg'}]}];save();render()})()`);
  tab('cli'); clk('#plist [data-a=selc][data-id=k4]');
  const act = [...d.querySelectorAll('.pact li')];
  T('actividad reciente: se recorta a 2 en el Resumen, la más nueva primero', act.length == 2 && /Evaluación · Tendinopatía rotuliana/.test(act[0].textContent) && /Mejora del dolor/.test(act[0].textContent) && /EVA 3\/10/.test(act[0].textContent));
  T('actividad reciente: incluye rutina y plan asignados, ordenados por fecha', /Plan semanal asignado/.test(act[1].textContent) && /Rutina asignada/.test(w.eval('paActividad(cc(),6)')) && /1 medición/.test(w.eval('paActividad(cc(),6)')));
  clk('.plink[data-a=ptab]'); T('«Ver historial» abre la pestaña Clínica con las lesiones y «Nueva lesión»', w.eval('ptab') == 'cli' && d.querySelectorAll('#ptabc .prs').length == 2 && !!d.querySelector('#ptabc [data-a=pnl]'));
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=k1]'); T('al elegir otro paciente, la ficha vuelve a Resumen y sin edición', w.eval('ptab') == 'res' && !w.eval('pedit'));
  // Renombrar desde «Editar datos»
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=k6]'); clk('[data-a=pedit]');
  T('«Editar datos» incluye el nombre', d.getElementById('cname').value == 'Óscar T.');
  set('#cname', 'Óscar Torres'); T('renombrar: se guarda y se ve en la cabecera', pc('k6').name == 'Óscar Torres' && d.querySelector('#pcab .pcab-n').textContent == 'Óscar Torres');
  set('#cname', '   '); T('un nombre vacío no se guarda (se conserva el anterior)', pc('k6').name == 'Óscar Torres');
  clk('[data-a=pedit]'); clk('[data-a=pback]'); T('el listado refleja el nombre nuevo', nombres().includes('Óscar Torres') && !nombres().includes('Óscar T.'));
  // Crear paciente: se abre la edición para completar peso, altura, objetivo…
  clk('[data-a=pback]'); clk('.fab[data-a=pnew]'); set('#cn', 'Nuevo Fic'); clk('[data-a=newc]');
  T('paciente nuevo: se abre con «Editar datos» desplegado (objetivo, peso, altura)', w.eval('pedit') && !!d.getElementById('cgoal') && !!d.getElementById('cweight') && !!d.getElementById('cheight'));
  clk('[data-a=delc]'); clk('[data-a=delc]'); T('eliminar paciente (pide confirmar) y cierra la edición', !S().clients.some(c => c.name == 'Nuevo Fic') && !w.eval('pedit'));
  // La disposición la decide el CSS: dos columnas solo si caben (lista desplegada = una; minimizada = dos)
  T('disposición adaptable por CSS (columnas automáticas, cabecera 2×2 o 4 en fila según el ancho, últimas tarjetas igualadas por abajo)', /\.pgrid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,360px\),1fr\)\)/.test(css) && /@container \(min-width:460px\)\{\.pcab-d\{grid-template-columns:repeat\(4,1fr\)/.test(css) && /\.pgres \.pgfill\{flex:1/.test(css));
  ev("pdet=false;ptab='res';pedit=false;render()");

  // Fisioterapia: lista de lesiones minimizable en pantalla ancha y borde de la lesión seleccionada
  ev("st.cc='k4';st.fcase='c1';tab='fis';fcol=false;render()");
  const sp = () => d.querySelector('.split.fisl');
  T('lesión abierta: botón para ocultar la lista de lesiones (solo pantalla ancha) y lista visible', !!d.querySelector('.dh .ptog[data-a=ftog]') && !sp().classList.contains('pcol') && d.querySelector('.ptog').getAttribute('aria-expanded') == 'true');
  clk('[data-a=ftog]');
  T('minimizar: la lista de lesiones se oculta (clase pcol) y el botón pasa a «Lesiones»', sp().classList.contains('pcol') && /Lesiones/.test(d.querySelector('.ptog').textContent) && d.querySelector('.ptog').getAttribute('aria-expanded') == 'false');
  T('minimizada: la ficha de la lesión sigue pintada', !!d.getElementById('fcn'));
  clk('[data-a=ftog]'); T('volver a desplegar la lista', !sp().classList.contains('pcol'));
  clk('[data-a=ftog]'); clk('[data-a=fback]'); T('sin lesión abierta no hay lista minimizada', !sp().classList.contains('pcol'));
  ev("st.fcase='c1';render()"); T('al volver a abrir una lesión sigue el estado elegido (minimizada)', sp().classList.contains('pcol'));
  ev("tab='cli';render()"); clk('.nav [data-k=fis], [data-a=tab][data-k=fis]'); T('al entrar de nuevo en Fisioterapia la lista vuelve desplegada', !w.eval('fcol'));
  T('el borde de la lesión seleccionada se dibuja hacia dentro (no lo recorta el panel)', /\.li-card\.sel\{box-shadow:inset/.test(css));
  ev("fcol=false;pdet=false;ptab='res';pedit=false;tab='cli';render()");

  // Resumen: títulos e iconos más grandes
  T('Resumen: títulos de fila (Lesión, Objetivo, Notas) a 16 px y filas centradas', /\.prl\{[^}]*font-size:16px/.test(css) && /\.prs\{display:flex;align-items:center/.test(css));

  // Estado vacío
  ev("st.clients=[];st.groups=[];pdet=false;pnewOn=false;render()");
  T('sin pacientes: mensaje y cuadro de alta visible', /Aún no tienes pacientes/.test(app()) && !d.getElementById('pnewp').hidden && !d.getElementById('psq'));
  T('sin errores', errs.length == 0);
});
