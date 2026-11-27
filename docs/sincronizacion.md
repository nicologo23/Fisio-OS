# Sincronización de Fisio-OS: arquitectura y decisiones

Actualizado el 25/11/2026. Sustituye a la propuesta técnica anterior (documento aparte) en todo lo que difieran.

## 1. Alcance y decisiones del usuario (25/11/2026)

Fisio-OS es de **uso exclusivamente personal, de un solo usuario, con datos ficticios** (apodos). Con ese alcance se tomaron estas decisiones:

| Nº | Decisión | Cómo se cumple |
|---|---|---|
| 1 | Cuenta personal gratuita de Google Drive | Se usa la cuenta del usuario; sin servicios de pago |
| 2 | Sin servicios adicionales ni cuentas profesionales | Sin servidor ni base de datos externa |
| 3 | Sin documentación de protección de datos de pacientes reales | No se redacta; ver apartado 9 si cambiara el alcance |
| 4 | Política de privacidad mínima | `privacidad.html` (una página corta) |
| 5 | Sin cifrado propio extra | Cifrado de Google en Drive + HTTPS |
| 6 | IndexedDB local + Google Drive remoto | `js/00-datos.js` + `js/13-drive.js` |
| 7 | Sincronización automática al abrir y tras cambios | Al abrir, 2,5 s después de cada cambio, al volver la conexión y al volver a primer plano |
| 8 | Funciona sin conexión; envía los cambios al volver | Los cambios quedan marcados como pendientes (`pend`) y se envían cuando se puede |
| 9 | Restaurar todo desde Drive en un dispositivo nuevo | Un dispositivo vacío descarga y mezcla los archivos de los demás |
| 10 | Mantener exportar/importar copias a mano | La copia incluye **todos** los datos; **importar sustituye todo** (a propósito); los dos avisan antes de continuar |
| 11 | Mostrar estado, pendientes y errores | Barra bajo la cabecera (solo si hace falta atención o la sincronización está activa) + tarjeta en Datos |
| 12 | Sin pérdidas ni sobrescrituras silenciosas | Versiones por registro; la versión perdedora de un conflicto se guarda y se puede restaurar |
| 13 | Si Google falla o caduca el permiso, la app sigue en local | Todo se lee y se escribe en IndexedDB; Google solo es un extra |
| 14 | App de Google en modo Testing | No se pasa a producción hasta comprobar juntos sincronización, offline y recuperación |
| 15 | Solo los permisos estrictamente necesarios | Solo `drive.appdata`; un test automático lo comprueba |

Además: no se añaden funciones de seguridad avanzadas ni dependencias que no hagan falta (no se añadió ninguna librería; la de Google se carga solo si la sincronización está configurada).

## 2. Arquitectura

```
 iPhone / iPad / Opera (cada uno)                          Google Drive del usuario
┌──────────────────────────────────┐                  ┌────────────────────────────────┐
│ Pantallas (js/03…11)             │                  │ carpeta oculta de la app       │
│   ↕ st (memoria)                 │                  │  fisio-os--<disp. A>.json      │
│ Datos (js/00)  IndexedDB         │  Sync (js/12)    │  fisio-os--<disp. B>.json      │
│   registros con versión (vv)  ◄──┼──────────────────┼─►fisio-os--<disp. C>.json      │
│ Drive (js/13) = proveedor        │  HTTPS (Drive v3)│                                │
└──────────────────────────────────┘                  └────────────────────────────────┘
```

- **Local primero.** La app siempre lee y escribe en IndexedDB. La nube nunca está “en medio”.
- **Un archivo por dispositivo.** Cada dispositivo escribe solo `fisio-os--<idDispositivo>.json` (una copia completa de sus registros) y lee los de los demás. Dos dispositivos nunca escriben el mismo archivo, así que Drive no puede pisar nada.
- **Proveedor sustituible.** `Sync` solo usa: `configurado, conectado, preparar, conectar, desconectar, invalidar, listar, leer, escribir`. Para cambiar de Google Drive a otro servicio se escribe otro proveedor con esa interfaz; no se toca `Sync` ni `Datos`.
- **Formato del archivo:** `{formato:'fisio-os-sync', esquema:2, dispositivo, generado, registros:[{k,id,kind,parent,ord,data,updatedAt,deletedAt,vv}]}` (tipos: client, plan, week, **salto** (27/11/2026, hijo del paciente), case, entry, routine, group, exercise, override, ajuste, conflicto). Los registros son las mismas filas que guarda IndexedDB (salvo la marca local `pend`).
- **Qué NO se sincroniza:** selecciones de este dispositivo (paciente abierto, rutina activa…), preferencias visuales, el ID de cliente de Google y el permiso temporal.

## 3. Sincronización, versiones y conflictos

**Un ciclo** (`Sync`, `js/12-sync.js`): (1) vaciar a disco lo que haya en memoria; (2) listar los archivos de la carpeta; (3) por cada archivo de otro dispositivo que haya cambiado desde la última vez, descargarlo y mezclarlo; (4) si hay cambios pendientes (o aún no existe su archivo), subir el propio y marcar como enviado lo subido. Un ciclo que falla no altera los datos locales.

**Versión por registro (`vv`).** Cada registro lleva `vv = {idDispositivo: contador}`; cada cambio local suma 1 al contador de ese dispositivo. Al recibir un registro de otro dispositivo:

| Comparación | Qué se hace |
|---|---|
| Igual | Nada |
| La versión local es posterior | Se conserva la local (se enviará) |
| La remota es posterior | Se toma la remota |
| **Concurrentes** (cada una tiene cambios que la otra no vio) | Gana la de `updatedAt` mayor (empate: el contenido mayor, igual en todos los dispositivos). **La perdedora se guarda en `st.conflicts`** y aparece en Datos |

- **Resultado idéntico en todos los dispositivos:** al resolver un conflicto se une el `vv` sin sumar, de modo que cada dispositivo llega por su cuenta al mismo registro y no se vuelve a discutir (comprobado con una simulación al azar de 3 dispositivos).
- **Usar la otra versión** intercambia las dos: la actual pasa a ser la guardada. No se pierde ninguna. **Descartar** pide confirmación.
- **Editado en uno y borrado en otro:** se conserva lo editado.
- **Reloj:** `updatedAt = max(hora del dispositivo, mayor visto + 1)`. Un reloj atrasado no hace que sus cambios parezcan viejos.
- **Mezcla sin carreras:** leer `st`, mezclar y reemplazarlo ocurre sin ninguna espera en medio; no se puede perder una edición. La pantalla no se repinta mientras se escribe en un campo.
- **Orden de listas:** las listas se ordenan por `ord` y, en empate, por `id` (igual en todos los dispositivos).
- **Lápidas:** borrar deja un registro con `deletedAt`. No se purgan (uso personal: pocas y pequeñas).
- **Datos dañados o de una versión más nueva:** se conservan sin tocar y se avisa.

## 4. Sin conexión y permisos

- **No es en tiempo real.** Los cambios se **envían** solos unos 3 segundos después de hacerlos. Se **reciben** al abrir la app, al volver a ella desde otra aplicación, al recuperar la conexión o pulsando «Sincronizar ahora»; no hace falta recargar la página. Una app que queda abierta y quieta en otro dispositivo no se entera hasta que se vuelve a ella (el uso previsto es un dispositivo cada vez).

- **Sin conexión:** se trabaja con normalidad. Los cambios quedan como “pendientes” y se envían al volver la conexión (evento `online`), al volver a abrir o con «Sincronizar ahora». Sobreviven a cerrar la app.
- **iOS no permite sincronizar en segundo plano** (no hay Background Sync): solo se sincroniza con la app abierta.
- **Permiso de Google (token):** dura aproximadamente 1 hora y la app no tiene servidor para renovarlo en silencio. Al caducar, la barra muestra «Falta el permiso de Google» con un botón **Reconectar** (hay que pulsarlo: iOS bloquea ventanas que no vienen de un toque). Mientras tanto la app sigue funcionando y acumula pendientes. Si Google concede la renovación sin pedir nada, la ventana se cierra sola. **Pendiente de comprobar en los dispositivos reales.**
- **Modo Testing:** Google vuelve a pedir el consentimiento cada 7 días. Es normal mientras la app no esté en producción.

## 5. Configuración en Google Cloud Console

1. Proyecto de Google Cloud con la **API de Google Drive** activada.
2. Pantalla de consentimiento OAuth: tipo **Externo**, estado **Testing**, tu cuenta como usuario de prueba, ámbito **solo** `https://www.googleapis.com/auth/drive.appdata` (no sensible: sin verificación).
3. Credencial **ID de cliente de OAuth, tipo “Aplicación web”**, con **Orígenes de JavaScript autorizados** `https://nicologo23.github.io` (no hacen falta URI de redirección).
4. URL de la política de privacidad (solo se exige al publicar): `https://nicologo23.github.io/Fisio-OS/privacidad.html`.
5. El ID de cliente **no se sube al repositorio**: se pega en Datos → Sincronización en cada dispositivo (queda en `localStorage`). No existe secreto de cliente en este flujo; no hay que crear ni guardar ninguno.

## 6. Condiciones de Google (revisión del 25/11/2026)

Se revisaron las condiciones de los servicios de las API de Google, la política de datos de usuario y las condiciones de la API de Drive. **Aviso:** se leyeron mediante una herramienta que resume las páginas, no el texto legal completo; si algún día se publica la app, conviene releerlas.

- **Uso permitido.** `appDataFolder` está diseñado para que una app guarde sus propios datos de configuración y estado en una carpeta oculta del usuario; es lo que hace Fisio-OS. Un solo usuario es compatible con el modo Testing.
- **Cláusula de “copia de seguridad”.** Las condiciones de la API de Drive prohíben copiar contenido del usuario en Drive como copia de seguridad *sin su consentimiento*; el límite no está definido. Fisio-OS guarda los datos de la propia app, de forma activa y solicitada por su único usuario, en su propia cuenta. Se considera compatible, pero **es el punto a revisar si el alcance cambia**.
- **Política de privacidad.** Las condiciones generales la piden incluso a una app personal; se cubre con `privacidad.html` (mínima, en español).
- **Credenciales en código abierto.** Las condiciones desaconsejan incrustar credenciales de desarrollador en proyectos de código abierto; por eso el ID de cliente se introduce en cada dispositivo y no está en el repositorio.
- **Permisos.** Solo `drive.appdata`. La política de “uso limitado” aplica a ámbitos sensibles/restringidos; este no lo es, aun así no se usa la información para nada más que sincronizar.
- **Cuotas.** 12.000 consultas por minuto y usuario; el uso es de unas pocas por sincronización. Ante 429/403 de límite/5xx se reintenta con espera creciente (3 veces).

## 7. Riesgos y límites conocidos

1. **Importar una copia sustituye todo, a propósito** (decisión del usuario) y con la sincronización activada **esa sustitución se replica**: lo que falte en la copia queda borrado en todos los dispositivos. Por eso exportar e importar avisan antes de continuar y la copia exportada incluye todos los datos.
2. **Hijo huérfano:** si en un dispositivo se borra un paciente o una lesión y en otro se añade una anotación a ese mismo elemento, la anotación queda guardada pero oculta (el padre está borrado).
3. **Caducidad del almacenamiento en iOS:** Safari puede borrar los datos de un sitio si no se usa en 7 días; en una app instalada el riesgo es menor pero no está descartado. Con la sincronización activa, Drive guarda una copia completa (restauración en un dispositivo nuevo).
4. **Navegador y app instalada tienen datos separados** (en iOS son almacenes distintos): cada uno cuenta como un dispositivo propio y hay que conectarlo por separado.
5. **El permiso dura ~1 hora** (apartado 4).
6. **Archivos de dispositivos que ya no existen** (por ejemplo, tras reinstalar la app) se quedan en la carpeta y se siguen leyendo; no molestan. Se pueden borrar desde Drive → Configuración → Administrar aplicaciones.
7. **Limitado a texto y datos** (sin fotos ni vídeos), como se decidió.
8. **Sin garantía de reloj:** si dos dispositivos tienen la hora muy distinta, en un conflicto “gana” el que tenga la hora más adelantada; no se pierde nada porque la perdedora queda guardada.

## 8. Qué no se ha podido comprobar automáticamente

Las pruebas automáticas (`npm test`, `tests/sync.js`) usan un Google simulado. No pueden comprobar: ventanas emergentes reales, renovación real del permiso, comportamiento con la app instalada en iPhone/iPad/Opera, caducidad de 7 días, ni cortes de red reales. Eso se hace con `docs/guia-pruebas-manuales.md`. Hasta entonces la app de Google se mantiene en **Testing**.

## 9. Si algún día hubiera datos reales

Quedaría pendiente (y habría que volver a decidirlo, no está hecho): análisis de protección de datos de salud (RGPD, categoría especial), acuerdos con Google como encargado del tratamiento, cifrado antes de subir, política de privacidad completa, registro de accesos, copias y periodos de conservación, y revisar la cláusula de copias de seguridad de Drive. Nada de esto se desarrolla mientras el alcance sea personal con datos ficticios.
