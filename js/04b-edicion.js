// Edición de rutinas y planes semanales YA asignados a un paciente (pestaña Ejercicio de su ficha)
// Se trabaja sobre un BORRADOR (copia): solo «Guardar» cambia los datos del plan; «Cancelar» no toca nada.
// Guardar modifica ese mismo registro (conserva su id) y no toca la rutina original de «Rutinas», ni otros días, planes, semanas o pacientes.
// Estado solo en memoria: aed = {k 'p' rutina | 'w' plan semanal, id, draft copia editable, orig texto de la copia al abrir, d día abierto (planes semanales), ded fecha de inicio deducida, pick buscador de ejercicios}
let aed=null;
const aeObj=()=>{const c=cc();return c&&aed?(aed.k=='p'?(c.plans||[]).find(x=>x.id==aed.id):cw(c).find(x=>x.id==aed.id)):null};
const aeItems=()=>aed.k=='p'?aed.draft.items:aed.draft.days[aed.d].items;
const aeSucio=()=>!!aed&&JSON.stringify(aed.draft)!==aed.orig;
const aeFechaOk=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!isNaN(pd(v));
function aeRes(){const q=paNorm(aed.pick.q).trim();if(q.length<2)return'<p class="mut aehint">Escribe al menos 2 letras del nombre del ejercicio.</p>';
 const r=all().filter(e=>paNorm(e.n).includes(q)).slice(0,30);
 return r.length?r.map(e=>`<button type="button" class="aepi" data-a="aepick" data-id="${esc(e.id)}">${esc(e.n)}</button>`).join(''):'<p class="mut aehint">No hay ejercicios con ese nombre en la biblioteca.</p>'}
function aeHTML(){const d=aed.draft,w=aed.k=='w',its=aeItems(),dy=w?d.days[aed.d]:null,fd=w&&aeFechaOk(d.start)?new Date(pd(d.start)+aed.d*864e5).toISOString().slice(0,10):'';
 const cab=`<label class="lb">${w?'Nombre del plan semanal':'Nombre de la rutina'}<input id="aen" value="${esc(d.name)}"></label><label class="lb">${w?'Fecha de inicio de la semana':'Fecha de la rutina'}<input type="date" id="aef" value="${esc((w?d.start:d.date)||'')}"></label>`;
 const aviso=w?(aed.ded?'<p class="mut aenote">La fecha de inicio de este plan se había deducido de la fecha de asignación; al guardar quedará la que pongas aquí.</p>':'')+(aeFechaOk(d.start)&&new Date(pd(d.start)).getUTCDay()!=1?'<p class="mut aenote">La fecha de inicio no es lunes: el «Lunes» del plan se fechará ese día y los demás días contarán a partir de ahí.</p>':''):'';
 const dias=w?`<div class="segc aedays" role="tablist" aria-label="Días del plan semanal">${D.map((n,i)=>`<button role="tab" aria-selected="${aed.d==i}" data-a="aeday" data-d="${i}" class="${aed.d==i?'on':''}${d.days[i].name||d.days[i].items.length?' has':''}" title="${esc(n+(d.days[i].name?': '+d.days[i].name:': descanso'))}">${n.slice(0,3)}</button>`).join('')}</div>
<div class="aeday"><div class="aedh"><b>${D[aed.d]}${fd?' · '+esc(fmtC(fd)):''}</b><button type="button" data-a="aerest">Marcar como descanso</button></div><label class="lb">Rutina de este día<input id="aedn" value="${esc(dy.name)}" placeholder="Descanso (sin nombre)"></label></div>`:'';
 const lista=its.map((it,i)=>itemEd(it,i,1)).join('')||`<p class="mut aenote">${w&&!dy.name?'Día de descanso. Añade un ejercicio para convertirlo en día de entrenamiento.':'Sin ejercicios.'}</p>`;
 const pk=aed.pick?`<div class="card aepick"><b>${aed.pick.mode=='sub'?'Sustituir «'+esc((byId(its[aed.pick.i].e)||{n:'ejercicio'}).n)+'» por…':'Añadir ejercicio de la biblioteca'}</b><input id="aeq" type="search" placeholder="Buscar ejercicio…" autocomplete="off" value="${esc(aed.pick.q)}"><div id="aeres" class="aeres">${aeRes()}</div><div class="row"><button type="button" data-a="aepx">Cerrar buscador</button></div></div>`:'';
 return`<div class="card item aed" id="${w?'pw':'pp'}-${aed.id}"><div class="ih"><b>${w?'Editar plan semanal':'Editar rutina asignada'}</b></div><div class="aecab">${cab}</div>${aviso}<label class="lb">Notas generales<input id="aeo" value="${esc(d.note||'')}" placeholder="Notas de la sesión / evolución"></label>${dias}${lista}<div class="row"><button type="button" data-a="aeadd">${ic('plus',16)} Añadir ejercicio</button></div>${pk}<div class="row aebar"><button class="pri" data-a="aesave">Guardar cambios</button><button data-a="aecancel">Cancelar</button></div></div>`}
// Acciones (todas empiezan por «ae»). Devuelve true si la acción era de este archivo.
function aeAccion(a,b){const i=+b.dataset.i;
 if(a=='aeedit'){const c=cc(),o=b.dataset.k=='p'?(c.plans||[])[i]:cw(c)[i];if(!o)return true;
  if(aed&&aeSucio()&&!(aed.id==o.id)&&!confirm('Tienes cambios sin guardar en otra edición. ¿Descartarlos y abrir esta?'))return true;
  const dr=JSON.parse(JSON.stringify(o));let ded=false;if(b.dataset.k=='w'){const ini=wkInicio(o);dr.start=ini.iso;ded=ini.ded}
  aed={k:b.dataset.k,id:o.id,draft:dr,orig:JSON.stringify(dr),d:b.dataset.k=='w'?Math.max(0,dr.days.findIndex(x=>x.name||x.items.length)):0,ded,pick:null};render();return true}
 if(!aed)return false;
 if(a=='aeday'){aed.d=+b.dataset.d;aed.pick=null;render()}
 else if(a=='aeup'&&i>0){const L=aeItems();[L[i-1],L[i]]=[L[i],L[i-1]];aed.pick=null;render()}
 else if(a=='aedn'&&i<aeItems().length-1){const L=aeItems();[L[i+1],L[i]]=[L[i],L[i+1]];aed.pick=null;render()}
 else if(a=='aerm'){aeItems().splice(i,1);aed.pick=null;render()}
 else if(a=='aeadd'){aed.pick={mode:'add',i:0,q:''};render();const q=$('#aeq');if(q)q.focus()}
 else if(a=='aesub'){aed.pick={mode:'sub',i,q:''};render();const q=$('#aeq');if(q)q.focus()}
 else if(a=='aepx'){aed.pick=null;render()}
 else if(a=='aepick'){const L=aeItems(),id=b.dataset.id;
  if(aed.pick.mode=='sub'&&L[aed.pick.i])L[aed.pick.i].e=id;
  else{L.push({e:id,sets:3,reps:'10',hold:30,rest:90,load:'',note:''});if(aed.k=='w'&&!aed.draft.days[aed.d].name)aed.draft.days[aed.d].name='Sesión'}
  aed.pick=null;render()}
 else if(a=='aerest'){const dy=aed.draft.days[aed.d];dy.name='';dy.items=[];aed.pick=null;render()}
 else if(a=='aecancel'){if(aeSucio()&&!confirm('Se perderán los cambios sin guardar. ¿Cancelar la edición?'))return true;aed=null;render()}
 else if(a=='aesave'){const o=aeObj();if(!o){aed=null;flash('Este elemento ya no existe');render();return true}
  const d=aed.draft,nm=String(d.name||'').trim(),f=aed.k=='w'?d.start:d.date;
  if(!nm){flash('Pon un nombre');return true}
  if(!aeFechaOk(f)){flash(aed.k=='w'?'La fecha de inicio no es válida':'La fecha no es válida');return true}
  o.name=nm;o.note=d.note||'';
  if(aed.k=='p'){o.date=f;o.items=d.items}
  else{o.start=f;o.days=d.days.map((x,k)=>({day:x.day||D[k],name:x.items.length&&!String(x.name||'').trim()?'Sesión':String(x.name||'').trim(),items:String(x.name||'').trim()||x.items.length?x.items:[]}))}
  aed=null;save();flash('Cambios guardados');render()}
 else return false;
 return true}
// Escritura en los campos del editor (no repinta: así no se pierde el cursor; nada se guarda hasta «Guardar cambios»)
function aeInput(t){if(!aed||!t.closest||!t.closest('.aed'))return false;const d=aed.draft;
 if(t.id=='aen')d.name=t.value;
 else if(t.id=='aef'){if(aed.k=='w')d.start=t.value;else d.date=t.value}
 else if(t.id=='aeo')d.note=t.value;
 else if(t.id=='aedn')d.days[aed.d].name=t.value;
 else if(t.id=='aeq'){aed.pick.q=t.value;const r=$('#aeres');if(r)r.innerHTML=aeRes()}
 else if(t.dataset.ef){const it=aeItems()[+t.dataset.i];if(it)it[t.dataset.ef]=t.value}
 else return false;
 return true}
