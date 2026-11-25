// Proveedor "Google Drive": inicio de sesión (Google Identity Services) y archivos en la carpeta oculta de la app (appDataFolder).
// Solo se pide el permiso drive.appdata: la app no puede ver ni modificar ningún otro archivo de tu Drive.
// El ID de cliente NO está en el código (el repositorio es público): se pega en la pantalla Datos y queda en este dispositivo.
const Drive=(()=>{
  const SCOPE='https://www.googleapis.com/auth/drive.appdata',D='https://www.googleapis.com/drive/v3/files',U='https://www.googleapis.com/upload/drive/v3/files';
  const ls={g(k){try{return localStorage.getItem(k)}catch(e){return null}},s(k,v){try{localStorage.setItem(k,v)}catch(e){}},d(k){try{localStorage.removeItem(k)}catch(e){}}};
  const err=(codigo,mensaje)=>Object.assign(new Error(mensaje),{codigo,mensaje});
  const esperar=ms=>new Promise(r=>setTimeout(r,ms));
  let cliente=null,cargando=false,pendiente=null,token=null,exp=0;
  const self={nombre:'Google Drive',alListo:null};
  // El permiso (token) dura ~1 hora; se guarda en este dispositivo para no pedirlo de nuevo si se reabre la app antes.
  try{const t=JSON.parse(ls.g('plan_tok')||'null');if(t&&t.t&&t.e>Date.now()){token=t.t;exp=t.e}}catch(e){}
  const idCliente=()=>(ls.g('plan_cid')||ls.g('pd_cid')||'').trim();
  const ponerToken=(t,seg)=>{token=t;exp=Date.now()+Math.max(60,seg-60)*1000;ls.s('plan_tok',JSON.stringify({t:token,e:exp}))};

  function iniciarCliente(){
    cliente=google.accounts.oauth2.initTokenClient({client_id:idCliente(),scope:SCOPE,
      callback:r=>{const p=pendiente;pendiente=null;if(!p)return;
        if(!r||r.error)return p.ko(err('auth','Google rechazó la conexión'+(r&&r.error?' ('+r.error+')':'')+'.'));
        if(!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE))return p.ko(err('auth','No se concedió el permiso de la carpeta oculta de Drive.'));
        ponerToken(r.access_token,+r.expires_in||3600);p.ok()},
      error_callback:e=>{const p=pendiente;pendiente=null;if(!p)return;
        p.ko(err('cancelado',e&&e.type=='popup_failed_to_open'?'El navegador ha bloqueado la ventana de Google.':'Se cerró la ventana de Google antes de terminar.'))}});
    if(self.alListo)self.alListo()}

  Object.assign(self,{
    configurado:()=>!!idCliente(),
    conectado:()=>!!token&&Date.now()<exp,
    caduca:()=>exp,
    invalidar(){token=null;exp=0;ls.d('plan_tok')},
    // Carga la librería de Google y prepara el cliente (hay que hacerlo ANTES del toque del usuario). Seguro llamarla varias veces.
    preparar(){
      if(cliente||cargando||!idCliente())return;
      if(typeof navigator!='undefined'&&navigator.onLine===false)return;
      if(window.google&&google.accounts&&google.accounts.oauth2){iniciarCliente();return}
      cargando=true;const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
      s.onload=()=>{cargando=false;try{iniciarCliente()}catch(e){}};s.onerror=()=>{cargando=false};document.head.appendChild(s)},
    // requestAccessToken tiene que ejecutarse directamente dentro del toque del usuario.
    conectar(){return new Promise((ok,ko)=>{
      if(!cliente){self.preparar();return ko(err('preparando','Google todavía está cargando (¿hay conexión?). Espera unos segundos y vuelve a pulsar.'))}
      pendiente={ok,ko};
      try{cliente.requestAccessToken()}catch(e){pendiente=null;ko(err('auth','No se pudo abrir la ventana de Google.'))}})},
    desconectar(){const t=token;self.invalidar();ls.d('plan_gok');try{if(t&&window.google&&google.accounts&&google.accounts.oauth2)google.accounts.oauth2.revoke(t,()=>{})}catch(e){}},

    async api(url,op,intento){
      intento=intento||0;
      if(!self.conectado())throw err('auth','No hay permiso activo de Google.');
      let r;
      try{r=await fetch(url,Object.assign({},op,{headers:Object.assign({Authorization:'Bearer '+token},op&&op.headers)}))}
      catch(e){throw err('red','No se pudo contactar con Google (¿sin conexión?).')}
      if(r.status==401){self.invalidar();throw err('auth','El permiso de Google ha caducado.')}
      if(r.ok)return r;
      let t='';try{t=await r.text()}catch(e){}
      const limite=r.status==429||r.status>=500||(r.status==403&&/rateLimit|quota/i.test(t));
      if(limite&&intento<3){await esperar((self.espera||800)*Math.pow(2,intento));return self.api(url,op,intento+1)}
      const e=err(r.status==404?'noexiste':'otro','Google respondió '+r.status+(t?': '+t.slice(0,160):''));e.estado=r.status;throw e},

    // Archivos de réplica: [{id,nombre,version}] (la versión cambia cada vez que el archivo se modifica)
    async listar(){
      const out=[];let pag='';
      do{const q=encodeURIComponent("name contains 'fisio-os--' and trashed=false");
        const r=await self.api(D+'?spaces=appDataFolder&pageSize=100&q='+q+'&fields='+encodeURIComponent('nextPageToken,files(id,name,version,modifiedTime)')+(pag?'&pageToken='+encodeURIComponent(pag):''));
        const j=await r.json();(j.files||[]).forEach(f=>out.push({id:f.id,nombre:f.name,version:f.version+'|'+f.modifiedTime}));pag=j.nextPageToken||''}while(pag);
      return out},
    async leer(id){
      const r=await self.api(D+'/'+id+'?alt=media');
      try{return await r.json()}catch(e){throw err('datos','Un archivo de la nube no se pudo leer (no es JSON válido).')}},
    // Escribe el archivo propio: si ya existe (id) lo actualiza; si no existe o se borró, lo crea.
    async escribir(nombre,id,doc){
      const cuerpo=JSON.stringify(doc);
      if(id){
        try{const r=await self.api(U+'/'+id+'?uploadType=media&fields=id,version,modifiedTime',{method:'PATCH',headers:{'Content-Type':'application/json'},body:cuerpo});const j=await r.json();return{id:j.id,version:j.version+'|'+j.modifiedTime}}
        catch(e){if(e.estado!=404)throw e}}
      const b='fisio'+Math.random().toString(36).slice(2);
      const meta=JSON.stringify({name:nombre,parents:['appDataFolder'],mimeType:'application/json'});
      const mp='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n'+cuerpo+'\r\n--'+b+'--';
      const r=await self.api(U+'?uploadType=multipart&fields=id,version,modifiedTime',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body:mp});
      const j=await r.json();return{id:j.id,version:j.version+'|'+j.modifiedTime}}
  });
  return self})();
Sync.registrar(Drive);
