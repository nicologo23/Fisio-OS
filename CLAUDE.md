# CLAUDE.md — Planificador de entrenamiento y fisioterapia

Instrucciones para Claude (y cualquier otro asistente) al trabajar en este repositorio.
Basado en la auditoría técnica del 24/11/2026. Si algo de aquí contradice el código, manda el código: avisa y corrige este archivo.

## Qué es
- App web original (inspirada en Harbiz, no una copia) para **planificar entrenamientos** y **seguir tratamientos de fisioterapia** de deportistas.
- Usuario: un único fisioterapeuta/preparador que trabaja solo, en **iPhone y iPad** (Safari, instalada como PWA). Interfaz y textos en **español**; los nombres de ejercicios pueden quedar en inglés.
- Sin servidor, sin cuentas, sin sincronización entre dispositivos. Los datos viven **en el navegador de cada dispositivo** (IndexedDB, base de datos `fisio-os`). La sincronización entre dispositivos está **planificada, no implementada** (ver "Almacenamiento y sincronización").

## Fase actual: desarrollo, sin datos reales
- Decisión del usuario (25/11/2026): la app **no tiene datos reales** y seguirá así hasta tener el producto final, para no estar exportando/importando en cada cambio. No hace falta pedirle copias de seguridad al publicar mientras siga en esta fase.
- Por eso ahora es el momento más barato de cambiar el modelo de datos o el almacenamiento (no hay nada que migrar). **Antes del lanzamiento** hay que decidir dónde se guardan los datos reales (ver "Almacenamiento y sincronización") y, a partir de que existan datos reales, aplica la regla nº 1 al pie de la letra.
- Hablar de datos reales (dónde guardarlos, copias, privacidad) está **pendiente**: el usuario lo retomará cuando toque.

## Regla nº 1: los datos del usuario son lo más valioso (obligatoria en cuanto haya datos reales)
- Nunca cambiar la forma de `st`, los registros de IndexedDB (`js/00-datos.js`) ni las claves de localStorage (`plan_ui`, `plan_bk`, `plan_v1` antigua) sin una migración que conserve los datos existentes y sin probarla.
- Cualquier cambio que borre, sobrescriba o importe datos debe pedir confirmación al usuario y ser reversible o ir precedido de una copia.
- **Este repositorio es público.** No subir nunca datos reales de deportistas o pacientes, ni copias de seguridad (`Planificador_copia_*.json`). Las pruebas usan datos ficticios (`tests/demo.js`).
- No añadir claves API, credenciales ni servicios externos sin hablarlo antes. Hoy no hay ninguno.

## Archivos del repositorio (raíz = lo que se publica en GitHub Pages)
No hay paso de compilación: lo que está en el repositorio es lo que se publica y lo que se edita.
| Archivo | Para qué sirve |
|---|---|
| `index.html` | Solo la estructura de la página (cabecera, contenedores) y la carga de los demás archivos. |
| `css/app.css` | Todos los estilos (3 estilos visuales, claro/oscuro, iPhone/iPad/ordenador). |
| `datos/ejercicios.js` | Biblioteca `LIB`: 909 ejercicios en una sola línea (~680 KB). **No abrir entero**: leerlo por trozos o con búsquedas. Cambia rara vez. |
| `js/00-datos.js` | **Capa de datos**: `Datos` (IndexedDB, registros sincronizables) y `uid()`. Ver abajo. |
| `js/01-base.js` … `js/12-inicio.js` | Toda la lógica, dividida por temas y numerada **en orden de carga** (ver tabla de abajo). Primera línea de cada archivo: qué contiene. |
| `sw.js` | Service worker: caché primero, precarga los archivos de `FILES` y activa la nueva versión al instante. |
| `manifest.webmanifest`, `icon-*.png` | Instalación como PWA. |
| `jspdf.umd.min.js` | jsPDF 4.2.1 en local (PDFs sin internet). |
| `tests/`, `package.json` | Pruebas automáticas (ver abajo). `node_modules/` no se sube. |

Orden de carga (scripts clásicos, sin módulos; comparten el ámbito global, así que una función de un archivo se puede usar desde otro): `jspdf` → `datos/ejercicios.js` → `js/00…12`. El orden está en `index.html` y la precarga en `sw.js`.

| Archivo | Contenido |
|---|---|
| `01-base.js` | Constantes, estado `st` (vacío al cargar el script), `save()` (→ `Datos.programar`), `all()/byId()`, utilidades (`$`, `esc`, `flash`), `APPV` |
| `02-dibujos.js` | Figuras de palitos: posturas `PO/PF`, reglas `AR/SR/FIX`, `frame`, `pic` |
| `03-biblioteca.js` | Filtros, editor de ejercicio, `lib()`, `list()`, tarjeta `card` |
| `04-planificacion.js` | Deportistas (`cli`), rutinas (`rut`), semana (`sem`), `addToR` |
| `05-fisioterapia.js` | Lesiones (`fis`, `fdet`), mapa corporal (`ZN`, `bodyChart`), severidad (`sev`), recaídas, resumen |
| `06-pdf.js` | `buildPDF`, `buildGroupPDF`, `pdfSave` y compartir/descargar |
| `07-grupos.js` | `grpReport` (cálculo), `grpView`, `grp()` |
| `08-aspecto.js` | `ui`, `applyUI`, iconos, `nav()`, ajustes de aspecto |
| `09-hoy.js` | Pantalla Hoy |
| `10-copias.js` | Copias de seguridad, aviso de 14 días, pantalla Datos |
| `11-eventos.js` | `V`, `render()`, listeners `click/input/change` (acciones `data-a`) |
| `12-inicio.js` | Arranque **asíncrono**: `Datos.iniciar()` → `Object.assign(st,…)` → `fixCases()` → `render()`; vaciado al ocultar la página; service worker |

**Al añadir un archivo JS**: añadirlo a `index.html` (en su sitio del orden) y a `FILES` de `sw.js`. Las sentencias que se ejecutan al cargar (p. ej. `fixCases()`, `ZN.forEach`, `Object.assign(PO,…)`) dependen del orden; las funciones y constantes que solo se usan dentro de funciones pueden estar en cualquier archivo anterior a `12-inicio.js`.

## Arquitectura (resumen; buscar por nombre, los números de línea cambian)
- JavaScript sin framework, sin módulos ni compilación (`js/*.js`). Vistas = funciones que devuelven HTML en plantillas y se pintan con `innerHTML`.
- `render()` → `V[tab]()`; pestañas: `hoy, lib, rut, sem, cli, fis, grp, dat`.
- Estado global `st` en memoria (la interfaz lo modifica directamente y llama a `save()`). `save()` no escribe a mano: avisa a `Datos`, que a los 150 ms compara `st` con lo ya guardado y escribe **solo los registros que cambiaron**. Preferencias visuales en `ui` (`plan_ui`), aplicadas con `applyUI()` (atributos `data-style` y `data-mode` en `<html>`).
- Eventos: 3 listeners delegados (`click`, `input`, `change`). Cada botón lleva `data-a="acción"`; el manejador es una cadena larga de `else if(a=='…')`. Hay ~70 acciones.
- Biblioteca: `LIB` (909 ejercicios: 876 de free-exercise-db + 33 semillas en español), `all()`, `byId()`, personalizados en `st.custom`, ediciones en `st.ov`.
- Ilustraciones: dibujos SVG de figura de palitos generados por código (`PO`, `PF`, `AR`, `pic`…), animados con CSS.
- Fisioterapia: `ZN` (52 zonas del cuerpo), `bodyChart(f)`, `sev()`/`sevLevel()` (gravedad por días de baja), `grpReport(g)` (informe de grupo).
- PDFs: `buildPDF`, `buildGroupPDF`, `pdfSave` (en iOS usa la hoja de compartir; si no, descarga).
- Copias: `expFile` / `exp` (exportar `st` como JSON), `imp` y `#impf` (importar: sustituye todo; lo que falte queda como lápida), aviso a los 14 días (`bkBanner`).
- Avisos fijos en rojo `#saveerr` (`avisoGuardado`, en `10-copias.js`): fallo al guardar (desaparece al guardar bien) o datos dañados/antiguos ilegibles (permanece).

## Modelo de datos (`st`)
```
st = { custom:[], routines:[{id,name,items:[{e,sets,reps,hold,rest,load,note}]}],
       week:{0..6:routineId}, active, ov:{}, groups:[{id,name,members:[clientId]}], gsel, cc, fcase,
       clients:[{ id,name,notes, plans:[{id,date,name,note,items}], weeks:[{id,date,name,note,days}],
                  cases:[{ id,name,status:'Activa'|'Alta',opened,closed,dx,type,act,contact,moment,zones:[zoneId],
                           entries:[{id,n,date,type,text,pain,meas:[{k,l,s,v,u}]}] }] }] }
```
Las lesiones (`cases`) cuelgan del deportista; los grupos solo guardan ids de deportistas. No hay registro de entrenamientos **ejecutados** (solo planificados) ni exposición en horas (decisión del usuario).

## Almacenamiento y sincronización
**Decisiones del usuario (25/11/2026):** quiere los mismos datos en iPhone, iPad y ordenador (Windows con Opera); cada dispositivo guarda una **copia completa** local (funciona sin internet) y un sitio en la nube hace de punto de encuentro; solo texto y datos (sin fotos ni vídeos por ahora); usa apodos, no nombres reales. Quiere un servicio **gratuito** con inicio de sesión, de modo que los datos de cada persona queden en su propia cuenta (si otros usan la app desde la dirección del repositorio, entran con sus credenciales). **Ruta elegida el 25/11/2026: opción A = Google Drive, carpeta oculta `appDataFolder` de cada usuario (permiso `drive.appdata`), con inicio de sesión de Google.** Alternativas descartadas por ahora: Firebase (Spark) y Supabase (el gratuito se pausa; el correo integrado es muy limitado). Sin servidor propio no se guardan datos de nadie. **Riesgo por comprobar:** el inicio de sesión de Google dentro de la app instalada en iPhone/iPad (ventanas emergentes en modo "pantalla de inicio") y la caducidad del permiso (~1 h, se renueva con un toque del usuario). Si la prueba falla en iOS, reevaluar (Firebase/Supabase).

**Hecho (fase A, local):** `js/00-datos.js`.
- IndexedDB `fisio-os` v1: almacén `registros` (clave `k = tipo/id`) y `meta` (`deviceId`, `esquema`, `sel`).
- `st` (anidado) se aplana en registros `{k,id,kind,parent,ord,data,updatedAt,deletedAt}`. Tipos: `client, plan, week, case, entry, routine, group, exercise, override, ajuste` (`ajuste/semana` = tablero semanal `st.week`; `ajuste/resto` = campos sueltos desconocidos). `parent` = id del padre (cliente para plan/week/case, lesión para entry); `ord` = posición en su lista.
- Borrar = **lápida** (`deletedAt` + `data:null`), no se elimina el registro: así el borrado se podrá sincronizar.
- Selecciones de este dispositivo (`active, gsel, cc, fcase`) van en `meta.sel` y **no** se sincronizarán. Preferencias visuales (`plan_ui`) y fecha de copia (`plan_bk`) siguen en localStorage (por dispositivo).
- Nunca se borran solos los registros que no se pudieron cargar (dañados u huérfanos): quedan `retenido`.
- `uid(prefijo)` genera ids únicos entre dispositivos (úsalo siempre; nunca `Date.now()` solo).
- Migración: al primer arranque, si IndexedDB está vacía y hay `plan_v1` en localStorage, se importa y se marca `plan_v1_migrado`; la copia antigua **no se borra**.
- `Datos.registros(desde)` devuelve los registros (con lápidas) modificados después de `desde`: es la base de la sincronización.

**En curso (fase B0, prueba de viabilidad):** `prueba-drive.html` (raíz) es una página **aparte y temporal** que prueba inicio de sesión de Google (ventana emergente y redirección) y guardar/leer un archivo en `appDataFolder`; no toca la app ni los datos. `sw.js` la deja pasar sin caché (rutas que contienen `/prueba-`). El ID de cliente de Google no es un secreto (se puede subir al repositorio), pero nunca subir tokens ni secretos de cliente. Cuando la prueba haya servido, borrar `prueba-drive.html` y la excepción de `sw.js`.

**Pendiente (fase B, sincronización):** elegir el formato en Drive (cada dispositivo escribe su propio archivo y los demás lo fusionan por registro, o un archivo único; Drive guarda archivos, no es una base de datos); registros con las mismas columnas; subir los cambios locales (`updatedAt > último envío`), bajar los remotos y aplicarlos (el más reciente gana, por registro); descarga completa al abrir en un dispositivo nuevo; limpiar lápidas antiguas ya sincronizadas; relojes: usa la hora del dispositivo, vigilar desajustes; instalar la app en el ordenador (Opera: comprobar). Ya hay un hueco para ello: no hace falta tocar el resto de la app. Antes del lanzamiento: RGPD (datos de salud aunque sean apodos), copia de seguridad en la nube, y decidir qué pasa si falla el servicio (la app debe seguir funcionando en local).

## Problemas conocidos (no arreglar de pasada: pedir confirmación)
Detalle y gravedad en la auditoría (sección 13). Los más importantes:
- (Resueltos con la capa de datos: fallo de escritura silencioso y sobrescritura de datos corruptos; ahora hay aviso rojo y los registros dañados se conservan.)
- Importar una copia **sustituye todo sin pedir confirmación**.
- El botón "Cambiar tema" escribe `data-theme`, que ningún CSS lee: no hace nada (regresión del rediseño).
- `today()` usa `toISOString()` (UTC): cerca de medianoche puede dar el día anterior/siguiente.
- Editar una anotación clínica solo permite cambiar texto y fecha; añadir una exige texto o medida.
- Borrar una rutina deja su id huérfano en `st.week`; borrar un deportista lo deja en `members` de los grupos (el informe lo ignora).
- Todo comparte el ámbito global (nombres de variables y funciones): al añadir algo, comprobar que el nombre no existe ya (`grep`). Cambios pequeños y probados.

## Pruebas
- `npm install` (una vez) y `npm test`. Usan jsdom y `fake-indexeddb` con datos ficticios; salen con código distinto de 0 si algo falla.
- `tests/version.js`: `APPV` == versión de `sw.js`, los archivos precargados y los iconos del manifest existen.
- `tests/datos.js`: migración desde localStorage, guardar solo lo cambiado, reabrir, lápidas, orden, ids repetidos, registros dañados/huérfanos, fallo de escritura y reintento, dispositivo nuevo (usa `fake-indexeddb`).
- `tests/smoke.js`: carga sin errores, las 8 pestañas pintan, 3 estilos, mapa corporal, biblioteca, fisio/grupos.
- `tests/flows.js`: asignar semana, lesión → anotación → resumen → alta → reabrir, 3 PDFs, exportar/importar copia.
- Los "CONOCIDO" que imprime no fallan la suite; cuando se arregle uno aparecerá como "RESUELTO": actualizar la lista de arriba.
- **No cubren**: aspecto visual, iPhone/iPad reales, instalación PWA, actualización del service worker, compartir PDF, rendimiento. Eso se prueba a mano (lista de comprobaciones en la auditoría, sección 15-H).
- Al añadir una función nueva, añadir su prueba. Probar con `APP_FILE=otro.html npm test` si se trabaja con otro archivo.

## Cómo trabajar con el usuario
- Si hay dudas sobre si modificar algo, **preguntar antes** y cambiar después de su respuesta.
- Estadísticas descriptivas sin nombres, salvo que haga falta. Él anonimiza los nombres de deportistas.
- Prioridad: conservar y mejorar lo que ya funciona; nada de reescribir todo sin justificación técnica.
- La marca/identidad visual está aplazada: no proponerla sin que la pida.
- Tras cambiar algo: `npm test` y subir versión (`APPV` + `sw.js`). Cuando haya datos reales: avisar al usuario de que haga una copia antes de publicar.
