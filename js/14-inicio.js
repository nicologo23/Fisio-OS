// Arranque: aplicar aspecto, pintar, almacenamiento persistente y service worker
applyUI();
$('#app').innerHTML='<div class="card empty"><b>Cargando…</b></div>';
Datos.alError=(m,e)=>{avisoGuardado(m,'guardado');if(e)console.error(e)};Datos.alOk=()=>quitarAviso('guardado');Datos.alAviso=(m,e)=>{avisoGuardado(m,'carga');if(e)console.error(e)};
Datos.iniciar().then(r=>{Object.assign(st,r.st);fixCases();save();render();Sync.iniciar();
  if(r.danados)avisoGuardado(r.danados+' registro(s) guardado(s) están dañados y no se han cargado.','carga')})
.catch(e=>{avisoGuardado((e&&e.message)||'No se han podido cargar los datos de este dispositivo.','carga');render()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='hidden')Datos.vaciar()});
addEventListener('pagehide',()=>Datos.vaciar());
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator){let hadC=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadC&&!document.getElementById('upd')){const b=document.createElement('div');b.id='upd';b.innerHTML='<span style="flex:1;min-width:150px">Hay una versión nueva de la app.</span><button class="pri" data-a="updgo">Actualizar</button>';document.body.appendChild(b)}hadC=true});navigator.serviceWorker.register('sw.js').catch(()=>{})}
