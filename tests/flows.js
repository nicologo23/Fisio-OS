// Flujos de trabajo: asignar semana, fisio completo, resumen, grupos, PDFs, copia de seguridad.
const { open } = require('./lib.js');
const H = open({ jspdf: true, wait: 900 });
H.run(async ({ w, d, clk, set, tab, app, S, T, errs }) => {
  // Semana completa -> deportista
  tab('sem'); set('#wc', 'k2'); set('#wn', 'Fase test'); clk('[data-a=aw]');
  let s = S(); const k2 = s.clients.find(c => c.id == 'k2');
  T('semana asignada a k2', (k2.weeks || []).length == 1 && k2.weeks[0].name == 'Fase test');
  T('la semana del planificador se vacía', Object.values(s.week).filter(Boolean).length == 0);
  tab('sem'); T('Nueva semana no falla', clk('[data-a=newweek]'));
  tab('rut'); T('rutinas con contenido', app().length > 50);
  // Fisio: crear, anotar, resumen, alta, reabrir
  tab('fis'); set('#cs', 'k2'); set('#fn', 'Test rodilla'); clk('[data-a=fnew]'); s = S();
  T('lesión creada', s.clients.find(c => c.id == 'k2').cases.some(f => f.name == 'Test rodilla'));
  set('#fx', 'Nota de prueba'); set('#fp', '4'); clk('[data-a=fadd]'); s = S();
  const f = s.clients.find(c => c.id == 'k2').cases.find(f => f.name == 'Test rodilla');
  T('anotación guardada con EVA', f.entries.length == 1 && f.entries[0].pain == '4');
  clk('[data-a=fsec][data-k=resumen]'); clk('[data-a=fgen]');
  T('resumen de fisioterapia generado', /RESUMEN DE FISIOTERAPIA/.test(d.querySelector('#fsumbox') ? d.querySelector('#fsumbox').value : ''));
  const est = () => S().clients.find(c => c.id == 'k2').cases.find(f => f.name == 'Test rodilla').status;
  clk('[data-a=falta]'); T('dar de alta', est() == 'Alta');
  clk('[data-a=freopen]'); T('reabrir', est() == 'Activa');
  tab('grp'); T('grupo con resumen', /Resumen/.test(app()));
  // PDFs (se prueba la construcción; guardar/compartir depende del navegador real)
  try {
    const r = await w.eval(`(async()=>{PDFX.png=async()=>'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';const c=st.clients.find(x=>x.id=='k1');const a=await buildPDF(specPlan(c,c.plans[0])),b=await buildPDF(specWeek(c,c.weeks[0])),g=st.groups[0],e=await buildGroupPDF(grpReport(g));return [a,b,e].map(x=>x.getNumberOfPages()+':'+x.output('arraybuffer').byteLength).join(',')})()`);
    T('3 PDFs generados (rutina, semana, grupo)', r.split(',').every(x => +x.split(':')[0] >= 1 && +x.split(':')[1] > 2000));
  } catch (e) { T('PDFs: ' + e.message, false); }
  // Copia de seguridad: exportar texto -> importar texto
  tab('dat'); clk('[data-a=exp]'); const bk = d.querySelector('#bk').value;
  T('exportar copia (JSON válido)', bk.length > 1000 && JSON.parse(bk).clients.length == 3);
  set('#bk', bk); clk('[data-a=imp]'); T('importar copia', S().clients.length == 3);
  T('sin errores JS', errs.length == 0);
});
