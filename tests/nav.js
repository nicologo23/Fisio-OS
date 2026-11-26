// Navegación: barra inferior (móvil), panel «Más», menú lateral con «Herramientas», selección y área de estado.
const { open } = require('./lib.js');
const H = open();
H.run(async ({ w, d, clk, tab, app, T, errs, S }) => {
  const txt = sel => [...d.querySelectorAll(sel)].map(e => e.textContent.trim());
  const barra = () => txt('#tabbar button');
  const lado = () => txt('#nav .nv-main button');
  const on = sel => [...d.querySelectorAll(sel + ' button.on')].map(e => e.dataset.k || e.dataset.a);
  tab('hoy');
  T('barra inferior: Hoy · Pacientes · Fisioterapia · Grupos · Más', JSON.stringify(barra()) == JSON.stringify(['Hoy', 'Pacientes', 'Fisioterapia', 'Grupos', 'Más']));
  T('menú lateral: apartados principales en orden', JSON.stringify(lado()) == JSON.stringify(['Hoy', 'Pacientes', 'Fisioterapia', 'Grupos']));
  T('menú lateral: separador con encabezado «Herramientas»', !!d.querySelector('#nav .nv-sep') && /Herramientas/.test(d.querySelector('#nav .nv-sep').textContent));
  T('menú lateral: Biblioteca, Rutinas, Semana', JSON.stringify(txt('#nav .nv-tools button')) == JSON.stringify(['Biblioteca', 'Rutinas', 'Semana']));
  T('menú lateral: Ajustes abajo del todo', txt('#nav .nv-foot button')[0] == 'Ajustes');
  T('sin selectores internos (Rutinas|Semana, Lesiones|Grupos)', d.querySelector('#seg').innerHTML == '' && !d.querySelector('.segc'));

  // Selección y título de cada pantalla
  const titulos = { hoy: 'Hoy', cli: 'Pacientes', fis: 'Fisioterapia', grp: 'Grupos', lib: 'Biblioteca', rut: 'Rutinas', sem: 'Semana', dat: 'Ajustes' };
  for (const k of Object.keys(titulos)) {
    tab(k);
    const principal = ['hoy', 'cli', 'fis', 'grp'].includes(k);
    T(k + ': título «' + titulos[k] + '»', d.querySelector('#ttl').textContent == titulos[k]);
    T(k + ': marcado en el menú lateral', JSON.stringify(on('#nav')) == JSON.stringify([k]));
    T(k + (principal ? ': marcado en la barra y «Más» no' : ': «Más» marcado y ningún otro en la barra'),
      principal ? (JSON.stringify(on('#tabbar')) == JSON.stringify([k])) : (JSON.stringify(on('#tabbar')) == JSON.stringify(['mas'])));
    T(k + ': la pantalla pinta', app().length > 30 && !/NaN|undefined|\[object/.test(app()));
  }

  // Panel «Más»
  tab('hoy');
  T('«Más» cerrado al empezar', d.getElementById('mas').hidden && d.querySelector('#tabbar [data-a=mas]').getAttribute('aria-expanded') == 'false');
  clk('#tabbar [data-a=mas]');
  const m = d.getElementById('mas');
  T('«Más» abre el panel', !m.hidden && d.querySelector('#tabbar [data-a=mas]').getAttribute('aria-expanded') == 'true');
  T('«Más»: Biblioteca, Rutinas, Semana y Ajustes', JSON.stringify(txt('#mas .mas-hoja > button:not(.mas-est)')) == JSON.stringify(['Biblioteca', 'Rutinas', 'Semana', 'Ajustes']));
  T('«Más» abierto aparece marcado', on('#tabbar').includes('mas'));
  clk('#mas [data-a=tab][data-k=rut]');
  T('elegir Rutinas: va a Rutinas y cierra el panel', w.eval('tab') == 'rut' && d.getElementById('mas').hidden);
  clk('#tabbar [data-a=mas]');
  T('en Rutinas, el panel marca Rutinas', JSON.stringify(on('#mas')) == JSON.stringify(['rut']));
  clk('#mas [data-a=masx]');
  T('tocar fuera cierra el panel', d.getElementById('mas').hidden && w.eval('tab') == 'rut');
  clk('#tabbar [data-a=mas]'); clk('#tabbar [data-a=mas]');
  T('pulsar «Más» otra vez lo cierra', d.getElementById('mas').hidden);
  clk('#tabbar [data-a=mas]'); d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  T('Escape cierra el panel', d.getElementById('mas').hidden);
  clk('#tabbar [data-a=mas]'); clk('#tabbar [data-a=tab][data-k=cli]');
  T('elegir un apartado de la barra con el panel abierto lo cierra', d.getElementById('mas').hidden && w.eval('tab') == 'cli');
  clk('#tabbar [data-a=mas]'); clk('#mas [data-a=tab][data-k=dat]');
  T('Ajustes se abre desde «Más»', w.eval('tab') == 'dat' && /Aspecto/.test(app()));
  T('engranaje de la cabecera sigue llevando a Ajustes', (tab('hoy'), clk('.gear'), w.eval('tab') == 'dat'));

  // Hoy no cambia: accesos rápidos
  tab('hoy');
  T('Hoy: accesos rápidos intactos', /Accesos rápidos/.test(app()) && !!d.querySelector('#app [data-a=qa][data-k=nr]') && !!d.querySelector('#app [data-a=qa][data-k=cli]') && !!d.querySelector('#app [data-a=qa][data-k=fis]'));
  T('los atajos de Hoy siguen funcionando', (clk('#app [data-a=qa][data-k=fis]'), true) && errs.length == 0);

  // Área de estado: sincronización y aviso de copia
  const ver = (k, ico, texto, aten) => { w.eval(`Sync.indicador=()=>({k:'${k}',icono:'${ico}',texto:'${texto}',aten:${!!aten}});render()`); };
  const estados = [['ok', 'ok', 'Sincronizado'], ['sync', 'sync', 'Sincronizando…'], ['pend', 'err', '3 cambios sin enviar'], ['err', 'err', 'Error al sincronizar'], ['off', 'off', 'Sin sincronizar']];
  tab('hoy');
  for (const [k, ico, t] of estados) {
    ver(k, ico, t);
    T('estado «' + t + '»: símbolo en el encabezado y en el lateral', ['hdr', 'lado'].every(z => !!d.querySelector(`[data-st=${z}] .st.${k} svg`) && new RegExp(t.replace('…', '.')).test(d.querySelector(`[data-st=${z}]`).textContent)));
    T('estado «' + t + '»: el símbolo está debajo del engranaje', d.querySelector('.hr').children[0].classList.contains('gear') && d.querySelector('.hr').children[1].dataset.st == 'hdr');
  }
  clk('#tabbar [data-a=mas]');
  T('«Más» también muestra el estado', !!d.querySelector('#mas [data-st=mas] .st.off svg') || !!d.querySelector('#mas [data-st=mas] .st svg'));
  clk('#mas [data-a=masx]');
  ver('err', 'err', 'Falta reconectar con Google', true);
  T('si hay algo que atender, «Más» muestra un punto', d.querySelector('#tabbar [data-a=mas]').classList.contains('av'));
  ver('ok', 'ok', 'Sincronizado', false);
  T('sin nada que atender, no hay punto en «Más»', !d.querySelector('#tabbar [data-a=mas]').classList.contains('av'));
  clk('[data-st=lado]');
  T('pulsar el estado lleva a Ajustes', w.eval('tab') == 'dat');

  // Aviso de copia de seguridad (antes era una tarjeta arriba de cada pantalla)
  const tarjeta = () => /Aún no has guardado|no guardas una copia/.test(app());
  w.localStorage.removeItem('plan_bk'); tab('hoy');
  T('sin copia: el aviso sale en el área de estado con ⚠', /Aún no has guardado ninguna copia/.test(d.querySelector('[data-st=lado]').textContent) && !!d.querySelector('[data-st=lado] .st.warn svg') && !!d.querySelector('[data-st=hdr] .st.warn svg'));
  T('sin copia: ya no sale la tarjeta arriba de la pantalla', !tarjeta());
  T('sin copia: «Más» muestra un punto', d.querySelector('#tabbar [data-a=mas]').classList.contains('av'));
  w.localStorage.setItem('plan_bk', new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10)); tab('cli');
  T('copia antigua: «Hace 20 días…»', /Hace 20 días/.test(d.querySelector('[data-st=lado]').textContent));
  w.localStorage.setItem('plan_bk', new Date().toISOString().slice(0, 10)); tab('hoy');
  T('copia reciente: sin aviso', !/copia de seguridad/.test(d.querySelector('[data-st=lado]').textContent) && !d.querySelector('[data-st=lado] .st.warn'));
  T('sin errores', errs.length == 0);
});
