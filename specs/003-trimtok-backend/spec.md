# Feature Specification: TrimTok Backend — Serverless Event-Driven

**Feature Branch**: `003-trimtok-backend`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "Crear backend event-driven serverless para TrimTok usando arquitectura orientada a eventos con servicios AWS completamente serverless"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Solicitar descarga de video TikTok (Priority: P1)

Un usuario pega una URL de TikTok en la aplicación frontend y solicita descargar el video. El sistema recibe la solicitud, crea un trabajo de descarga y responde inmediatamente con un identificador de trabajo. El usuario puede seguir el progreso sin bloquear la interfaz.

**Why this priority**: Es el flujo central de la aplicación. Sin la capacidad de iniciar una descarga y retornar un ID de job, ningún otro escenario es posible.

**Independent Test**: Se puede probar enviando una URL válida de TikTok al endpoint de creación de trabajos y verificando que se devuelve un job ID con estado `pending`. El valor entregado es la capacidad de aceptar solicitudes de forma asíncrona.

**Acceptance Scenarios**:

1. **Given** una URL válida de TikTok, **When** el usuario envía la solicitud de descarga, **Then** el sistema crea un job con estado `pending` y retorna el job ID en menos de 3 segundos.
2. **Given** una URL de TikTok ya procesada anteriormente (en caché), **When** el usuario solicita el mismo video, **Then** el sistema reutiliza el artefacto existente y retorna directamente la URL de descarga sin crear un nuevo job de procesamiento.
3. **Given** una URL inválida o que no corresponde a TikTok, **When** el usuario envía la solicitud, **Then** el sistema rechaza la petición con un mensaje de error descriptivo.
4. **Given** dos usuarios que solicitan el mismo video de forma simultánea, **When** el primer job aún está procesando, **Then** el segundo usuario recibe un job vinculado al mismo proceso de descarga sin duplicar el trabajo.

---

### User Story 2 — Consultar el estado de un trabajo (Priority: P1)

El usuario puede consultar en cualquier momento el estado de su trabajo de descarga usando el job ID. El sistema devuelve el estado actual, el progreso y, cuando está listo, la URL de descarga.

**Why this priority**: Esta capacidad es co-dependiente del User Story 1. Sin polling del estado, el usuario no sabría cuándo su video está listo para descargar.

**Independent Test**: Se puede probar creando un job y luego consultando su estado periódicamente hasta que alcance `ready`. El valor entregado es la visibilidad del ciclo de vida del trabajo.

**Acceptance Scenarios**:

1. **Given** un job ID válido en estado `downloading`, **When** el usuario consulta el estado, **Then** el sistema retorna el estado actual y los metadatos disponibles hasta el momento.
2. **Given** un job ID cuyo procesamiento ha terminado exitosamente, **When** el usuario consulta el estado, **Then** el sistema retorna estado `ready` junto con la URL de descarga del artefacto.
3. **Given** un job ID que falló durante el procesamiento, **When** el usuario consulta el estado, **Then** el sistema retorna estado `error` con un mensaje descriptivo del fallo.
4. **Given** un job ID inexistente, **When** el usuario consulta el estado, **Then** el sistema retorna un error 404.

---

### User Story 3 — Recortar un video ya procesado (Priority: P2)

El usuario ya tiene un video en estado `ready` y desea obtener un recorte (trim) entre dos marcas de tiempo específicas. El sistema inicia el procesamiento del recorte de forma asíncrona y avisa cuando el artefacto recortado está disponible.

**Why this priority**: Es la funcionalidad diferenciadora de TrimTok. Permite a los usuarios obtener exactamente la porción del video que necesitan.

**Independent Test**: Se puede probar con un job en estado `ready`, enviando una solicitud de trim con `trim_start` y `trim_end` válidos, y consultando el estado hasta que arrive a `trimmed`. El valor entregado es el artefacto de video recortado listo para descargar.

**Acceptance Scenarios**:

1. **Given** un job en estado `ready`, **When** el usuario solicita un trim con marcas de tiempo válidas, **Then** el sistema crea un nuevo artefacto de trim y transiciona el job a estado `trimming`.
2. **Given** un trim solicitado con marcas de tiempo idénticas a uno ya procesado, **When** llega la solicitud, **Then** el sistema reutiliza el artefacto de trim existente sin reprocesar.
3. **Given** marcas de tiempo inválidas (inicio mayor que fin, o fuera de duración del video), **When** el usuario solicita el trim, **Then** el sistema rechaza la solicitud con un error descriptivo.
4. **Given** un trim completado exitosamente, **When** el usuario consulta el estado, **Then** el sistema devuelve la URL de descarga del artefacto recortado.

---

### User Story 4 — Generar GIF de un video (Priority: P3)

El usuario solicita generar un GIF animado a partir de un video ya procesado, opcionalmente especificando un rango de tiempo. El sistema lo procesa de forma asíncrona.

**Why this priority**: Es una función adicional de valor pero no bloquea el flujo principal de descarga y trim.

**Independent Test**: Se puede probar solicitando generación de GIF sobre un job en estado `ready` y verificando que eventualmente se obtiene un artefacto `.gif` en estado `gif_created`.

**Acceptance Scenarios**:

1. **Given** un job en estado `ready` o `trimmed`, **When** el usuario solicita la generación de GIF, **Then** el sistema inicia el procesamiento y el estado transiciona a `creating_gif`.
2. **Given** un GIF generado exitosamente, **When** el usuario consulta el estado, **Then** el sistema retorna la URL de descarga del GIF.
3. **Given** un GIF ya generado para el mismo video y rango de tiempo, **When** el usuario lo solicita nuevamente, **Then** el sistema reutiliza el GIF existente.

---

### User Story 5 — Limpieza automática de artefactos expirados (Priority: P3)

El sistema limpia automáticamente los artefactos almacenados que han superado su tiempo de retención, liberando capacidad de almacenamiento sin intervención manual.

**Why this priority**: Es necesario para controlar costos operativos a largo plazo, pero no bloquea ninguna funcionalidad de usuario.

**Independent Test**: Se puede verificar que los artefactos con fecha de expiración pasada son eliminados del almacenamiento y su registro de caché es invalidado.

**Acceptance Scenarios**:

1. **Given** artefactos cuya fecha de expiración ha sido superada, **When** se ejecuta el proceso de limpieza, **Then** los artefactos son eliminados del almacenamiento y sus registros de índice son removidos.
2. **Given** un artefacto aún dentro de su período de retención, **When** se ejecuta la limpieza, **Then** el artefacto no es eliminado.
3. **Given** que la limpieza elimina artefactos, **When** se completa el proceso, **Then** queda un registro auditado de los artefactos eliminados con métricas de espacio liberado.

---

### Edge Cases

- ¿Qué ocurre si el video de TikTok es privado o ha sido eliminado al momento de la descarga?
- ¿Qué sucede si el proceso de descarga supera el tiempo máximo permitido por invocación de cómputo?
- ¿Cómo se comporta el sistema si el almacenamiento de artefactos no está disponible temporalmente?
- ¿Qué ocurre si dos eventos de procesamiento del mismo job llegan desordenados (out-of-order)?
- ¿Cómo se maneja la deduplicación cuando un job idéntico es enviado antes de que el primero complete?
- ¿Qué pasa si el proceso de trim o generación de GIF falla a mitad de procesamiento?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE aceptar una URL de TikTok y retornar un job ID inmediatamente (respuesta síncrona) mientras el procesamiento ocurre de forma asíncrona.
- **FR-002**: El sistema DEBE verificar si ya existe un artefacto en caché para la URL solicitada antes de iniciar un nuevo proceso de descarga.
- **FR-003**: El sistema DEBE propagar el progreso de un job a través de eventos que actualicen el estado persistente, garantizando que cada transición de estado sea auditable.
- **FR-004**: El sistema DEBE soportar las siguientes transiciones de estado para un job: `pending` → `downloading` → `ready`, con estado `error` posible desde cualquier estado no terminal. Desde `ready` o `trimmed`, el sistema DEBE soportar las siguientes ramas de procesamiento adicional: `ready` → `trimming` → `trimmed`; `ready`/`trimmed` → `creating_gif` → `gif_created`; `ready`/`trimmed` → `creating_mp3` → `mp3_ready`.
- **FR-005**: El sistema DEBE deduplicar solicitudes de descarga concurrentes del mismo video usando un mecanismo de bloqueo distribuido, de modo que solo se ejecute un proceso de descarga por video en un momento dado.
- **FR-006**: El sistema DEBE almacenar los artefactos procesados (videos originales MP4, trims MP4, GIFs y audios MP3) en almacenamiento duradero con políticas de expiración configurables por tipo de artefacto.
- **FR-007**: El sistema DEBE generar URLs de descarga de acceso temporal con una validez de 1 hora desde su generación. Las URLs expiradas no deben ser accesibles.
- **FR-008**: El sistema DEBE registrar un evento de auditoría por cada operación significativa (inicio de descarga, completado, error, trim solicitado, GIF generado).
- **FR-009**: El sistema DEBE ejecutar automáticamente la limpieza de artefactos expirados según las reglas de retención definidas en la fase de diseño: videos originales y MP3 originales 48 horas en almacenamiento; trims, GIFs y MP3 de trim 24 horas en almacenamiento. Los metadatos de job y los registros de auditoría se retienen 7 días para soporte y trazabilidad. La limpieza se realiza mediante mecanismos nativos de la plataforma (lifecycle rules en almacenamiento + TTL en base de datos) sin requerir cómputo adicional.
- **FR-010**: El sistema DEBE exponer una API HTTP para: crear jobs, consultar estado de jobs, solicitar trim, solicitar generación de GIF, y solicitar extracción de audio en formato MP3.
- **FR-011**: El sistema DEBE validar el formato y autenticidad de las URLs de TikTok antes de iniciar cualquier procesamiento. Además, DEBE rechazar videos cuya duración supere los 5 minutos, retornando un error descriptivo al usuario.
- **FR-012**: El sistema DEBE manejar errores de procesamiento de forma resiliente: ante un fallo, DEBE realizar 1 reintento automático con backoff antes de marcar el job como `error` definitivo, liberar cualquier recurso de bloqueo adquirido y registrar el mensaje de error descriptivo.
- **FR-013** *(Deferred — v2)*: El sistema DEBERÍA soportar distribución geográfica del contenido (CDN) para minimizar la latencia de descarga para usuarios en diferentes regiones. En v1 los artefactos se sirven directamente desde el almacenamiento en una sola región AWS (us-east-1). La integración de CDN se planificará como primera prioridad del siguiente ciclo.
- **FR-014**: El sistema DEBE ser completamente serverless: ningún componente de cómputo debe requerir administración de servidores, patching manual o capacidad reservada fija.
- **FR-015**: Toda la orquestación de pasos (descarga → trim → GIF) DEBE ejecutarse mediante eventos; los pasos no deben llamarse directamente entre sí.
- **FR-016**: La API DEBE aplicar rate limiting por dirección IP a nivel de la capa de entrada, con un umbral mínimo de 10 solicitudes por minuto para el endpoint de creación de jobs. Las solicitudes que superen el límite DEBEN recibir un error 429 con cabecera `Retry-After`.

### Key Entities

- **Job**: Unidad de trabajo que representa la solicitud de procesamiento de un video. Contiene la URL de origen TikTok, estado actual, identificador de video extraído, metadatos del video (título, duración, miniatura), referencias a los artefactos generados, marcas de tiempo de trim solicitadas, registro de error, y fechas de creación y expiración.

- **CacheArtifact**: Registro del índice de caché que apunta a un artefacto almacenado. Identifica de forma única un artefacto por video, formato (`mp4` o `mp3`), tipo (`original`, `trim`, `gif`) y rango de tiempo (trim_start/trim_end). El formato `mp3` aplica a tipos `original` y `trim`. Incluye contador de descargas, tamaño en bytes, título, miniatura, y fechas de creación y expiración.

- **ProcessingEvent**: Registro de auditoría inmutable de cada operación ejecutada sobre un job. Captura tipo de operación, duración en milisegundos, resultado de caché (hit/miss), bytes procesados, marcas de tiempo de trim y contexto geográfico.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los usuarios reciben un job ID en menos de 3 segundos desde que envían una URL de TikTok, independientemente del tiempo de procesamiento real del video.
- **SC-002**: Los videos ya procesados anteriormente se entregan desde caché; el tiempo de respuesta para un caché hit es menor a 1 segundo.
- **SC-003**: El sistema soporta al menos 500 solicitudes de creación de trabajos concurrentes sin degradar los tiempos de respuesta de la API.
- **SC-004**: El procesamiento de un video nuevo (descarga + almacenamiento) concluye en menos de 90 segundos para videos de hasta 5 minutos de duración.
- **SC-005**: El sistema no incurre en costos de cómputo durante períodos de inactividad; los recursos escalan a cero cuando no hay solicitudes activas.
- **SC-006**: La tasa de fallos de jobs por errores de infraestructura (excluyendo errores del video fuente) es menor al 1% del total de trabajos procesados.
- **SC-007**: Los artefactos expirados son eliminados dentro de las 24 horas posteriores a su fecha de expiración.
- **SC-008**: El 100% de las operaciones de procesamiento generan al menos un evento de auditoría, garantizando trazabilidad completa.

## Assumptions

- El frontend ya está desarrollado (feature 002-trimtok-frontend-ui) y consume la API del backend mediante peticiones HTTP estándar.
- Los videos de TikTok son accesibles públicamente desde el entorno de ejecución del backend.
- El sistema no requiere autenticación de usuarios para v1; las descargas son anónimas (sin cuentas de usuario).
- El procesamiento de video (descarga, recorte, conversión a GIF) puede realizarse con herramientas disponibles en el entorno serverless, incluyendo binarios ejecutables en el runtime.
- Los tiempos de ejecución máximos de las funciones serverless son suficientes para procesar videos de hasta 5 minutos (asumiendo hasta 15 minutos de ejecución por función configurable). Videos de mayor duración son rechazados antes del procesamiento.
- La retención de artefactos en almacenamiento sigue estas reglas: videos originales y MP3 originales 48 horas; trims MP4, GIFs y MP3 de trim 24 horas. Los metadatos del job y eventos de auditoría en base de datos persisten 7 días. Estos valores se establecieron en la fase de diseño (research Decision 3) como optimización de costos frente a los valores iniciales de 30/7 días.
- El modelo de datos aprovechará capacidades de almacenamiento de documentos o clave-valor escalables inherentes a la plataforma serverless, sin requerir bases de datos relacionales administradas.
- La infraestructura se desplegará en una sola región AWS para v1, con posibilidad de expansión multi-región en el futuro.
- El sistema de distribución de contenido (CDN) sirve artefactos directamente desde el almacenamiento sin pasar por el cómputo serverless.
- El presupuesto de infraestructura se basa en pago por uso; se asume tráfico inicial bajo-moderado (miles de jobs por día).

## Clarifications

### Session 2026-04-11

- Q: ¿Qué mecanismo de protección se aplicará en la API pública anónima para prevenir abuso de costos? → A: Rate limiting por IP a nivel de la capa de API de entrada (10 req/min por IP para creación de jobs), nativo de la plataforma, sin autenticación de usuario.
- Q: ¿El formato de audio MP3 está en scope para v1? → A: Sí, MP3 como formato de salida opcional que el usuario puede solicitar tanto para el video original como para un trim.
- Q: ¿Cuántos reintentos automáticos debe hacer el sistema ante un fallo de procesamiento antes de marcar un job como `error` definitivo? → A: 1 reintento automático con backoff; si vuelve a fallar, el job pasa a estado `error` definitivo.
- Q: ¿Cuánto tiempo deben ser válidas las URLs de descarga de artefactos? → A: 1 hora desde su generación.
- Q: ¿Cuál es el límite máximo de duración de video aceptado por el sistema? → A: 5 minutos; videos más largos son rechazados con un error descriptivo antes de iniciar cualquier procesamiento.
