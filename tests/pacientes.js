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
  T('pulsar un paciente abre su ficha', d.querySelector('.split').classList.contains('hasdet') && /Luis M\./.test(d.querySelector('.pane-r .dt').textContent) && w.eval('st.cc') == 'k2');
  T('ficha: contenido existente intacto', /Notas del paciente/.test(app()) && /Planes semanales/.test(app()) && !!d.querySelector('[data-a=delc]') && !!d.querySelector('[data-a=awc]'));
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
  T('al pulsarlo la lista se oculta y el botón pasa a «Mostrar»', d.querySelector('.split').classList.contains('pcol') && /Mostrar/.test(tog().getAttribute('aria-label')) && /Pacientes/.test(tog().textContent) && /Ana/.test(d.querySelector('.pane-r .dt').textContent));
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
  T('crear paciente: se añade, queda seleccionado y se abre su ficha', S().clients.length == 7 && S().clients.some(c => c.name == 'Zoe Prueba') && /Zoe Prueba/.test(d.querySelector('.pane-r .dt').textContent) && d.querySelector('.split').classList.contains('hasdet'));
  clk('[data-a=pback]'); T('el nuevo paciente aparece al final del listado alfabético, con «Sin lesiones registradas»', nombres().slice(-1)[0] == 'Zoe Prueba' && res(fila('Zoe Prueba')).textContent.trim() == 'Sin lesiones registradas' && d.getElementById('pcount').textContent == '7 pacientes');
  tab('hoy'); clk('#app [data-a=qa][data-k=cli]');
  T('«Nuevo paciente» de Hoy abre Pacientes con el panel de alta', w.eval('tab') == 'cli' && !d.getElementById('pnewp').hidden);

  // Campos de la ficha: sexo, edad y deporte
  T('cada paciente es una tarjeta independiente (hijo directo de la lista)', filas().length == 7 && filas().every(f => f.parentElement.id == '' && f.parentElement.classList.contains('plist')));
  clk('#plist [data-a=selc][data-id=k6]');
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
  clk('#plist [data-a=selc][data-id=k6]'); clk('[data-a=psx][data-v=m]');
  T('cambiar a «Hombre»', oscar().sex == 'm'); clk('[data-a=pback]'); T('icono de hombre en el listado', avatar(fila('Óscar T.')) == 'm');
  clk('#plist [data-a=selc][data-id=k6]'); clk('[data-a=psx][data-v=""]'); set('#cbirth', ''); set('#csport', '');
  T('«Sin indicar» y campos vacíos: se quitan las claves (no quedan vacías)', !('sex' in oscar()) && !('birth' in oscar()) && !('sport' in oscar()));
  set('#cbirth', '2999-01-01'); T('fecha futura no se guarda', !('birth' in oscar()));
  set('#cbirth', '1850-05-05'); T('fecha anterior a 1900 no se guarda', !('birth' in oscar()));
  clk('[data-a=pback]'); T('sin datos vuelve el icono genérico y sin línea secundaria', avatar(fila('Óscar T.')) == '' && !fila('Óscar T.').querySelector('.ps'));

  // Deporte: cuadro de texto + flecha que abre la lista de deportes ya usados en otros pacientes
  const listaAb = () => !d.getElementById('csl').hidden;
  const opts = () => [...d.querySelectorAll('#csl [data-a=spp]')].map(o => o.textContent);
  ev("st.clients.forEach(c=>{delete c.sport});render()");
  clk('#plist [data-a=selc][data-id=k6]');
  T('el deporte es un cuadro de texto con flecha y lista oculta', d.getElementById('csport').tagName == 'INPUT' && !!d.querySelector('[data-a=spt]') && !listaAb() && d.querySelector('#csport').getAttribute('role') == 'combobox');
  clk('[data-a=spt]');
  T('sin deportes guardados, la flecha no despliega nada', !listaAb());
  set('#csport', 'Pádel');
  T('se puede escribir libremente y se guarda', S().clients.find(c => c.id == 'k6').sport == 'Pádel');
  T('lo que escribes no sale como sugerencia a ti mismo', !listaAb() && opts().length == 0);
  clk('[data-a=pback]'); clk('#plist [data-a=selc][data-id=k2]');
  clk('[data-a=spt]');
  T('en otro paciente, la flecha abre la lista con el deporte ya usado', listaAb() && JSON.stringify(opts()) == '["Pádel"]');
  clk('[data-a=spt]'); T('la flecha vuelve a cerrar la lista', !listaAb());
  clk('[data-a=spt]'); clk('#csl [data-a=spp]');
  T('elegir de la lista lo escribe en el cuadro y lo guarda, y cierra la lista', d.getElementById('csport').value == 'Pádel' && S().clients.find(c => c.id == 'k2').sport == 'Pádel' && !listaAb());
  set('#csport', '');
  ev("st.clients.find(c=>c.id=='k5').sport='natación ';st.clients.find(c=>c.id=='k1').sport='Voleibol';st.clients.find(c=>c.id=='k4').sport='VOLEIBOL';st.clients.find(c=>c.id=='k6').sport='Fútbol';st.clients.find(c=>c.id=='k2').sport='Pádel';render()");
  clk('#plist [data-a=selc][data-id=k3]'); clk('[data-a=spt]');
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
  clk('#plist [data-a=selc][data-id=k3]'); clk('[data-a=spt]');
  T('si ya nadie usa deportes, la lista queda vacía', !listaAb() && opts().length == 0);

  // Estado vacío
  ev("st.clients=[];st.groups=[];pdet=false;pnewOn=false;render()");
  T('sin pacientes: mensaje y cuadro de alta visible', /Aún no tienes pacientes/.test(app()) && !d.getElementById('pnewp').hidden && !d.getElementById('psq'));
  T('sin errores', errs.length == 0);
});
