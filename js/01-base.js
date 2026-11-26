// Constantes, estado global (st), guardado en localStorage y utilidades comunes
const AM=[["Flexión","Hombro"],["Extensión","Hombro"],["Abducción","Hombro"],["Aducción","Hombro"],["Flexión horizontal","Hombro"],["Extensión horizontal","Hombro"],["Rotación interna","Hombro"],["Rotación externa","Hombro"],["Retracción","Escápula"],["Elevación","Escápula"],["Flexión","Codo"],["Extensión","Codo"],["Flexión","Muñeca"],["Extensión","Muñeca"],["Flexión","Cadera"],["Extensión","Cadera"],["Abducción","Cadera"],["Aducción","Cadera"],["Flexión","Rodilla"],["Extensión","Rodilla"],["Flexión plantar","Tobillo"],["Flexión","Tronco"],["Extensión","Tronco"],["Rotación","Tronco"],["Estabilización isométrica","Tronco"],["Flexión","Cuello"],["Extensión","Cuello"],["Flexión dorsal","Tobillo"],["Desviación radial","Muñeca"],["Desviación cubital","Muñeca"],["Flexión lateral","Tronco"],["Flexión lateral","Cuello"],["Rotación interna","Cadera"],["Rotación externa","Cadera"],["Protracción","Escápula"],["Depresión","Escápula"],["Flexión","Pie"],["Extensión","Pie"],["Abducción","Pie"],["Aducción","Pie"],["Estabilización isométrica","Pie"]];
const G=['Pecho','Espalda','Piernas','Hombros','Bíceps','Tríceps','Core','Cardio','Otro'];
const D=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const T=[['lib','Biblioteca'],['rut','Rutinas'],['sem','Semana'],['cli','Pacientes'],['fis','Fisioterapia'],['grp','Grupos'],['dat','Datos']];
const FN=['Empuje','Tracción','Dominante de rodilla','Bisagra de cadera','Core / estabilidad','Aislamiento','Cardio','Movilidad','Rehabilitación','Otra'];
const GF={Pecho:'Empuje',Espalda:'Tracción',Piernas:'Dominante de rodilla',Hombros:'Empuje',Bíceps:'Aislamiento',Tríceps:'Aislamiento',Core:'Core / estabilidad',Cardio:'Cardio',Otro:'Otra'};
const FOV={'Peso muerto':'Bisagra de cadera','Peso muerto rumano':'Bisagra de cadera','Curl femoral':'Bisagra de cadera','Puente de glúteo':'Bisagra de cadera','Pájaros':'Tracción','Face pull':'Tracción','Elevaciones laterales':'Aislamiento','Aperturas con mancuernas':'Aislamiento','Elevación de talones':'Aislamiento','Extensión de cuádriceps':'Aislamiento','Press francés':'Aislamiento'};
const fnOf=e=>e.f||FOV[e.n]||GF[e.g]||'Otra';
let st={custom:[],routines:[],week:{},active:null,clients:[],cc:null,ov:{},groups:[]},tab='hoy',fq='',fg='',ff='',ft=[],fj=[],ed=null,fpan=false,lim=60,delArm=null,showTxt='',fe=null,fdraft={d:'',t:'Evaluación',p:'',x:'',m:[],mk:'Rango de movimiento',ms:'',mu:'°'},fopt={v:0,t:1,p:1,n:0},fsrec='',fsum='',gper='1y',gfrom='',gto='';
function fixCases(){try{const TM={'Ligamentosa / articular':'Ligamentosa','Meniscal / cartilaginosa':'Articular','Contusión':'Otra','Sobrecarga':'Otra'};st.clients.forEach(c=>(c.cases||[]).forEach(f=>{if(f.status=='En seguimiento')f.status='Activa';if(f.area){if(!String(f.name).toLowerCase().includes(String(f.area).toLowerCase()))f.name+=' - '+f.area;delete f.area}if(TM[f.type])f.type=TM[f.type];if(f.mech!==undefined){if(!f.contact)f.contact=f.mech=='Con contacto'?'Con contacto':f.mech?'Sin contacto':'';delete f.mech}if(f.ctx!==undefined)delete f.ctx}))}catch(e){}}
let _all=null;const save=()=>{_all=null;Datos.programar(()=>st)};
const seed=LIB.map(x=>({id:x[0],n:x[1],g:x[2],f:x[3],e:x[4],a:x[5],m:x[6],i:x[7],c:x[8]||[],j:x[9]||[]}));
const all=()=>_all||(_all=seed.concat(st.custom).map(e=>st.ov[e.id]?Object.assign({},e,st.ov[e.id]):e));
const byId=id=>all().find(e=>e.id===id);
const cur=()=>st.routines.find(r=>r.id===st.active)||st.routines[0];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const opts=(a,s)=>a.map(x=>`<option ${x==s?'selected':''}>${esc(x)}</option>`).join('');
function flash(t){const m=$('#msg');m.textContent=t;m.style.opacity=1;setTimeout(()=>m.style.opacity=0,1400)}
const APPV='2026.11.26-12';
