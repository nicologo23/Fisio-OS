// Prueba de humo: la app carga sin errores, todas las pestañas pintan, fisio/grupos/biblioteca responden.
const { open } = require('./lib.js');
const H = open();
H.run(({ w, d, clk, tab, app, S, T, K, errs, html }) => {
  T('sin errores al cargar', errs.length == 0);
  for (const t of ['hoy', 'lib', 'rut', 'sem', 'cli', 'fis', 'grp', 'dat']) {
    T('pestaña ' + t + ' existe', tab(t));
    const a = app();
    T('pestaña ' + t + ' sin NaN/undefined', !/NaN|undefined|\[object/.test(a));
    T('pestaña ' + t + ' no vacía', a.length > 30);
  }
  T('sin errores tras navegar', errs.length == 0);
  // Los 3 estilos se aplican de verdad al <html>
  tab('dat');
  for (const s of ['clinico', 'deportivo', 'ios']) {
    clk(`[data-a=ui][data-v=${s}]`);
    T('estilo ' + s + ' aplicado', d.documentElement.dataset.style === s);
  }
  T('datos persistidos', S().clients.length == 3);
  // Fisioterapia
  tab('fis'); T('lista de lesiones', /Esguince tobillo/.test(app()));
  clk('[data-a=fopen][data-id=f1]');
  T('detalle de lesión abre', /Datos de la lesión/.test(app()) && /Zona afectada/.test(app()));
  T('mapa corporal con silueta', d.querySelectorAll('svg .sil').length >= 6);
  T('zonas pintadas (2 de la demo)', d.querySelectorAll('.bz.on').length == 2);
  clk('[data-a=fz][data-z=rodilla-D]'); T('marcar zona', d.querySelectorAll('.bz.on').length == 3);
  clk('[data-a=fzclr]'); T('quitar zonas', d.querySelectorAll('.bz.on').length == 0);
  // Grupos, pacientes, biblioteca
  tab('grp'); T('grupos: resumen', /Resumen/.test(app()));
  tab('cli'); T('pacientes: lista', /Ana García/.test(app()));
  tab('lib'); T('biblioteca: ejercicios listados', d.querySelectorAll('.ex').length > 5);
  T('biblioteca: dibujos animados', d.querySelectorAll('.fig').length > 0);
  T('sin errores finales', errs.length == 0);
  // Problemas conocidos de la auditoría (no hacen fallar la suite)
  K('"Cambiar tema" escribe data-theme pero ningún CSS lo lee (botón sin efecto)', /\[data-theme/.test(html));
  K('today() usa la fecha UTC (toISOString) y no la local', !/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/.test(html));
});
