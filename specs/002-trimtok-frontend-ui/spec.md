# Feature Specification: TrimTok — Interfaz Gráfica Frontend

**Feature Branch**: `002-trimtok-frontend-ui`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: Interfaz gráfica de TrimTok sin integración con backend. Pantallas: Home con validación de URL de TikTok, estado de carga, previsualización y descarga, recorte de video y descarga de GIF.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingresar y validar un enlace de TikTok (Priority: P1)

El usuario llega a la pantalla principal de TrimTok, escribe o pega un enlace de TikTok en el campo de texto y hace clic en el botón "Descargar". Si el enlace no es válido o está vacío, el campo se resalta en rojo con un mensaje de error descriptivo. Si el enlace es válido, la interfaz avanza a la pantalla de carga.

**Why this priority**: Es la puerta de entrada a toda la aplicación. Sin este flujo correctamente implementado no existe ninguna funcionalidad posterior disponible para el usuario.

**Independent Test**: Puede probarse completamente llenando el campo con distintas entradas (vacío, URL no-TikTok, URL de TikTok válida) y verificando la respuesta visual en cada caso, sin necesidad de backend.

**Acceptance Scenarios**:

1. **Given** el usuario está en la pantalla principal con el campo de URL vacío, **When** hace clic en "Descargar", **Then** el campo se muestra con borde rojo y aparece el mensaje "Pega un enlace de TikTok" debajo del campo.
2. **Given** el usuario escribe una URL que no pertenece a TikTok (ej. `https://youtube.com/watch?v=abc`), **When** hace clic en "Descargar", **Then** el campo se muestra con borde rojo y aparece un mensaje de error indicando que el enlace no es de TikTok.
3. **Given** el usuario pega un enlace válido de TikTok (ej. `https://www.tiktok.com/@user/video/123`), **When** hace clic en "Descargar", **Then** la interfaz navega a la pantalla de carga ("Descargando...").
4. **Given** el campo muestra un error, **When** el usuario corrige el enlace y hace clic en "Descargar", **Then** el error desaparece y el flujo continúa normalmente.

---

### User Story 2 - Pantalla de carga tras iniciar descarga (Priority: P2)

Tras ingresar un enlace válido y confirmar, el usuario ve una pantalla de carga con una barra de progreso animada y el texto "Descargando...". Esta pantalla representa el proceso de procesamiento del video y, al completarse (simulado en esta fase), navega automáticamente hacia la pantalla de previsualización y descarga.

**Why this priority**: Proporciona retroalimentación visual indispensable entre la acción del usuario y el resultado; sin este estado la transición sería ambigua.

**Independent Test**: Puede probarse iniciando el flujo con una URL válida y verificando que la pantalla de carga aparece y luego avanza a la pantalla de previsualización tras un tiempo simulado.

**Acceptance Scenarios**:

1. **Given** el usuario envió una URL válida de TikTok, **When** la pantalla de carga se muestra, **Then** aparece una barra de progreso animada y el texto "Descargando...".
2. **Given** la pantalla de carga está activa, **When** el proceso simulado finaliza, **Then** la interfaz navega automáticamente a la pantalla de previsualización y descarga.

---

### User Story 3 - Previsualizar y descargar el video completo (Priority: P3)

El usuario ve el video descargado en un reproductor integrado junto con el título/descripción del video. Puede elegir descargar el video completo en formato MP4, descargar solo el audio en formato MP3, acceder a la herramienta de recorte o iniciar una nueva descarga.

**Why this priority**: Es el resultado principal del flujo de descarga; representa la entrega de valor central para usuarios que solo quieren descargar el video completo.

**Independent Test**: Puede probarse con datos simulados (video y título de muestra) verificando que el reproductor funciona y los botones de descarga están presentes y son funcionales (en esta fase con datos mock).

**Acceptance Scenarios**:

1. **Given** la descarga se completó (simulada), **When** la pantalla de previsualización aparece, **Then** se muestra un reproductor de video con el video, el título/descripción truncado y los botones "↓ Descargar MP4", "↓ Descargar MP3", "✂ Recortar" y "Nueva descarga".
2. **Given** el usuario está en la pantalla de previsualización, **When** hace clic en "Nueva descarga", **Then** la interfaz regresa a la pantalla principal con el campo de URL vacío.

---

### User Story 4 - Recortar el video seleccionando inicio y fin (Priority: P4)

El usuario accede a la pantalla de recorte desde la previsualización. Puede arrastrar los controles de un slider de rango o editar los campos INICIO y FIN para seleccionar un segmento del video. Puede previsualizar el segmento seleccionado y, según la duración del segmento, recortarlo y descargarlo.

**Why this priority**: Es la funcionalidad diferenciadora de TrimTok respecto a otras herramientas de descarga.

**Independent Test**: Puede probarse con el video de muestra verificando que el slider responde, los campos INICIO/FIN se actualizan, el botón "Previsualizar segmento" reproduce el fragmento y los botones de descarga correctos aparecen según la duración del segmento.

**Acceptance Scenarios**:

1. **Given** el usuario está en la pantalla de recorte, **When** arrastra los controles del slider, **Then** los campos INICIO y FIN se actualizan en tiempo real mostrando el tiempo en formato `HH:MM:SS`.
2. **Given** el usuario seleccionó un inicio y fin, **When** hace clic en "Previsualizar segmento", **Then** el reproductor reproduce únicamente el fragmento seleccionado.
3. **Given** el segmento seleccionado tiene cualquier duración, **When** el usuario hace clic en "Recortar", **Then** aparecen los botones "↓ Descargar MP4 recortado" y "↓ Descargar MP3 recortado" (en verde).
4. **Given** el segmento seleccionado tiene una duración de 6 segundos o menos, **When** el usuario hace clic en "Crear GIF", **Then** aparece el botón "↓ Descargar GIF" (en verde) para descargar el segmento como archivo sin audio.
5. **Given** el segmento seleccionado tiene una duración mayor a 6 segundos, **When** el usuario hace clic en "Crear GIF", **Then** se muestra un mensaje de error indicando que el segmento es demasiado largo para un GIF.
6. **Given** el usuario está en la pantalla de recorte, **When** hace clic en "← Volver", **Then** regresa a la pantalla de previsualización y descarga.

---

### Edge Cases

- ¿Qué ocurre si el usuario intenta ingresar una URL de TikTok acortada (ej. `https://vm.tiktok.com/XXXXX`)? → La validación debe aceptarla como válida ya que pertenece al dominio de TikTok.
- ¿Qué ocurre si el usuario establece un INICIO mayor o igual al FIN en el recorte? → El sistema debe impedir avanzar y mostrar un indicador de error en los campos de tiempo.
- ¿Qué ocurre si el usuario establece puntos de recorte que exceden la duración del video? → Los controles del slider deben limitarse a los valores válidos dentro de la duración total del video.
- ¿Qué ocurre si el usuario navega directo a la pantalla de recorte sin pasar por la previsualización? → La interfaz debe redirigir al home.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La interfaz DEBE mostrar una pantalla principal (Home) con: logo de TrimTok, título descriptivo, subtítulo, un campo de texto para ingresar la URL del video de TikTok y un botón "Descargar".
- **FR-002**: La interfaz DEBE validar que el campo de URL no esté vacío al presionar "Descargar"; si está vacío, DEBE mostrar el campo con borde rojo y el mensaje "Pega un enlace de TikTok".
- **FR-003**: La interfaz DEBE validar que la URL ingresada pertenezca al dominio de TikTok (incluyendo variantes como `tiktok.com` y `vm.tiktok.com`); si no lo hace, DEBE mostrar el campo con borde rojo y un mensaje de error apropiado.
- **FR-004**: Tras ingresar una URL válida y hacer clic en "Descargar", la interfaz DEBE mostrar una pantalla de carga con una barra de progreso animada y el texto "Descargando...".
- **FR-005**: Al completarse el proceso de carga (simulado con datos mock en esta fase), la interfaz DEBE navegar automáticamente a la pantalla de previsualización y descarga.
- **FR-006**: La pantalla de previsualización DEBE mostrar: un reproductor de video funcional con el video (mock), el título/descripción del video (truncado si es largo), y los botones "↓ Descargar MP4", "↓ Descargar MP3", "✂ Recortar" y un enlace/botón "Nueva descarga".
- **FR-007**: El botón "Nueva descarga" DEBE regresar al usuario a la pantalla principal con el campo de URL vacío.
- **FR-008**: La pantalla de recorte DEBE mostrar: botón "← Volver", título "Recortar video", reproductor de video, título/descripción del video, un slider de rango (dos controles deslizantes), marcadores de tiempo del rango actual, indicador de "Duración total", campos editables INICIO y FIN en formato `HH:MM:SS`, y los botones "▶ Previsualizar segmento", "✂ Recortar" y "✂ Crear GIF".
- **FR-009**: El slider de la pantalla de recorte DEBE actualizar los campos INICIO y FIN en tiempo real al ser manipulado; igualmente, editar los campos de tiempo DEBE actualizar la posición del slider.
- **FR-010**: El botón "▶ Previsualizar segmento" DEBE hacer que el reproductor reproduzca únicamente el fragmento delimitado por los valores INICIO y FIN actuales.
- **FR-011**: Cuando el usuario hace clic en "Recortar" y el segmento es mayor a 6 segundos, la interfaz DEBE mostrar los botones "↓ Descargar MP4 recortado" y "↓ Descargar MP3 recortado" destacados visualmente (en verde).
- **FR-012**: Cuando el usuario hace clic en "Crear GIF" y el segmento es de 6 segundos o menos, la interfaz DEBE mostrar el botón "↓ Descargar GIF" destacado visualmente (en verde).
- **FR-013**: Si el usuario intenta definir un rango inválido (INICIO ≥ FIN), la interfaz DEBE impedir la acción e indicar el error en los campos de tiempo.
- **FR-014**: La interfaz DEBE mostrar un pie de página con el aviso legal "TrimTok no tiene afiliación con TikTok o ByteDance Ltd." y el año de copyright en todas las pantallas.
- **FR-015**: Toda la navegación entre pantallas DEBE gestionarse en el cliente sin recarga de página.

### Key Entities

- **VideoInfo**: Representa la información del video procesada para mostrar en la interfaz. Atributos relevantes: URL de origen, URL del video (mock), título/descripción, duración total en segundos.
- **TrimSelection**: Representa el segmento de recorte seleccionado por el usuario. Atributos: tiempo de inicio (en segundos), tiempo de fin (en segundos), duración del segmento (calculada).
- **AppState**: Representa el estado de la navegación entre pantallas. Estados: `home`, `downloading`, `preview`, `trim`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede completar el flujo desde ingresar un enlace hasta ver la pantalla de previsualización en menos de 5 pasos de interacción.
- **SC-002**: Los mensajes de error de validación de URL son visibles y comprensibles sin necesidad de leer documentación adicional; la tasa de error por mal ingreso de enlace en pruebas de usuario es menor al 10%.
- **SC-003**: El slider de recorte responde a interacciones (arrastre y edición de campos) de forma inmediata, sin retardo percibido por el usuario.
- **SC-004**: El 100% de las pantallas definidas en los diseños de referencia (home, error de URL, descargando, previsualización, recorte, trimmed, trimmed-for-gif) están implementadas y son navegables en el flujo de usuario.
- **SC-005**: La pantalla de recorte muestra correctamente las opciones de descarga según la duración del segmento: botones MP4/MP3 para segmentos >6 segundos, botón GIF para segmentos ≤6 segundos.
- **SC-006**: La interfaz es completamente funcional en los navegadores modernos de escritorio más utilizados (Chrome, Firefox, Edge) sin errores de consola críticos.

## Assumptions

- Todos los datos del video (URL del video, título, duración) se sirven como datos mock/simulados en esta fase; no hay llamadas reales al backend.
- La pantalla de descarga simula el proceso de carga con una duración fija (ej. 2-3 segundos) antes de avanzar a la previsualización.
- Los botones de descarga (MP4, MP3, GIF) en esta fase pueden ser no-operativos o disparar una descarga de archivo mock; la funcionalidad real de descarga se integrará en una fase posterior.
- El diseño visual sigue fielmente los diseños de referencia provistos (tema oscuro, tipografía en blanco, acentos en verde para acciones primarias de descarga en la pantalla de resultados).
- El límite de duración para la opción GIF es estrictamente de 6 segundos (segmentos ≤6 segundos habilitan "Crear GIF").
- La validación de URL de TikTok en el cliente cubre los formatos de URL más comunes de TikTok (`tiktok.com/@user/video/ID`, `vm.tiktok.com/ID`, `vt.tiktok.com/ID`) sin requerir confirmación del servidor.
- El diseño es responsive pero esta fase prioriza la experiencia de escritorio; la adaptación para mobile puede hacerse en una iteración posterior.
- No se requiere persistencia de datos entre sesiones del navegador; al recargar la página el estado se reinicia al Home.
