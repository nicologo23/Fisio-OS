# Guía de pruebas manuales de la sincronización (iPhone, iPad y Opera)

Para hacer con calma, con **datos ficticios**. **No es en tiempo real:** los cambios se envían solos a los pocos segundos y se reciben al abrir la app, al volver a ella o con «Sincronizar ahora»; no hace falta recargar. Anota en cada prueba si salió **Bien**, **Raro** o **Mal** y, si no fue «Bien», qué viste exactamente (mejor con captura de pantalla). Con eso lo revisamos juntos antes de pasar la app de Google a producción. Hasta entonces **la app de Google se queda en modo Testing**.

Versión de la app que se prueba: **2026.11.25-7** (o la más nueva) (se ve abajo del todo en la pestaña **Datos**).

## 0. Preparación (una sola vez)

1. Fusiona la propuesta de cambios (pull request) en GitHub y espera 1–2 minutos a que GitHub Pages publique.
2. Abre la app en cada dispositivo. Si aparece el aviso **«Hay una versión nueva de la app»**, pulsa **Actualizar**.
3. Entra en **Datos** y comprueba que abajo pone la versión **2026.11.25-7** (o más nueva). Si pone una anterior, **cierra la app del todo** (deslizar hacia arriba en el selector de apps) y vuelve a abrirla; la actualización solo se busca al abrirla de nuevo, y a veces hay que hacerlo dos veces. Si añades la app a la pantalla de inicio desde Safari **por primera vez**, ya descarga la última versión (no verás botón «Actualizar») y empieza **sin datos**: es lo esperado, se recuperan al conectar con Google.
4. Ten a mano el **ID de cliente de Google** (el mismo que usaste en la página de prueba). Si en ese dispositivo ya lo usaste con la página de prueba, puede aparecer ya relleno y la tarjeta te pedirá directamente «Conectar con Google».
5. Antes de empezar, en Opera pulsa **Datos → Guardar copia como archivo** (copia de seguridad ficticia, por si acaso).

**Cómo leer la pantalla:** en **Datos → Sincronización entre dispositivos** verás una línea de estado («Sincronizado hoy a las 14:05», «Sincronizando…», «Sin conexión…», «Falta el permiso de Google…» o «Error: …») y debajo «Todo enviado» o «N cambios sin enviar». En las demás pestañas aparece la misma información en una línea pequeña bajo la cabecera (en recuadro destacado si hace falta que hagas algo).

## 1. Primera conexión en Opera (el que tiene los datos)

1. **Datos →** pega el ID de cliente → **Guardar ID**.
2. Pulsa **Conectar con Google**. Se abre una ventana de Google: elige tu cuenta y acepta. (Como la app está en modo Testing, Google puede avisar de que «no está verificada»: es normal, continúa.)
3. La ventana se cierra sola. **Esperado:** estado «Sincronizado hoy a las …» y «Todo enviado».
4. **Anota:** si Google te pidió algo más de lo normal.

## 2. Recuperar los datos en el iPhone (app instalada)

1. Abre la app instalada. **Datos →** ID de cliente (si no está) → **Guardar ID** → **Conectar con Google** → acepta.
2. **Esperado:** en unos segundos aparecen los **mismos deportistas, rutinas y lesiones** que en Opera. Estado «Sincronizado» y «Todo enviado».
3. Mira **Hoy**, **Deportistas** y **Fisioterapia**: ¿todo está como en Opera?

## 3. Lo mismo en el iPad

Repite la prueba 2. Como el iPhone ya funcionó, aquí solo importa que también salga bien. Anota si el iPad se comporta distinto en la ventana de Google.

## 4. Un cambio viaja entre dispositivos

1. En el **iPhone**: añade una anotación a una lesión (por ejemplo «prueba 4 iPhone») o cambia las notas de un deportista.
2. Espera unos 3 segundos y mira el estado: debe pasar por «1 cambio sin enviar» a «Todo enviado».
3. En **Opera** y en el **iPad**: abre la app (o pulsa **Sincronizar ahora**). **Esperado:** aparece el cambio y un aviso «Sincronizado: se han traído cambios de otro dispositivo».
4. Haz lo mismo al revés: cambio en Opera → verlo en el iPhone.
5. **Borrado:** en el iPad borra esa anotación y comprueba que desaparece también en los otros dos tras sincronizar.

## 5. Sin conexión

1. En el **iPhone** activa el **modo avión**.
2. Abre la app y haz un cambio (por ejemplo, otra anotación). **Esperado:** la app funciona con normalidad y avisa «Sin conexión…» y «1 cambio sin enviar».
3. **Cierra la app del todo** (deslizar hacia arriba) y vuelve a abrirla, todavía sin conexión. **Esperado:** el cambio sigue ahí y sigue pendiente.
4. Desactiva el modo avión y abre/pon en primer plano la app. **Esperado:** se sincroniza sola y queda «Todo enviado».
5. Comprueba en Opera que llegó el cambio.

## 6. Permiso caducado (la prueba más importante en iPhone/iPad)

El permiso de Google dura aproximadamente **1 hora**.

1. Conecta el iPhone y no lo uses durante **más de una hora** (o déjalo hasta el día siguiente).
2. Abre la app. **Esperado:** aparece el recuadro **«Falta el permiso de Google (caduca cada hora). Pulsa «Reconectar»»**. La app sigue funcionando: haz un cambio y comprueba que se guarda y queda «1 cambio sin enviar».
3. Pulsa **Reconectar**. **Anota exactamente qué pasa:** ¿se abre una ventana que se cierra sola? ¿te pide elegir cuenta? ¿te pide aceptar de nuevo?
4. **Esperado:** vuelve a «Sincronizado» y «Todo enviado».
5. Repite en Opera y en el iPad.

> Esto decide si el sistema es cómodo en el día a día. Si con cada hora hay que hacer varios pasos, lo hablamos.

## 7. Conflicto: se cambia lo mismo en dos dispositivos

1. Pon el **iPhone en modo avión**.
2. En el iPhone cambia las **notas** de un deportista a «versión iPhone».
3. En **Opera** cambia las notas de **ese mismo** deportista a «versión Opera» (espera 3 s a que se envíe).
4. Quita el modo avión del iPhone y ábrela. **Esperado:** aviso «Sincronizado: hay 1 conflicto por revisar en Datos». En Datos sale **Conflictos por revisar (1)** con la versión que ha quedado de lado.
5. Comprueba que **no se ha perdido ninguna** de las dos versiones: una está en el deportista y la otra en el conflicto.
6. Pulsa **Usar esta versión**: las dos se intercambian. Pulsa **Descartar** (pide confirmar) para quitarlo.
7. En Opera, sincroniza y comprueba que ve el mismo resultado.

## 8. Recuperar desde cero (dispositivo nuevo)

1. En Opera abre una **ventana privada** con la dirección de la app (así no tiene datos).
2. **Datos →** ID de cliente → **Conectar con Google**.
3. **Esperado:** aparece **todo** igual que en tus otros dispositivos. Cierra la ventana privada al acabar.
4. (Opcional) En el iPad, borra la app instalada, vuelve a instalarla y repite: debe recuperar todo.

## 9. Copias manuales y desconectar

1. **Datos → Guardar copia como archivo** funciona como antes (se descarga o se abre la hoja de compartir).
2. **Exportar** avisa antes y la copia contiene **todos** los datos. **Importar** también avisa: **sustituye todo** lo que hay en el dispositivo (y llega a los demás al sincronizar). Pruébalo con datos ficticios: exporta, cambia algo, importa la copia y comprueba que todo vuelve a como estaba en ese dispositivo y, tras sincronizar, en los otros.
3. En el iPad pulsa **Desconectar**. **Esperado:** la sincronización queda desactivada en ese dispositivo, tus datos siguen ahí y la barra desaparece. Vuelve a conectarlo después.

## 10. Comprobaciones de que no se ha roto nada

- Abre cada pestaña (Hoy, Biblioteca, Rutinas, Semana, Deportistas, Fisioterapia, Grupos, Datos) y comprueba que **se ven y funcionan como antes**, en los 3 estilos y en claro/oscuro.
- Genera un PDF de un plan y de un informe.
- Con la sincronización activada, comprueba que la app sigue siendo igual de rápida al abrir.

## 11. Después de 7 días (modo Testing)

Google caduca el consentimiento a los 7 días en las apps en modo Testing. Anota qué pasa al **reconectar** pasado ese tiempo (te volverá a pedir aceptar). Es esperable.

## Qué contarme

Para cada prueba: **Bien / Raro / Mal**, el dispositivo (iPhone / iPad / Opera, app instalada o navegador), la hora aproximada y lo que ponía en pantalla. Si aparece un recuadro rojo o un «Error: …», copia el texto exacto.

## Cuándo pasar a producción

Solo cuando las pruebas 1–8 estén en **Bien** en los tres dispositivos y hayamos decidido juntos qué hacer con lo «Raro». Hasta entonces la app de Google permanece en **Testing**.
