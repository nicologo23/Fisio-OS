// Arranque: aplicar aspecto, pintar, almacenamiento persistente y service worker
applyUI();render();
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator){let hadC=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadC&&!document.getElementById('upd')){const b=document.createElement('div');b.id='upd';b.innerHTML='<span style="flex:1;min-width:150px">Hay una versión nueva de la app.</span><button class="pri" data-a="updgo">Actualizar</button>';document.body.appendChild(b)}hadC=true});navigator.serviceWorker.register('sw.js').catch(()=>{})}
