// Fecha del día según la hora LOCAL del dispositivo (zona horaria del país donde se use), no UTC.
process.env.TZ = 'Pacific/Auckland';   // UTC+13 en noviembre: de madrugada, el día UTC es el anterior
const { open } = require('./lib.js');
const H = open();
H.run(async ({ w, T, errs }) => {
  T('la prueba corre con otra zona horaria (UTC+13)', new Date(2026, 10, 26, 0, 30).getTimezoneOffset() == -780);
  T('00:30 locales cuenta como el día 26 (con UTC saldría el 25)', w.eval('fechaLocal(new Date(2026,10,26,0,30))') == '2026-11-26');
  T('23:30 locales cuenta como el día 26', w.eval('fechaLocal(new Date(2026,10,26,23,30))') == '2026-11-26');
  T('fin de año y ceros a la izquierda', w.eval('fechaLocal(new Date(2026,11,31,23,59))') == '2026-12-31' && w.eval('fechaLocal(new Date(2027,0,5,0,5))') == '2027-01-05');
  T('today() es el día local de ahora', w.eval('today()') == new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }));
  T('la edad se calcula con el día local', /^\d+ años?$/.test(w.eval("paEdad({birth:'1990-01-01'})")));
  T('sin errores', errs.length == 0);
});
