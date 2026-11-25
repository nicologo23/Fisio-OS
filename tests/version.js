// Comprobaciones estáticas de publicación: versión coherente y archivos de la caché presentes.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let bad = 0; const T = (n, c) => { if (!c) { bad++; console.log('FALLA:', n); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = rd('index.html') + fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort().map(f => rd('js/' + f)).join('\n'), sw = rd('sw.js');
const appv = (html.match(/const APPV='([^']+)'/) || [])[1];
const cache = (sw.match(/const V='plan-([^']+)'/) || [])[1];
T('index.html declara APPV', !!appv);
T('sw.js declara V', !!cache);
T('APPV (index.html) == V (sw.js): ' + appv + ' / ' + cache, appv && appv === cache);
const files = JSON.parse((sw.match(/const FILES=(\[[^\]]*\])/) || [, '[]'])[1]);
T('sw.js precarga archivos', files.length > 0);
for (const f of files) if (f !== './') T('existe ' + f, fs.existsSync(path.join(ROOT, f)));
// Todos los archivos JS (incluido sw.js) deben ser sintácticamente válidos: un sw.js roto impediría actualizar la app.
for (const f of ['sw.js'].concat(fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f))) { try { new (require('vm').Script)(rd(f), { filename: f }); T('sintaxis válida: ' + f, true); } catch (e) { T('sintaxis válida: ' + f + ' (' + e.message + ')', false); } }
const man = JSON.parse(rd('manifest.webmanifest'));
T('manifest con nombre e iconos', !!man.name && Array.isArray(man.icons) && man.icons.length > 0);
for (const i of man.icons || []) T('icono del manifest existe: ' + i.src, fs.existsSync(path.join(ROOT, i.src)));
console.log('version.js -> ' + (bad ? 'FALLOS: ' + bad : 'OK (versión ' + appv + ')')); process.exit(bad ? 1 : 0);
