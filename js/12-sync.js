// Sincronización con la nube: motor (no depende de Google) y tarjeta de la pestaña Datos.
// El proveedor (js/13-drive.js) solo sabe conectar, listar, leer y escribir archivos; todo lo demás se decide aquí.
// Reglas: la app SIEMPRE funciona con los datos locales; la nube es un extra que se sincroniza cuando se puede.
const Sync=(()=>{
  const PREF='fisio-os--';   // cada dispositivo escribe SOLO su archivo: fisio-os--<idDispositivo>.json (copia completa suya)
  const ls={g(k){try{return localStorage.getItem(k)}catch(e){return null}},s(k,v){try{localStorage.setItem(k,v)}catch(e){}},d(k){try{localStorage.removeItem(k)}catch(e){}}};
  let prov=null,corre=false,repetir=false,tm=null,diferido=false,enlazado=false;
  const S={estado:'apagado',error:'',ultima:+ls.g('plan_sync_ult')||0,res:null};
  const activado=()=>ls.g('plan_sync_on')=='1';
  const activo=()=>!!prov&&activado()&&prov.configurado();
  const hora=t=>{const d=new Date(t),h=x=>String(x).padStart(2,'0');return h(d.getHours())+':'+h(d.getMinutes())};
  const mismoDia=t=>new Date(t).toDateString()==new Date().toDateString();
  const cuando=t=>t?(mismoDia(t)?'hoy a las '+hora(t):new Date(t).toLocaleDateString('es-ES')+' a las '+hora(t)):'';

  function textoEstado(){
    if(!prov||!prov.configurado())return'Sin configurar';
    if(!activado())return'Desactivada en este dispositivo';
    const e=S.estado;
    if(e=='sincronizando')return'Sincronizando…';
    if(e=='sin-conexion')return'Sin conexión: los cambios se enviarán cuando vuelva.';
    if(e=='sin-permiso')return'Falta el permiso de Google (caduca cada hora). Pulsa «Reconectar».';
    if(e=='error')return'Error: '+S.error;
    return S.ultima?'Sincronizado '+cuando(S.ultima):'Conectado; aún sin sincronizar'}
  const textoPend=()=>{const n=Datos.pendientes();return n?n+(n==1?' cambio sin enviar':' cambios sin enviar'):'Todo enviado'};
  const nConf=()=>(st.conflicts||[]).length;

  // Símbolo + texto corto del estado para el área de estado de la navegación (k = clase de color; aten = pide atención).
  function indicador(){
    if(!prov||!prov.configurado()||!activado())return{k:'off',icono:'off',texto:'Sin sincronizar',aten:false};
    const e=S.estado,n=Datos.pendientes();
    if(e=='sin-permiso')return{k:'err',icono:'err',texto:'Falta reconectar con Google',aten:true};
    if(e=='error')return{k:'err',icono:'err',texto:'Error al sincronizar',aten:true};
    if(nConf())return{k:'warn',icono:'warn',texto:nConf()+(nConf()==1?' conflicto por revisar':' conflictos por revisar'),aten:true};
    if(e=='sincronizando')return{k:'sync',icono:'sync',texto:'Sincronizando…',aten:false};
    if(n)return{k:'pend',icono:'err',texto:n+(n==1?' cambio sin enviar':' cambios sin enviar'),aten:false};
    if(e=='sin-conexion')return{k:'off',icono:'off',texto:'Sin conexión',aten:false};
    return{k:'ok',icono:'ok',texto:'Sincronizado',aten:false}}

  function pintar(){
    if(typeof estadoPintar=='function')estadoPintar();
    const e=document.getElementById('sy-est');if(e)e.textContent=textoEstado();
    const p=document.getElementById('sy-pend');if(p)p.textContent=textoPend()}
  function fijar(e,err){S.estado=e;S.error=err||'';pintar()}

  // Pinta de nuevo la pantalla, pero sin pisar lo que se esté escribiendo en ese momento.
  function renderSeguro(){const a=document.activeElement;if(a&&a.closest&&a.closest('#app')&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){diferido=true;return}diferido=false;render()}

  async function ciclo(){
    if(!activo()){fijar('apagado');return}
    if(typeof navigator!='undefined'&&navigator.onLine===false){fijar('sin-conexion');return}
    if(!prov.conectado()){prov.preparar&&prov.preparar();fijar('sin-permiso');return}
    fijar('sincronizando');
    const tot={nuevos:0,actualizados:0,conflictos:0,recuperados:0,ignorados:0,huerfanos:0,archivos:0,subidos:0};
    try{
      await Datos.vaciar();
      const mio=PREF+Datos.id()+'.json',archivos=await prov.listar();
      const vistos=(await Datos.meta.get('sync_vistos'))||{};
      // 1) Bajar lo de los demás dispositivos y mezclarlo
      for(const f of archivos){
        if(f.nombre==mio||f.nombre.indexOf(PREF)!=0||vistos[f.id]===f.version)continue;
        const doc=await prov.leer(f.id);
        if(!doc||doc.formato!='fisio-os-sync'||!Array.isArray(doc.registros))throw Object.assign(new Error('formato'),{mensaje:'El archivo "'+f.nombre+'" de la nube no tiene el formato esperado; no se ha tocado.'});
        if(doc.esquema>Datos.esquema)throw Object.assign(new Error('esquema'),{mensaje:'Otro dispositivo usa una versión más nueva de la app. Actualiza esta app para seguir sincronizando.'});
        const r=Datos.fusionar(st,doc.registros);
        for(const k in r)tot[k]+=r[k];tot.archivos++;
        vistos[f.id]=f.version;await Datos.meta.set('sync_vistos',vistos)}
      await Datos.vaciar();
      // 2) Subir lo mío si hay algo pendiente (o si aún no existe mi archivo)
      const propio=archivos.find(f=>f.nombre==mio)||null;
      if(Datos.pendientes()>0||!propio){
        const regs=Datos.exportar();
        const doc={formato:'fisio-os-sync',esquema:Datos.esquema,dispositivo:Datos.id(),generado:new Date().toISOString(),registros:regs.map(r=>{const o=Object.assign({},r);delete o.pend;return o})};
        await prov.escribir(mio,propio?propio.id:null,doc);
        await Datos.marcarSubido(regs.filter(r=>r.pend).map(r=>({k:r.k,updatedAt:r.updatedAt,vv:r.vv})));
        tot.subidos=regs.filter(r=>r.pend).length}
      S.ultima=Date.now();ls.s('plan_sync_ult',String(S.ultima));S.res=tot;
      fijar('ok');
      if(tot.nuevos||tot.actualizados||tot.conflictos||tot.recuperados){renderSeguro();
        flash(tot.conflictos?'Sincronizado: hay '+tot.conflictos+(tot.conflictos==1?' conflicto':' conflictos')+' por revisar en Datos':'Sincronizado: se han traído cambios de otro dispositivo')}
    }catch(e){
      const c=e&&e.codigo;
      if(c=='auth'){prov.invalidar&&prov.invalidar();fijar('sin-permiso')}
      else if(c=='red'||(typeof navigator!='undefined'&&navigator.onLine===false))fijar('sin-conexion')
      else fijar('error',(e&&(e.mensaje||e.message))||'Error desconocido');
      if(typeof console!='undefined')console.error(e)}}

  let actual=Promise.resolve();
  function correr(){   // devuelve una promesa que termina cuando acaba la sincronización en curso (y la repetición pedida mientras tanto)
    if(corre){repetir=true;return actual}
    corre=true;
    actual=(async()=>{try{do{repetir=false;await ciclo()}while(repetir)}finally{corre=false}})();
    return actual}
  function pedir(motivo,ms){clearTimeout(tm);tm=setTimeout(correr,ms||0)}

  // ---- Acciones de la pantalla (data-a que empiezan por "sy") ----
  const ID_OK=/^[\w.-]+\.apps\.googleusercontent\.com$/;
  function conectar(){   // debe llamarse directamente desde el toque (si no, el navegador bloquea la ventana de Google)
    if(!prov||!prov.configurado()){flash('Primero guarda el ID de cliente de Google');return}
    prov.conectar().then(()=>{ls.s('plan_sync_on','1');fijar('ok');render();pedir('conectado',0)},
      e=>{fijar(activado()?'sin-permiso':'apagado');flash((e&&e.mensaje)||'No se completó la conexión con Google');render()})}
  function accion(a,b){
    if(a=='sycid'){const v=($('#sycid').value||'').trim();if(!ID_OK.test(v)){flash('Ese ID no tiene el formato esperado (acaba en .apps.googleusercontent.com)');return}
      ls.s('plan_cid',v);prov.preparar();render();flash('ID guardado')}
    else if(a=='syconn')conectar();
    else if(a=='synow'){if(!activo()){flash('La sincronización no está activada');return}flash('Sincronizando…');pedir('manual',0)}
    else if(a=='sydis'){ls.d('plan_sync_on');prov.desconectar();fijar('apagado');render();flash('Sincronización desactivada en este dispositivo. Tus datos siguen aquí y en Drive.')}
    else if(a=='sycuse'){const r=Datos.usarConflicto(st,b.dataset.id);if(r.ok){save();render();flash('Versión restaurada. La que había antes queda guardada aquí por si quieres volver a ella.')}else flash(r.msg)}
    else if(a=='sycdel'){const id=b.dataset.id;if(delArm!='x'+id){delArm='x'+id;render();return}Datos.descartarConflicto(st,id);delArm=null;save();render();flash('Conflicto descartado')}}

  const TIPOS={client:'Paciente',plan:'Plan',week:'Semana',case:'Lesión',entry:'Anotación',salto:'Salto',routine:'Rutina',group:'Grupo',exercise:'Ejercicio propio',override:'Ajuste de ejercicio',ajuste:'Ajustes'};
  function nombreDe(c){const d=c.data||{};return d.name||d.text||d.dx||(c.kind=='salto'?(d.tipo||'')+' '+(d.date||''):'')||(c.kind=='ajuste'&&c.rid=='semana'?'Tablero semanal':'')||''}
  function tarjeta(){
    const ok=prov&&prov.configurado(),on=activo(),con=on&&prov.conectado();
    let h='<div class="card" style="margin:8px 0"><b>Sincronización entre dispositivos</b>';
    h+='<div class="mut" style="font-size:13px;margin:4px 0">Opcional. Guarda una copia en la carpeta oculta de tu Google Drive y mantiene iPhone, iPad y ordenador al día. Sin conexión la app sigue funcionando y envía los cambios al volver.</div>';
    if(!ok){
      h+='<div class="mut" style="font-size:13px;margin:4px 0">Paso 1: pega el ID de cliente de Google de esta app.</div><div class="row"><input id="sycid" placeholder="…apps.googleusercontent.com" style="flex:1;min-width:200px"><button class="pri" data-a="sycid">Guardar ID</button></div>'}
    else if(!on){
      h+='<div class="mut" style="font-size:13px;margin:4px 0">Paso 2: conecta con tu cuenta de Google. Solo pide acceso a la carpeta oculta de esta app, no a tus archivos.</div><div class="row"><button class="pri" data-a="syconn">Conectar con Google</button></div>'}
    else{
      h+='<div style="margin:6px 0"><div id="sy-est">'+esc(textoEstado())+'</div><div class="mut" id="sy-pend" style="font-size:13px">'+esc(textoPend())+'</div></div>';
      h+='<div class="row"><button class="pri" data-a="synow">Sincronizar ahora</button>'+(con?'':'<button data-a="syconn">Reconectar</button>')+'<button data-a="sydis">Desconectar</button></div>'}
    h+='<div class="mut" style="font-size:11px;margin-top:6px">Este dispositivo: '+esc((Datos.id()||'').slice(-8))+'</div></div>';
    const cs=st.conflicts||[];
    if(cs.length){
      h+='<div class="card" style="margin:8px 0;border-color:var(--ac)"><b>Conflictos por revisar ('+cs.length+')</b><div class="mut" style="font-size:13px;margin:4px 0">Se cambió lo mismo en dos dispositivos a la vez. La app se quedó con la versión más reciente y guardó aquí la otra para que no se pierda.</div>';
      cs.forEach(c=>{const nm=nombreDe(c);
        h+='<div style="border-top:1px solid var(--bd);padding:8px 0"><div><b>'+esc(TIPOS[c.kind]||c.kind)+'</b>'+(nm?' · '+esc(String(nm).slice(0,80)):'')+'</div><div class="mut" style="font-size:12px">'+esc(new Date(c.fecha).toLocaleString('es-ES'))+'</div>'+
          '<div class="mut" style="font-size:12px;margin:4px 0;white-space:pre-wrap;word-break:break-word">'+esc(JSON.stringify(c.data).slice(0,300))+'</div>'+
          '<div class="row"><button data-a="sycuse" data-id="'+esc(c.id)+'">Usar esta versión</button><button data-a="sycdel" data-id="'+esc(c.id)+'">'+(delArm=='x'+c.id?'Confirmar: descartar':'Descartar')+'</button></div></div>'});
      h+='</div>'}
    return h}

  function registrar(p){prov=p}
  function iniciar(){
    if(!prov)return;
    if(!enlazado){enlazado=true;
      Datos.alCambios=()=>{pintar();if(activo())pedir('cambio',2500)};
      addEventListener('online',()=>{if(activo())pedir('online',500)});
      addEventListener('offline',()=>{if(activo())fijar('sin-conexion')});
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'&&activo())pedir('visible',500)});
      document.addEventListener('focusout',()=>{if(diferido)setTimeout(()=>{const a=document.activeElement;if(!(a&&a.closest&&a.closest('#app')&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))){diferido=false;render()}},60)});
      if(prov.alListo)prov.alListo=()=>{if(tab=='dat')render();pintar()}}
    if(prov.configurado())prov.preparar();
    pintar();
    if(activo())pedir('inicio',300)}

  return{registrar,iniciar,pedir,accion,tarjeta,pintar,indicador,ahora:correr,estado:()=>Object.assign({},S,{pendientes:Datos.pendientes(),texto:textoEstado()}),_ciclo:ciclo}})();
