// Utilidades comunes de las pruebas. Abre la app en jsdom con datos FICTICIOS (demo.js).
// Uso: APP_FILE=planificador.html npm test   (por defecto prueba index.html de la raíz)
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const demo = require('./demo.js');
const ROOT = path.resolve(__dirname, '..');
const APP = path.resolve(ROOT, process.env.APP_FILE || 'index.html');

function open(opts = {}) {
  const { jspdf = false, wait = 900 } = opts;
  const raw0 = fs.readFileSync(APP, 'utf8');
  const dir = path.dirname(APP), rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
  // jsdom no descarga archivos externos: se incrustan los CSS y JS locales en la página (jsPDF se evalúa aparte).
  const raw = raw0
    .replace(/<script src="[^"]*jspdf[^"]*"><\/script>/, '')
    .replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, f) => '<style>' + rd(f) + '</style>')
    .replace(/<script src="(?!https?:)([^"]+)"><\/script>/g, (m, f) => '<script>' + rd(f) + '</script>');
  const html = raw;
  const errs = [];
  let ok = 0, bad = 0;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.localStorage.setItem('plan_v1', JSON.stringify(demo()));
      w.localStorage.setItem('plan_bk', new Date().toISOString().slice(0, 10));
      w.addEventListener('error', e => errs.push(e.message));
      w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; // jsPDF 4.x las necesita
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = () => {};
    }
  });
  const w = dom.window, d = w.document;
  if (jspdf) w.eval(fs.readFileSync(path.join(ROOT, 'jspdf.umd.min.js'), 'utf8'));
  const H = {
    w, d, errs, html: raw, file: APP,
    clk(sel) { const e = d.querySelector(sel); if (!e) { console.log('  (no existe ' + sel + ')'); return false; } e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return true; },
    set(sel, v) { const e = d.querySelector(sel); e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true })); },
    S: () => JSON.parse(w.localStorage.getItem('plan_v1')),
    app: () => d.querySelector('#app').textContent,
    tab: k => H.clk(`[data-a=tab][data-k=${k}]`),
    T(name, cond) { if (cond) ok++; else { bad++; console.log('FALLA:', name); } },
    // Problema conocido (ver CLAUDE.md): no hace fallar la suite. Si algún día se corrige, avisa.
    K(name, fixed) { console.log(fixed ? 'RESUELTO (actualiza CLAUDE.md): ' : 'CONOCIDO (pendiente): ', name); },
    finish() { console.log(path.basename(APP) + ' -> OK: ' + ok + '  FALLOS: ' + bad + (errs.length ? '  ERRORES JS: ' + errs.slice(0, 3).join(' | ') : '')); process.exit(bad ? 1 : 0); },
    run(fn) { setTimeout(async () => { try { await fn(H); } catch (e) { console.log('EXCEPCIÓN:', e.stack); bad++; } H.finish(); }, wait); }
  };
  return H;
}
module.exports = { open };
