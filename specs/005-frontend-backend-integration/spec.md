# Feature Specification: Frontend–Backend Integration

**Feature Branch**: `005-frontend-backend-integration`
**Created**: 2026-04-12
**Status**: Draft
**Input**: User description: "Integremos el frontend y el backend de trimtok, el backend ya está listo en gran medida y el frontend también, solo hace falta remover los mocks en el frontend para empezar a usar los endpoints reales expuestos por el backend"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descargar video de TikTok (Priority: P1)

El usuario pega una URL de TikTok en la pantalla de inicio y el frontend llama al backend real para iniciar la descarga. Mientras el backend procesa, el frontend mantiene una conexión WebSocket activa: al recibir la notificación de que el job está listo, navega automáticamente a la pantalla de previsualización con los datos reales del video (título, duración, URL de streaming desde S3).

**Why this priority**: Es el flujo principal y requisito de todos los demás flujos. Sin descarga real no hay nada que reproducir, recortar ni descargar.

**Independent Test**: El usuario puede pegar una URL de TikTok válida, esperar la descarga y ver el video real reproducirse en la pantalla de previsualización.

**Acceptance Scenarios**:

1. **Given** el usuario está en la pantalla de inicio y el backend está desplegado, **When** pega una URL válida de TikTok y pulsa el botón de descarga, **Then** el frontend establece una conexión WebSocket y hace `POST /v1/jobs` con la URL y `format: "mp4"`, mostrando la pantalla de descarga con el indicador de progreso.
2. **Given** el frontend está en la pantalla de descarga, **When** el backend responde `status: "ready"` (cache hit en la creación del job), **Then** navega inmediatamente a la pantalla de previsualización con los datos del video sin necesidad de esperar al WebSocket.
3. **Given** el frontend tiene una conexión WebSocket activa y el job está en proceso, **When** el backend envía una notificación con `status: "ready"`, **Then** el frontend navega a la pantalla de previsualización con `title`, `duration` y `downloadUrl` reales del backend.
4. **Given** el backend envía una notificación con `status: "error"` por WebSocket, **When** el frontend la recibe, **Then** muestra el `errorMessage` del backend y regresa a la pantalla de inicio permitiendo reintentar.
5. **Given** la conexión WebSocket no se establece o se pierde, **Then** el frontend muestra un mensaje de error de conexión y ofrece volver al inicio.
6. **Given** el job lleva más de 120 segundos sin notificación de finalización, **Then** el frontend cierra la conexión WebSocket, muestra un mensaje de timeout y ofrece volver al inicio.

---

### User Story 2 - Descargar MP4 y MP3 del video completo (Priority: P2)

Desde la pantalla de previsualización, el usuario puede descargar el video completo como MP4 o MP3. Los botones actualmente tienen `console.log` como handlers; deben usar la URL firmada que retorna el backend.

**Why this priority**: Es el caso de uso principal de la app una vez que el video está listo.

**Independent Test**: El usuario puede descargar el MP4 del video completo haciendo clic en "Descargar MP4" y el archivo descargado se reproduce correctamente.

**Acceptance Scenarios**:

1. **Given** el usuario está en la pantalla de previsualización con un video listo, **When** pulsa "Descargar MP4", **Then** el navegador inicia la descarga del archivo MP4 usando la `downloadUrl` firmada de S3 obtenida del backend.
2. **Given** el usuario pulsa "Descargar MP3", **Then** el frontend crea un nuevo job con `format: "mp3"` para el mismo video, hace polling hasta `status: "ready"` y descarga el archivo MP3.

---

### User Story 3 - Recortar video y descargar segmento (Priority: P3)

Desde la pantalla de recorte, al confirmar el recorte los botones de descarga del segmento deben llamar a los endpoints reales de trim (`POST /v1/jobs/:jobId/trim`) y al resolverse, iniciar la descarga.

**Why this priority**: Funcionalidad de valor añadido; requiere que P1 esté completo.

**Independent Test**: El usuario puede recortar un segmento y descargar el MP4 recortado usando los endpoints reales del backend.

**Acceptance Scenarios**:

1. **Given** el usuario ha seleccionado un segmento en la pantalla de recorte y pulsado "Recortar MP4", **When** el backend responde `200 status: "trimmed"` con `downloadUrl` (cache hit), **Then** el navegador descarga el segmento MP4 recortado inmediatamente.
2. **Given** el trim no está en cache, **When** el backend responde `202 status: "trimming"`, **Then** el frontend hace polling a `GET /v1/jobs/:jobId` hasta que `status: "trimmed"` y luego inicia la descarga automáticamente.
3. **Given** el usuario pulsa "Descargar MP3 recortado", **Then** el flujo es equivalente pero llama a `POST /v1/jobs/:jobId/mp3` con `trimStart` y `trimEnd`.

---

### User Story 4 - Crear y descargar GIF (Priority: P4)

El botón "Crear GIF" en la pantalla de recorte debe llamar a `POST /v1/jobs/:jobId/gif` y descargar el MP4 silencioso resultante cuando esté listo.

**Why this priority**: Funcionalidad secundaria; requiere que P1 esté completo.

**Independent Test**: El usuario puede crear un GIF (MP4 silencioso H.264) de hasta 6 segundos y descargarlo.

**Acceptance Scenarios**:

1. **Given** el usuario ha seleccionado un segmento ≤ 6 segundos y pulsado "Crear GIF", **When** el backend responde con `downloadUrl` listo, **Then** el navegador descarga el archivo MP4 silencioso.
2. **Given** el GIF ya está en cache, **When** el backend responde `200 status: "gif_created"` con `downloadUrl`, **Then** la descarga inicia inmediatamente sin espera adicional.

---

### Edge Cases

- ¿Qué pasa si el backend tarda más de 120 segundos en procesar la descarga? → Cerrar la conexión WebSocket, mostrar mensaje de timeout y permitir reintentar.
- ¿Qué pasa si el backend envía `status: "error"` por WebSocket? → Cerrar la conexión, navegar a home con el `errorMessage` visible.
- ¿Qué pasa si la conexión WebSocket se pierde inesperadamente (ej. caída de red)? → El frontend muestra un mensaje de error de conexión y ofrece reintentar.
- ¿Qué pasa si el usuario navega a otra pantalla mientras la conexión WebSocket está activa? → La conexión debe cerrarse al desmontar el componente para evitar memory leaks.
- ¿Qué pasa si el usuario intenta pegar una URL inválida (no TikTok)? → El backend retorna 400 en el `POST /v1/jobs`; el frontend lo muestra en la pantalla de inicio sin llegar a abrir una conexión WebSocket.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El frontend DEBE leer la URL base del backend desde la variable de entorno `NEXT_PUBLIC_API_URL` y la URL del WebSocket desde `NEXT_PUBLIC_WS_URL`, usando ambas en sus respectivos módulos de cliente.
- **FR-002**: La `DownloadingScreen` DEBE reemplazar el mock de 2500ms por: (1) abrir una conexión WebSocket autenticada con el `jobId` y (2) hacer `POST /v1/jobs` con la URL del video y `format: "mp4"`.
- **FR-003**: Cuando `POST /v1/jobs` retorne `status: "pending"` o `status: "downloading"`, el frontend DEBE esperar la notificación del backend vía WebSocket con `status: "ready"` o `status: "error"` en lugar de hacer polling HTTP.
- **FR-004**: La conexión WebSocket DEBE tener un timeout máximo de 120 segundos sin notificación de finalización; al superarlo, cerrar la conexión, mostrar un mensaje de error y permitir volver al inicio.
- **FR-005**: Al recibir la notificación WebSocket con `status: "ready"`, el frontend DEBE poblar el estado de la aplicación con `jobId`, `title`, `duration` (como `durationSeconds`), `thumbnailUrl` y `downloadUrl` del backend.
- **FR-006**: El `AppState` y los tipos de `AppAction` DEBEN extenderse para incluir el `jobId` activo en el estado `previewing` y `trimming`, necesario para llamadas posteriores de trim/gif.
- **FR-007**: El botón "Descargar MP4" en `PreviewScreen` DEBE iniciar una descarga del archivo usando la `downloadUrl` del job activo, sin llamadas adicionales al backend.
- **FR-008**: El botón "Descargar MP3" en `PreviewScreen` DEBE crear un nuevo job con `format: "mp3"` para la misma URL de TikTok y descargar el resultado cuando esté listo.
- **FR-009**: Los botones de descarga de segmentos en `TrimScreen` DEBEN llamar a `POST /v1/jobs/:jobId/trim` con `trimStart` y `trimEnd`, y a `POST /v1/jobs/:jobId/mp3` para MP3, iniciando descarga al resolverse.
- **FR-010**: El botón "Crear GIF" en `TrimScreen` DEBE llamar a `POST /v1/jobs/:jobId/gif` con `trimStart` y `trimEnd`, y descargar el archivo resultante cuando el backend lo tenga listo.
- **FR-011**: Todos los errores de red y errores HTTP del backend (4xx, 5xx) DEBEN ser capturados, mostrar un mensaje legible al usuario y ofrecer volver a la pantalla de inicio.
- **FR-012**: La conexión WebSocket DEBE cerrarse automáticamente al desmontar el componente que la inició, evitando memory leaks y conexiones fantasma.
- **FR-013**: El archivo `front/src/lib/mock-data.ts` y los imports de `MOCK_VIDEO_DATA` en componentes DEBEN eliminarse una vez que el flujo real esté implementado.

### Key Entities

- **Job** (backend): Representa una operación de descarga o procesamiento. Campos relevantes: `jobId`, `status` (`pending` | `downloading` | `ready` | `trimming` | `trimmed` | `creating_gif` | `gif_created` | `error`), `title`, `duration`, `thumbnailUrl`, `downloadUrl`, `trimStart`, `trimEnd`, `format`, `errorMessage`.
- **VideoData** (frontend, `app-state.ts`): Estado local del video cargado. Debe extenderse para incluir `jobId` y `thumbnailUrl` para habilitar llamadas posteriores.
- **ApiClient** (`front/src/lib/api-client.ts`): Módulo nuevo que encapsula todos los `fetch` al backend: `createJob`, `getJob`, `requestTrim`, `requestGif`, `requestMp3`.
- **WsClient** (`front/src/lib/ws-client.ts`): Módulo nuevo que gestiona la conexión WebSocket con el backend: apertura, recepción de notificaciones de job, cierre y manejo de errores de conexión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede descargar un video de TikTok desde cero en menos de 60 segundos en condiciones normales de red.
- **SC-002**: El 100% de los botones de descarga y recorte llaman a endpoints reales — cero `console.log` como handlers de acción de descarga.
- **SC-003**: El frontend maneja correctamente errores del backend sin pantallas en blanco ni excepciones no capturadas; el usuario siempre tiene una ruta de escape al inicio.
- **SC-004**: El flujo completo (inicio → descarga → previsualización → descarga MP4) funciona end-to-end con el backend SST desplegado.
- **SC-005**: La conexión WebSocket se cierra correctamente al navegar entre pantallas; no quedan conexiones abiertas tras abandonar la pantalla de descarga.

## Assumptions

- El backend SST ya está desplegado y accesible. La URL de la API se configura en `.env.local` del frontend (`NEXT_PUBLIC_API_URL`).
- El frontend usa `output: "export"` en Next.js — no hay Server Actions ni API routes propias; todas las llamadas son `fetch` directo desde el cliente.
- El backend ya expone un WebSocket API Gateway en `NEXT_PUBLIC_WS_URL`. El frontend se conecta a este endpoint para recibir notificaciones en tiempo real de cambios de `status` en los jobs.
- Los videos descargados por el backend ya están en H.264/AAC y son reproducibles directamente en el elemento `<video>` del navegador sin transcodificación adicional.
- La `downloadUrl` que retorna el backend es una URL pre-firmada de S3 válida por al menos 1 hora.
- No se implementa autenticación de usuario en esta iteración.
- Los tests de integración e2e existentes en el frontend pueden requerir actualización de mocks para seguir pasando tras estos cambios.
