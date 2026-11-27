# Guía de pruebas manuales de la sincronización (iPhone, iPad y Opera)

Para hacer con calma, con **datos ficticios**. **No es en tiempo real:** los cambios se envían solos a los pocos segundos y se reciben al abrir la app, al volver a ella o con «Sincronizar ahora»; no hace falta recargar. Anota en cada prueba si salió **Bien**, **Raro** o **Mal** y, si no fue «Bien», qué viste exactamente (mejor con captura de pantalla). Con eso lo revisamos juntos antes de pasar la app de Google a producción. Hasta entonces **la app de Google se queda en modo Testing**.

Versión de la app que se prueba: **2026.11.26-19** (o la más nueva) (se ve abajo del todo en la pestaña **Datos**).

## 0. Preparación (una sola vez)

1. Fusiona la propuesta de cambios (pull request) en GitHub y espera 1–2 minutos a que GitHub Pages publique.
2. Abre la app en cada dispositivo. Si aparece el aviso **«Hay una versión nueva de la app»**, pulsa **Actualizar**.
3. Entra en **Datos** y comprueba que abajo pone la versión **2026.11.26-19** (o más nueva). Si pone una anterior, **cierra la app del todo** (deslizar hacia arriba en el selector de apps) y vuelve a abrirla; la actualización solo se busca al abrirla de nuevo, y a veces hay que hacerlo dos veces. Si añades la app a la pantalla de inicio desde Safari **por primera vez**, ya descarga la última versión (no verás botón «Actualizar») y empieza **sin datos**: es lo esperado, se recuperan al conectar con Google.
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
2. **Esperado:** en unos segundos aparecen los **mismos pacientes, rutinas y lesiones** que en Opera. Estado «Sincronizado» y «Todo enviado».
3. Mira **Hoy**, **Pacientes** y **Fisioterapia**: ¿todo está como en Opera?

## 3. Lo mismo en el iPad

Repite la prueba 2. Como el iPhone ya funcionó, aquí solo importa que también salga bien. Anota si el iPad se comporta distinto en la ventana de Google.

## 4. Un cambio viaja entre dispositivos

1. En el **iPhone**: añade una anotación a una lesión (por ejemplo «prueba 4 iPhone») o cambia las notas de un paciente.
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
2. Abre la app. **Esperado:** no sale ninguna tarjeta encima de las pantallas; aparece un **globito rojo** en «Más» (iPhone) o en «Ajustes» (iPad/ordenador) y el símbolo ✗ rojo bajo la rueda de ajustes o en el menú lateral. Entra en Ajustes (Datos): ahí está el texto del aviso y el botón **Reconectar**. La app sigue funcionando: haz un cambio y comprueba que se guarda y queda «1 cambio sin enviar».
3. Pulsa **Reconectar**. **Anota exactamente qué pasa:** ¿se abre una ventana que se cierra sola? ¿te pide elegir cuenta? ¿te pide aceptar de nuevo?
4. **Esperado:** vuelve a «Sincronizado» y «Todo enviado».
5. Repite en Opera y en el iPad.

> Esto decide si el sistema es cómodo en el día a día. Si con cada hora hay que hacer varios pasos, lo hablamos.

## 7. Conflicto: se cambia lo mismo en dos dispositivos

1. Pon el **iPhone en modo avión**.
2. En el iPhone cambia las **notas** de un paciente a «versión iPhone».
3. En **Opera** cambia las notas de **ese mismo** paciente a «versión Opera» (espera 3 s a que se envíe).
4. Quita el modo avión del iPhone y ábrela. **Esperado:** aviso «Sincronizado: hay 1 conflicto por revisar en Datos». En Datos sale **Conflictos por revisar (1)** con la versión que ha quedado de lado.
5. Comprueba que **no se ha perdido ninguna** de las dos versiones: una está en el paciente y la otra en el conflicto.
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

- **Rutinas → arrastrar y soltar:** puedes mover un ejercicio de dos formas. (1) Agarrándolo por cualquier parte del bloque que no sea un botón, un cuadro de texto, un desplegable o una etiqueta: con el ratón (Opera), pulsa y mueve; con el dedo (iPhone/iPad), mantén el dedo quieto unos 0,3 segundos y, cuando el bloque se «levante», arrastra. Si deslizas el dedo enseguida, la pantalla se desplaza como siempre y no se mueve nada. (2) Con el botón de seis puntos (⠿), que arrastra al instante. En ambos casos los demás ejercicios se apartan, y al soltar se guarda el orden y se sincroniza. Si arrastras cerca del borde de la pantalla, la lista se desplaza sola. Las flechas ↑ ↓ siguen funcionando. Comprueba también que se pueden seguir escribiendo series, repeticiones, etc. sin que se mueva el bloque.
- **Navegación nueva:** la barra de abajo (iPhone) es Hoy · Pacientes · Fisioterapia · Grupos · Más. «Más» abre un panel con Biblioteca, Rutinas, Semana y Ajustes y se marca cuando estás en una de esas pantallas. En iPad y ordenador, el menú lateral tiene «Herramientas» (Biblioteca, Rutinas, Semana) y Ajustes abajo. Debajo del engranaje (iPhone) y abajo del menú lateral hay un símbolo de estado: ✓ verde sincronizado, flechas azules girando sincronizando, ✗ roja cambios sin enviar, y ⚠ si falta la copia de seguridad.
- **Listado de Pacientes (nuevo aspecto):** en iPhone, la lista ocupa toda la pantalla; al tocar un paciente se abre su ficha y «‹ Pacientes» vuelve a la lista. Comprueba la búsqueda (escribe «alvaro» y encuentra «Álvaro»), el filtro «En tratamiento», el filtro por grupo, el contador y el botón «+» flotante. En iPad vertical funciona como el iPhone; en iPad horizontal y ordenador, lista a la izquierda y ficha a la derecha. En el listado, una lesión activa muestra al lado los días que lleva en tratamiento. Cada paciente debe ser una tarjeta separada y el círculo del icono debe distinguirse bien en Deportivo y en oscuro. En la ficha, la tarjeta «Datos del paciente» (Mujer / Hombre / Sin indicar, fecha de nacimiento, deporte) debe cambiar el icono y la línea «edad · deporte» del listado, el campo «Deporte o actividad» se puede escribir y tiene una flecha que abre la lista de deportes ya usados en otros pacientes; al escribir también sugiere los que coinciden (compruébalo en iPhone, iPad y Opera), y los datos deben seguir ahí al cerrar y abrir la app y en el otro dispositivo tras sincronizar. Mira que las etiquetas de grupo se distinguen por color y que se ve bien en los 3 estilos y en claro/oscuro.
- **Aviso sin tarjeta, barra fija y pestaña marcada (27/11/2026):** (1) iPad y ordenador: al desplazarte por una lista larga (Biblioteca, Pacientes…), el menú lateral **no se mueve**. (2) Con algo que atender (permiso caducado o copia pendiente) sale un globito rojo en «Ajustes» del menú lateral, en «Más» y en «Ajustes» del panel «Más»; al arreglarlo desaparece. No debe salir ninguna tarjeta de aviso. (3) iPhone: la pestaña en la que estás tiene fondo gris suave, como en el iPad.
- **Ficha del paciente nueva (27/11/2026):** (1) Abre un paciente: arriba ves su nombre, edad, deporte, grupos y cuatro casillas (sexo, nacimiento, peso, altura). (2) «Editar datos»: cambia el nombre, escribe peso (78,5), altura (186 o 1,86) y objetivo; al escribir, la cabecera y el Resumen se actualizan solos; vacíalos y vuelven a «—». (3) Pestañas Resumen · Clínica · Ejercicio · Progreso · Salto (las dos últimas, vacías por ahora). (4) Resumen: siempre 3 tarjetas (Lesión · Objetivo · Notas). Con 2 o más lesiones activas sale una sola tarjeta que lleva a Clínica; con una, va directa a ella; sin lesión sale el corazón. (5) «Rutina actual» muestra la rutina que le toca **hoy** en su plan semanal y «Ver rutina» te lleva a ella; «Plan semanal» enseña la semana con «Día: rutina» y hoy resaltado; «Ver plan» abre el plan. (6) Atajos: «Nueva lesión» (abre el formulario), «Nueva rutina»/«Nuevo plan semanal» (llevan a esas pantallas), «Añadir medición» (abre la lesión activa). (7) **iPad y navegador:** con la lista desplegada la ficha va en una columna (atajos, Resumen, Actividad, Rutina, Plan); minimízala con la flecha y pasa a dos columnas con las últimas tarjetas igualadas por abajo; mira si se ve todo sin deslizar. (8) Crear un paciente nuevo abre «Editar datos». (9) **Hora local:** cerca de medianoche, la fecha de las rutinas asignadas y de «Hoy» debe ser la de tu país. (10) Mira los 3 estilos y claro/oscuro.
- **Progreso del paciente (pestaña Progreso):** (1) «Lesión de referencia»: prueba «Todas las lesiones» (el dolor sale en una serie por lesión) y cada lesión activa o de alta (solo sus datos; los desplegables se adaptan). (2) Elige «Líneas con puntos» o «Barras». (3) En «Eje vertical (Y)» elige el tipo (Dolor EVA, Fuerza, ROM, Carga, Intensidad, RPE) y de qué; en «Eje horizontal (X)» Fecha, «Días desde el inicio de la lesión» (pide elegir una lesión) u otra variable. (4) Comprueba que debajo del selector pone «Eje Y: … (unidad)» y «Eje X: …» y que los mismos nombres salen en el gráfico. (5) Toca un punto o barra: sale el valor con unidad, el origen y, en cargas, «Carga registrada» y el texto original. (6) «Ver los datos del gráfico» muestra la tabla con unidades. (7) Escribe en una rutina cargas raras («2 × 15 kg», «goma roja», «20-30 kg»): no se dibujan, salen en «N cargas sin interpretar» y siguen intactas en la rutina. (8) Un ejercicio con «40 kg», «70 % RM» y «RPE 8» da tres series distintas. (9) iPhone, iPad vertical/horizontal, 3 estilos y claro/oscuro.
- **Editar rutinas y planes asignados (pestaña Ejercicio):** (1) Pulsa «Editar» en una rutina asignada: cambia nombre, fecha, notas, series/reps/descanso/carga/notas, orden (↑↓), quita un ejercicio, añade uno de la biblioteca (buscador) y sustituye otro con el icono del lápiz; «Cancelar» (con aviso si hay cambios) no cambia nada y «Guardar cambios» sí. (2) Comprueba que la rutina original en «Rutinas» y las de otros pacientes NO han cambiado. (3) En un plan semanal: cambia la fecha de inicio (los días se re-fechan), edita solo el lunes y mira que los demás días quedan igual, marca un día como descanso y añade ejercicios a un día de descanso. (4) Mira que Progreso, el Resumen y el PDF reflejan el cambio. (5) Cierra la app del todo y ábrela; en el otro dispositivo, sincroniza y comprueba que llega. (6) Un plan semanal antiguo (sin fecha de inicio) muestra «fecha deducida»; al editarlo y guardar queda fijada. (7) Al asignar la semana (pestaña Semana) aparece «Inicio de la semana» con el lunes de esta semana.
- **Salto con vídeo real (27/11/2026) — LA PRUEBA IMPORTANTE:** (1) Graba un salto en cámara lenta a 240 fps con el iPhone, cámara fija. (2) En Fisio OS: paciente → pestaña **Salto** → «Elegir vídeo». Prueba las dos vías: elegirlo de **Fototeca** y elegirlo desde **Archivos** (si lo guardaste allí). (3) Pulsa «1 ›» varias veces: ¿cada pulsación avanza **un fotograma pequeño** (el cuerpo se mueve muy poco) o la imagen salta a trozos? (4) Mira el contador: «Fotograma n de N · tiempo». Para un vídeo de 4 s a 240 fps debería poner N ≈ 959. Si pone ≈ 119 o ≈ 29, el vídeo no trae los 240 fps (cambia «Fotogramas por segundo» al valor real, o prueba la otra vía de elegir el archivo). (5) Marca despegue y aterrizaje y comprueba que la altura sale razonable (un salto normal: 25–50 cm). (6) Guarda el salto, ciérralo, abre otro paciente y vuelve: el salto está y el vídeo ya no. Cuéntame qué dispositivo usaste, si el paso es fino y los números del contador. Con esto vemos si el iPhone entrega todos los fotogramas.
- **Estilo Deportivo afinado:** en Ajustes → Estilo → Deportivo recorre Hoy, Pacientes (lista y ficha), Fisioterapia, Biblioteca, Rutinas y Progreso. Solo el título de cada pantalla va en mayúsculas; los botones («Nuevo paciente», «Ver rutina», «+ Rutina») y los nombres van en minúsculas normales y no se parten ni se tapan unos a otros. Compáralo con iOS y Clínico en iPhone y iPad.
- **Pacientes:** la palabra «Deportistas» ha pasado a «Pacientes» en toda la app (menús, pantallas, PDFs y resúmenes).
- Abre cada pestaña (Hoy, Biblioteca, Rutinas, Semana, Pacientes, Fisioterapia, Grupos, Datos) y comprueba que **se ven y funcionan como antes**, en los 3 estilos y en claro/oscuro.
- Genera un PDF de un plan y de un informe.
- Con la sincronización activada, comprueba que la app sigue siendo igual de rápida al abrir.

## 11. Después de 7 días (modo Testing)

Google caduca el consentimiento a los 7 días en las apps en modo Testing. Anota qué pasa al **reconectar** pasado ese tiempo (te volverá a pedir aceptar). Es esperable.

## Qué contarme

Para cada prueba: **Bien / Raro / Mal**, el dispositivo (iPhone / iPad / Opera, app instalada o navegador), la hora aproximada y lo que ponía en pantalla. Si aparece un recuadro rojo o un «Error: …», copia el texto exacto.

## Cuándo pasar a producción

Solo cuando las pruebas 1–8 estén en **Bien** en los tres dispositivos y hayamos decidido juntos qué hacer con lo «Raro». Hasta entonces la app de Google permanece en **Testing**.
