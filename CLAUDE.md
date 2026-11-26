# CLAUDE.md — Planificador de entrenamiento y fisioterapia

Instrucciones para Claude (y cualquier otro asistente) al trabajar en este repositorio.
Basado en la auditoría técnica del 24/11/2026. Si algo de aquí contradice el código, manda el código: avisa y corrige este archivo.

## Qué es
- App web original (inspirada en Harbiz, no una copia) para **planificar entrenamientos** y **seguir tratamientos de fisioterapia** de deportistas.
- Usuario: un único fisioterapeuta/preparador que trabaja solo, en **iPhone y iPad** (Safari, instalada como PWA). Interfaz y textos en **español**; los nombres de ejercicios pueden quedar en inglés.
- Sin servidor propio. Los datos viven **en el navegador de cada dispositivo** (IndexedDB, base de datos `fisio-os`) y, si el usuario lo activa, se sincronizan entre dispositivos a través de la carpeta oculta de **su** Google Drive (ver "Almacenamiento y sincronización" y `docs/sincronizacion.md`). La app funciona igual sin conexión y sin Google.

## Alcance: uso personal, un solo usuario, datos ficticios (decisión del usuario, 25/11/2026)
- Fisio-OS es de **uso exclusivamente personal y de un único usuario**. Se usan **siempre datos ficticios** (apodos inventados), nunca datos clínicos ni personales de pacientes reales. Por tanto **no** se desarrolla documentación de protección de datos de pacientes (RGPD), ni cifrado propio extra, ni cuentas profesionales: se usa la cuenta gratuita de Google del usuario y el cifrado de Google + HTTPS. La política de privacidad se queda en el mínimo que exige Google (`privacidad.html`).
- **Si algún día se quisieran usar datos reales de pacientes, hay que parar y volver a decidir** (RGPD de datos de salud, contratos con Google, cifrado, acuerdos de tratamiento, copia de seguridad). Está resumido en `docs/sincronizacion.md`, apartado "Si algún día hubiera datos reales".
- Como los datos son ficticios, cambiar el modelo de datos es barato, pero **ahora hay sincronización**: cualquier cambio de la forma de los registros necesita migración probada en todos los dispositivos (ver regla nº 1).

## Regla nº 1: los datos del usuario son lo más valioso (obligatoria; con la sincronización también cuenta aunque sean ficticios)
- Nunca cambiar la forma de `st`, los registros de IndexedDB (`js/00-datos.js`) ni las claves de localStorage (`plan_ui`, `plan_bk`, `plan_v1` antigua) sin una migración que conserve los datos existentes y sin probarla.
- Cualquier cambio que borre, sobrescriba o importe datos debe pedir confirmación al usuario y ser reversible o ir precedido de una copia.
- **Este repositorio es público.** No subir nunca datos reales de deportistas o pacientes, ni copias de seguridad (`Planificador_copia_*.json`). Las pruebas usan datos ficticios (`tests/demo.js`).
- No añadir claves API, credenciales ni servicios externos sin hablarlo antes. El único servicio externo es Google (inicio de sesión + carpeta oculta de Drive del propio usuario), sin ninguna clave ni ID en el código.

## Archivos del repositorio (raíz = lo que se publica en GitHub Pages)
No hay paso de compilación: lo que está en el repositorio es lo que se publica y lo que se edita.
| Archivo | Para qué sirve |
|---|---|
| `index.html` | Solo la estructura de la página (cabecera, contenedores) y la carga de los demás archivos. |
| `css/app.css` | Todos los estilos (3 estilos visuales, claro/oscuro, iPhone/iPad/ordenador). |
| `datos/ejercicios.js` | Biblioteca `LIB`: 909 ejercicios en una sola línea (~680 KB). **No abrir entero**: leerlo por trozos o con búsquedas. Cambia rara vez. |
| `js/00-datos.js` | **Capa de datos**: `Datos` (IndexedDB, registros sincronizables) y `uid()`. Ver abajo. |
| `js/01-base.js` … `js/14-inicio.js` | Toda la lógica, dividida por temas y numerada **en orden de carga** (ver tabla de abajo). Primera línea de cada archivo: qué contiene. |
| `sw.js` | Service worker: caché primero, precarga los archivos de `FILES` y activa la nueva versión al instante. |
| `manifest.webmanifest`, `icon-*.png` | Instalación como PWA. |
| `googlee66ed85ab908e76c.html` | Verificación de propiedad de la página en Google Search Console (la pide la verificación de marca de Google). **No borrar ni cambiar.** |
| `jspdf.umd.min.js` | jsPDF 4.2.1 en local (PDFs sin internet). |
| `tests/`, `package.json` | Pruebas automáticas (ver abajo). `node_modules/` no se sube. |

Orden de carga (scripts clásicos, sin módulos; comparten el ámbito global, así que una función de un archivo se puede usar desde otro): `jspdf` → `datos/ejercicios.js` → `js/00…14`. El orden está en `index.html` y la precarga en `sw.js`.

| Archivo | Contenido |
|---|---|
| `01-base.js` | Constantes, estado `st` (vacío al cargar el script), `save()` (→ `Datos.programar`), `all()/byId()`, utilidades (`$`, `esc`, `flash`), `APPV` |
| `02-dibujos.js` | Figuras de palitos: posturas `PO/PF`, reglas `AR/SR/FIX`, `frame`, `pic` |
| `03-biblioteca.js` | Filtros, editor de ejercicio, `lib()`, `list()`, tarjeta `card` |
| `04-planificacion.js` | Pacientes (`cli`), rutinas (`rut`, arrastrando el bloque o el asa para reordenar ejercicios), semana (`sem`), `addToR` |
| `05-fisioterapia.js` | Lesiones (`fis`, `fdet`), mapa corporal (`ZN`, `bodyChart`), severidad (`sev`), recaídas, resumen |
| `06-pdf.js` | `buildPDF`, `buildGroupPDF`, `pdfSave` y compartir/descargar |
| `07-grupos.js` | `grpReport` (cálculo), `grpView`, `grp()` |
| `08-aspecto.js` | `ui`, `applyUI`, iconos, **navegación** (`TABS`, `NAV_MAIN/NAV_TOOLS/NAV_MAS`, `nav()`, `estadoPintar()`, panel «Más» con `masOn`), ajustes de aspecto |
| `09-hoy.js` | Pantalla Hoy |
| `10-copias.js` | Copias de seguridad, aviso de 14 días, pantalla Datos |
| `11-eventos.js` | `V`, `render()`, listeners `click/input/change` (acciones `data-a`) |
| `12-sync.js` | **Motor de sincronización** (`Sync`, no depende de Google): ciclo bajar → mezclar → subir, estado, tarjeta de la pestaña Datos, acciones `data-a="sy…"` |
| `13-drive.js` | **Proveedor Google Drive** (`Drive`): inicio de sesión (Google Identity Services) y archivos en `appDataFolder`. Para cambiar de proveedor solo hay que escribir otro con la misma interfaz (ver `docs/sincronizacion.md`) |
| `14-inicio.js` | Arranque **asíncrono**: `Datos.iniciar()` → `Object.assign(st,…)` → `fixCases()` → `render()` → `Sync.iniciar()`; vaciado al ocultar la página; service worker |

**Al añadir un archivo JS**: añadirlo a `index.html` (en su sitio del orden) y a `FILES` de `sw.js`. Las sentencias que se ejecutan al cargar (p. ej. `fixCases()`, `ZN.forEach`, `Object.assign(PO,…)`) dependen del orden; las funciones y constantes que solo se usan dentro de funciones pueden estar en cualquier archivo anterior a `14-inicio.js`.

## Arquitectura (resumen; buscar por nombre, los números de línea cambian)
- JavaScript sin framework, sin módulos ni compilación (`js/*.js`). Vistas = funciones que devuelven HTML en plantillas y se pintan con `innerHTML`.
- `render()` → `V[tab]()`; pestañas: `hoy, lib, rut, sem, cli, fis, grp, dat`.
- **Navegación (26/11/2026):** barra inferior Hoy · Pacientes · Fisioterapia · Grupos · Más (Más = Biblioteca, Rutinas, Semana, Ajustes); menú lateral (≥820 px) con los 4 principales, separador «Herramientas» (Biblioteca, Rutinas, Semana) y Ajustes abajo. Cada pantalla es independiente (ya no hay selectores Rutinas|Semana ni Lesiones|Grupos). Área de estado (`data-st`: encabezado bajo el engranaje, lateral y panel «Más»): símbolo de sincronización (`Sync.indicador()`: ✓ verde, flechas azules girando, ✗ roja sutil, neutro) y aviso de copia (⚠). **Ya no hay tarjeta de aviso (26/11/2026):** cuando hay que actuar (reconectar, error, conflictos, copia pendiente) sale un **globito rojo** (`.dot`) en «Más» (barra inferior) y en «Ajustes» (menú lateral y panel «Más», envuelto en `.nvi`), más el símbolo de estado; el detalle y el botón «Reconectar» están en Datos. `estadoPintar()` activa la clase `av`. El menú lateral es `position:fixed` (`#content` lleva margen izquierdo de 92/232 px). En la barra inferior la pestaña activa lleva fondo `--fill` (como el lateral).
- **Listado de Pacientes (26/11/2026, estilo «lista de chats»):** una tarjeta por paciente (`paFila`): icono en círculo tintado con el color de acento, estilo de línea (`pers` neutro; `persM` hombre con pelo corto; `persF` mujer con coleta discreta; línea fina (1,5) en `.pav svg`; `data-sx` en `.pav`; sin foto ni iniciales), nombre destacado, línea secundaria «edad · deporte» **solo si existen** esos datos, resumen automático de lesiones (`paResumen`: 1 activa → su nombre y los días en tratamiento (`sev().days`); varias → «N lesiones activas · la más antigua: N días»; ninguna activa pero con historial → «Última alta hace …»; sin historial → «Sin lesiones registradas»; color de aviso solo para las activas), etiquetas de **todos** los grupos del paciente (color estable por grupo, `paHue`) y flecha a la ficha. Búsqueda sin mayúsculas ni tildes (nombre y deporte), filtro Todos / En tratamiento, filtro por grupo, orden alfabético, contador y botón de nuevo paciente (flotante en móvil, botón en pantalla ancha). Móvil/iPad vertical (<1000 px): lista a pantalla completa y ficha al pulsar (botón «‹ Pacientes»); pantalla ancha: lista a la izquierda y ficha a la derecha (mismas clases `split fisl`/`hasdet` que Fisioterapia). Estado de la pantalla solo en memoria: `pdet, psq, pfl, pgr, pnewOn` (`js/04-planificacion.js`). **Campos opcionales del paciente** (se editan en la tarjeta «Datos del paciente» de la ficha; si están vacíos se **quitan** las claves, nunca quedan vacías): `sex` ('f'|'m'), `birth` (fecha de nacimiento 'YYYY-MM-DD', entre 1900 y hoy; la edad **se calcula**, no se guarda), `sport` (texto libre: cuadro de texto `#csport` con una flecha `data-a="spt"` que abre una lista propia `#csl` (combobox casero) con los deportes ya usados por **otros** pacientes (`paDeportes(ex)`: sin repetir, sin distinguir mayúsculas ni tildes, ordenados; no se guarda ninguna lista aparte); al escribir se sugieren los que coinciden; al elegir uno (`data-a="spp"`) se copia tal cual; se cierra al pulsar fuera. *`<datalist>` y `<select>` con «Añadir nuevo» se descartaron: el primero no funciona en iPhone/iPad*). Son claves opcionales dentro del registro `client`: no hizo falta migración (probado en `tests/datos.js`). Cada paciente es una tarjeta separada (`.plist` con separación de 8 px); el círculo del icono (`.pav`) mezcla el acento con el color de la tarjeta (`--pb`), así se distingue en claro, oscuro y Deportivo.
- Estado global `st` en memoria (la interfaz lo modifica directamente y llama a `save()`). `save()` no escribe a mano: avisa a `Datos`, que a los 150 ms compara `st` con lo ya guardado y escribe **solo los registros que cambiaron**. Preferencias visuales en `ui` (`plan_ui`), aplicadas con `applyUI()` (atributos `data-style` y `data-mode` en `<html>`).
- Eventos: 3 listeners delegados (`click`, `input`, `change`). Cada botón lleva `data-a="acción"`; el manejador es una cadena larga de `else if(a=='…')`. Hay ~70 acciones.
- Biblioteca: `LIB` (909 ejercicios: 876 de free-exercise-db + 33 semillas en español), `all()`, `byId()`, personalizados en `st.custom`, ediciones en `st.ov`.
- Ilustraciones: dibujos SVG de figura de palitos generados por código (`PO`, `PF`, `AR`, `pic`…), animados con CSS.
- Fisioterapia: `ZN` (52 zonas del cuerpo), `bodyChart(f)`, `sev()`/`sevLevel()` (gravedad por días de baja), `grpReport(g)` (informe de grupo).
- PDFs: `buildPDF`, `buildGroupPDF`, `pdfSave` (en iOS usa la hoja de compartir; si no, descarga).
- Copias: `expFile` / `exp` (exportar `st` como JSON), `imp` y `#impf` (importar: sustituye todo, lo que falte queda como lápida; ambos avisan con `confirm()` antes: textos `CONF_EXP` / `CONF_IMP`), aviso a los 14 días (`bkEstado`, se muestra en el área de estado de la navegación).
- Avisos fijos en rojo `#saveerr` (`avisoGuardado`, en `10-copias.js`): fallo al guardar (desaparece al guardar bien) o datos dañados/antiguos ilegibles (permanece).

## Modelo de datos (`st`)
```
st = { custom:[], routines:[{id,name,items:[{e,sets,reps,hold,rest,load,note}]}],
       week:{0..6:routineId}, active, ov:{}, groups:[{id,name,members:[clientId]}], gsel, cc, fcase,
       clients:[{ id,name,notes, plans:[{id,date,name,note,items}], weeks:[{id,date,name,note,days}],
                  cases:[{ id,name,status:'Activa'|'Alta',opened,closed,dx,type,act,contact,moment,zones:[zoneId],
                           entries:[{id,n,date,type,text,pain,meas:[{k,l,s,v,u}]}] }] }] }
```
En la pantalla se les llama **Pacientes** (decisión del usuario, 25/11/2026; en el código siguen siendo `clients`/`cli`). Las lesiones (`cases`) cuelgan del paciente; los grupos solo guardan ids de pacientes. No hay registro de entrenamientos **ejecutados** (solo planificados) ni exposición en horas (decisión del usuario).

## Almacenamiento y sincronización
Documento completo (arquitectura, decisiones, condiciones de Google, limitaciones): **`docs/sincronizacion.md`**. Guía de pruebas a mano: **`docs/guia-pruebas-manuales.md`**. Resumen:
- **Local:** IndexedDB `fisio-os` (`js/00-datos.js`), copia completa en cada dispositivo. Es la fuente de verdad que usa la app; funciona sin internet.
- **Nube:** Google Drive, carpeta oculta `appDataFolder` (único permiso: `drive.appdata`). Cada dispositivo escribe **solo su propio archivo** `fisio-os--<idDispositivo>.json` (copia completa suya) y lee los de los demás. Nunca dos dispositivos escriben el mismo archivo.
- **Cuándo sincroniza:** al abrir la app, tras cada cambio (con 2,5 s de espera), al volver la conexión y al volver a primer plano; y a mano con «Sincronizar ahora». iOS no permite sincronizar en segundo plano: solo con la app abierta.
- **Registros** `{k,id,kind,parent,ord,data,updatedAt,deletedAt,vv,pend}`; tipos `client, plan, week, case, entry, routine, group, exercise, override, ajuste, conflicto`. `st.conflicts` guarda las versiones perdedoras de los conflictos. `pend` es local (no viaja a la nube).
- **Versiones (`vv`):** mapa `{idDispositivo: contador}` por registro; cada cambio local suma 1 al contador del dispositivo. Una versión *domina* a otra si es posterior; si ninguna domina, son **concurrentes** (conflicto real). Dominada → se toma la que domina. Concurrentes → gana la de `updatedAt` mayor (empate: contenido mayor, igual en todos los dispositivos), la perdedora se guarda como `conflicto` visible y restaurable en Datos, y el resultado es **idéntico en todos los dispositivos** (vv unida sin sumar), por eso no hay discusiones infinitas. Editado vs borrado concurrentes: se conserva lo editado.
- **`updatedAt`** = `max(Date.now(), mayor visto + 1)`: un reloj atrasado no hace que sus cambios parezcan antiguos.
- **Mezcla síncrona:** `Datos.fusionar(st, remotos)` lee, mezcla y reemplaza `st` en el mismo instante (sin `await` en medio), así ninguna edición de pantalla se pierde. La pantalla no se repinta mientras se escribe en un campo.
- **Borrar = lápida** (`deletedAt`, `data:null`). Las lápidas **no se purgan** en esta versión (uso personal: pocas). Registros dañados u huérfanos: `retenido`, nunca se borran solos.
- **Selecciones de este dispositivo** (`active, gsel, cc, fcase`) van en `meta.sel` y no se sincronizan. `plan_ui`, `plan_bk`, `plan_cid` (ID de cliente de Google), `plan_tok` (permiso temporal), `plan_sync_on`, `plan_sync_ult` están en localStorage y son por dispositivo.
- **Esquema 2** (migración 1→2 automática al abrir: da versión y marca como pendiente todo lo existente). `uid(prefijo)` sigue siendo obligatorio para ids nuevos.
- **Interfaz del proveedor** (lo único que el motor usa): `configurado()`, `conectado()`, `preparar()`, `conectar()` (desde un toque), `desconectar()`, `invalidar()`, `listar()→[{id,nombre,version}]`, `leer(id)`, `escribir(nombre,id,doc)`. Los errores llevan `codigo` (`red`, `auth`, `cancelado`…) y `mensaje` en español.
- **ID de cliente de Google:** NO está en el código (el repositorio es público y las condiciones de Google desaconsejan incrustar credenciales en proyectos de código abierto). Se pega en Datos y se queda en `localStorage` (`plan_cid`) de cada dispositivo. Nunca subir tokens ni secretos de cliente. La app de Google sigue en **modo Testing** (hasta 100 usuarios de prueba; el permiso se vuelve a pedir cada 7 días). **No pasar a producción** hasta que el usuario y Claude hayan comprobado juntos sincronización, uso sin conexión y recuperación de datos (guía de pruebas manuales).
- **Pruebas en dispositivos reales pendientes** (no se pueden automatizar): renovación del permiso (~1 h) en iPhone/iPad/Opera, comportamiento tras 7 días en modo Testing, iPad, cierre de ventana de Google en modo app, Opera instalada como app. (La página de prueba `prueba-drive.html` y su excepción en `sw.js` se borraron el 25/11/2026; el ID de cliente guardado por ella como `pd_cid` se sigue aprovechando si existe.)
- **Riesgos conocidos:** (1) las condiciones de la API de Drive prohíben copias de seguridad de contenido de la app sin consentimiento y no definen el límite; la app sincroniza datos propios del usuario con su consentimiento explícito en su propia cuenta, pero conviene revisarlo si algún día se publica; (2) importar una copia sustituye todo a propósito (avisa antes) y, con la sincronización, **esa sustitución se replica a los demás dispositivos**; (3) un hijo creado en un dispositivo cuyo padre se borró en otro queda oculto como huérfano (no se pierde: queda retenido).

## Problemas conocidos (no arreglar de pasada: pedir confirmación)
Detalle y gravedad en la auditoría (sección 13). Los más importantes:
- (Resueltos con la capa de datos: fallo de escritura silencioso y sobrescritura de datos corruptos; ahora hay aviso rojo y los registros dañados se conservan.)
- (Resuelto 25/11/2026, decisión del usuario: **importar sustituye todo a propósito**, avisa antes y la sustitución se replica a los demás dispositivos; **exportar** incluye todos los datos y también avisa.)
- El botón "Cambiar tema" escribe `data-theme`, que ningún CSS lee: no hace nada (regresión del rediseño).
- `today()` usa `toISOString()` (UTC): cerca de medianoche puede dar el día anterior/siguiente.
- Editar una anotación clínica solo permite cambiar texto y fecha; añadir una exige texto o medida.
- Borrar una rutina deja su id huérfano en `st.week`; borrar un paciente lo deja en `members` de los grupos (el informe lo ignora).
- Todo comparte el ámbito global (nombres de variables y funciones): al añadir algo, comprobar que el nombre no existe ya (`grep`). Cambios pequeños y probados.

## Pruebas
- `npm install` (una vez) y `npm test`. Usan jsdom y `fake-indexeddb` con datos ficticios; salen con código distinto de 0 si algo falla.
- `tests/version.js`: `APPV` == versión de `sw.js`, los archivos precargados y los iconos del manifest existen.
- `tests/datos.js`: migración desde localStorage y del esquema 1 al 2, versiones por registro, guardar solo lo cambiado, reabrir, lápidas, orden, ids repetidos, registros dañados/huérfanos, fallo de escritura y reintento, dispositivo nuevo (usa `fake-indexeddb`).
- `tests/sync.js`: varios dispositivos simulados contra un Google Drive simulado (proveedor y motor reales): recuperación en dispositivo nuevo, sincronizar al abrir, offline, permiso caducado/reconectar, conflictos (conservar, usar, descartar), resolución independiente idéntica, editar vs borrar, reloj atrasado, archivos extraños, límite 429, desconectar, simulación al azar con 3 dispositivos (`SEMILLA=n npm test` para otra semilla).
- `tests/pacientes.js`: listado de Pacientes (orden, búsqueda sin tildes, filtros, contador, resumen de lesiones, etiquetas de grupos, iconos, edad/deporte opcionales, flujo móvil lista→ficha→volver, tarjetas separadas, campos sexo/nacimiento/deporte de la ficha y su desplegable, alta, estado vacío).
- `tests/nav.js`: barra, panel «Más», menú lateral, selección de cada pantalla, títulos, estado de sincronización y aviso de copia.
- `tests/smoke.js`: carga sin errores, las 8 pestañas pintan, 3 estilos, mapa corporal, biblioteca, fisio/grupos.
- Copias manuales (en `tests/datos.js` y `tests/sync.js`): la copia incluye todo, avisa antes de exportar e importar, importar sustituye todo y llega a los demás dispositivos.
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
