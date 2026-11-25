# CLAUDE.md — Planificador de entrenamiento y fisioterapia

Instrucciones para Claude (y cualquier otro asistente) al trabajar en este repositorio.
Basado en la auditoría técnica del 24/11/2026. Si algo de aquí contradice el código, manda el código: avisa y corrige este archivo.

## Qué es
- App web original (inspirada en Harbiz, no una copia) para **planificar entrenamientos** y **seguir tratamientos de fisioterapia** de deportistas.
- Usuario: un único fisioterapeuta/preparador que trabaja solo, en **iPhone y iPad** (Safari, instalada como PWA). Interfaz y textos en **español**; los nombres de ejercicios pueden quedar en inglés.
- Sin servidor, sin cuentas, sin sincronización entre dispositivos. Los datos viven **solo en el navegador del dispositivo** (localStorage).

## Regla nº 1: los datos del usuario son lo más valioso
- Nunca cambiar la forma de `st` ni las claves de localStorage (`plan_v1`, `plan_ui`, `plan_bk`) sin una migración que conserve los datos existentes y sin probarla.
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
| `js/app.js` | Toda la lógica de la app (~125 KB). Pendiente de dividir en archivos por temas (ver hoja de ruta). |
| `sw.js` | Service worker: caché primero, precarga los archivos de `FILES` y activa la nueva versión al instante. |
| `manifest.webmanifest`, `icon-*.png` | Instalación como PWA. |
| `jspdf.umd.min.js` | jsPDF 4.2.1 en local (PDFs sin internet). |
| `tests/`, `package.json` | Pruebas automáticas (ver abajo). `node_modules/` no se sube. |

Orden de carga (scripts clásicos, comparten el ámbito global): `jspdf` → `datos/ejercicios.js` → `js/app.js`. `LIB` debe cargarse antes que `js/app.js`.

## Arquitectura (resumen; buscar por nombre, los números de línea cambian)
- JavaScript sin framework, sin módulos ni compilación (`js/app.js`). Vistas = funciones que devuelven HTML en plantillas y se pintan con `innerHTML`.
- `render()` → `V[tab]()`; pestañas: `hoy, lib, rut, sem, cli, fis, grp, dat`.
- Estado global `st`; `save()` guarda **todo** `st` en localStorage. Preferencias visuales en `ui` (`plan_ui`), aplicadas con `applyUI()` (atributos `data-style` y `data-mode` en `<html>`).
- Eventos: 3 listeners delegados (`click`, `input`, `change`). Cada botón lleva `data-a="acción"`; el manejador es una cadena larga de `else if(a=='…')`. Hay ~70 acciones.
- Biblioteca: `LIB` (909 ejercicios: 876 de free-exercise-db + 33 semillas en español), `all()`, `byId()`, personalizados en `st.custom`, ediciones en `st.ov`.
- Ilustraciones: dibujos SVG de figura de palitos generados por código (`PO`, `PF`, `AR`, `pic`…), animados con CSS.
- Fisioterapia: `ZN` (52 zonas del cuerpo), `bodyChart(f)`, `sev()`/`sevLevel()` (gravedad por días de baja), `grpReport(g)` (informe de grupo).
- PDFs: `buildPDF`, `buildGroupPDF`, `pdfSave` (en iOS usa la hoja de compartir; si no, descarga).
- Copias: `expFile` / `exp` (exportar), `imp` y `#impf` (importar), aviso a los 14 días (`bkBanner`).

## Modelo de datos (`st`)
```
st = { custom:[], routines:[{id,name,items:[{e,sets,reps,hold,rest,load,note}]}],
       week:{0..6:routineId}, active, ov:{}, groups:[{id,name,members:[clientId]}], gsel, cc, fcase,
       clients:[{ id,name,notes, plans:[{id,date,name,note,items}], weeks:[{id,date,name,note,days}],
                  cases:[{ id,name,status:'Activa'|'Alta',opened,closed,dx,type,act,contact,moment,zones:[zoneId],
                           entries:[{id,n,date,type,text,pain,meas:[{k,l,s,v,u}]}] }] }] }
```
Las lesiones (`cases`) cuelgan del deportista; los grupos solo guardan ids de deportistas. No hay registro de entrenamientos **ejecutados** (solo planificados) ni exposición en horas (decisión del usuario).

## Problemas conocidos (no arreglar de pasada: pedir confirmación)
Detalle y gravedad en la auditoría (sección 13). Los más importantes:
- `save()` ignora en silencio un fallo de escritura (almacenamiento lleno/bloqueado): el usuario cree que guardó y no.
- Si el JSON guardado está corrupto, la app arranca vacía y el siguiente `save()` lo **sobrescribe**.
- Importar una copia **sustituye todo sin pedir confirmación**.
- El botón "Cambiar tema" escribe `data-theme`, que ningún CSS lee: no hace nada (regresión del rediseño).
- `today()` usa `toISOString()` (UTC): cerca de medianoche puede dar el día anterior/siguiente.
- Editar una anotación clínica solo permite cambiar texto y fecha; añadir una exige texto o medida.
- Borrar una rutina deja su id huérfano en `st.week`.
- Toda la lógica está aún en `js/app.js`: un cambio en un sitio puede afectar a otro. Cambios pequeños y probados.

## Pruebas
- `npm install` (una vez) y `npm test`. Usan jsdom con datos ficticios; salen con código distinto de 0 si algo falla.
- `tests/version.js`: `APPV` == versión de `sw.js`, los archivos precargados y los iconos del manifest existen.
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
- Tras cambiar algo: `npm test`, subir versión (`APPV` + `sw.js`), y decir al usuario qué archivos subir y que haga una copia antes.
