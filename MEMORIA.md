# MEMORIA.md — Torneo Dojo (antes "Zenkai Dojo")

Documento de traspaso para retomar el trabajo en una sesión nueva. Última actualización: 2026-11-25 (sesión 8: el producto pasa a llamarse **Torneo Dojo** en todo lo visible; manual de usuario nuevo en `docs/manual/Manual_Torneo_Dojo.pdf`). **Estado: proyecto completo y verificado; despliegue pendiente de que el usuario cree las cuentas (ver `DEPLOY.md`).** La documentación de usuario está en `README.md`; este archivo resume el estado interno.

---

## 1. Resumen del proyecto

**Torneo Dojo** (nombre interno del repositorio y de la BD: `zenkai`) es un sistema web para gestionar torneos de deportes de combate (multi-deporte, configurable; Jiu-Jitsu Brasileño precargado): deportes, torneos, categorías (peso × edad × cinturón × género), academias, atletas, inscripciones, pesaje, generación de llaves (4 formatos), tatamis y programación, registro de resultados desde mesa de control, medallero/ranking, vista pública en vivo (polling) con modo TV, y exportación PDF/Excel.

**Roles:** `ADMIN` (control total), `TABLE` (mesa: solo resultados en sus tatamis asignados), público (sin login, solo lectura).

**Stack:**
- Backend: Node 22 en Docker/Render (`engines`; la máquina local usa Node 26) + TypeScript (ESM), **Fastify 5.12**, **Prisma 5.22**, PostgreSQL, Zod (`fastify-type-provider-zod`), `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/swagger` + `swagger-ui` (docs en `/docs`, desactivable con `DOCS_ENABLED=false`), bcryptjs, pdfkit, exceljs, vitest.
- Frontend: **React 18 + Vite 5 + TypeScript**, Tailwind 3 (tokens CSS), Framer Motion 11, React Router 6, TanStack Query 5, lucide-react, `xlsx` (import Excel/CSV en cliente).
- Infra: docker-compose con PostgreSQL 16, backend Node 22 y frontend servido por nginx. Demo en internet: Render (API Free + sitio estático) + Neon Free, descrito en `render.yaml` y `DEPLOY.md`. Node 22 fijado (`engines`, `.node-version`, `NODE_VERSION`).
- Monorepo: `/backend`, `/frontend`, `docker-compose.yml`, `README.md`, `docs/capturas/`.

---

## 2. Estado actual

Todo el alcance del encargo está implementado y verificado.

- [x] Backend completo: 14 módulos, OpenAPI en `/docs`, 46 pruebas Vitest en verde
- [x] Frontend completo: público, admin con 9 pestañas por torneo, mesa de control y modo TV
- [x] `TournamentAdminPage` y pestañas Inscripciones, Pesaje, Llaves, Tatamis, Auditoría y Exportar (sesión 2)
- [x] `ResultModal` extraído a `frontend/src/components/ResultModal.tsx` y reutilizado por mesa y admin
- [x] docker-compose (db + backend + nginx), Dockerfiles, entrypoint con `migrate deploy` + seed solo si la BD está vacía
- [x] README con ER (mermaid), arquitectura, dirección de diseño, decisiones, uso por rol y resultados de verificación
- [x] E2E por la UI con Playwright: crear torneo → configurar → inscribir → pesar → llave → mesa registra 5 combates y corrige → público y medallero → 5 exportaciones. Sin errores
- [x] Barrido responsive 360/768/1024/1440/1920 × claro/oscuro × reduced-motion en 16 pantallas, contra el build de Docker: sin desbordes ni errores de consola
- [x] axe-core WCAG 2.1 AA: 0 violaciones (había 4 tipos; corregidos)
- [ ] Lighthouse no se ejecutó; axe cubre las reglas de accesibilidad automatizables
- [x] Pruebas e2e versionadas en `frontend/e2e` (Playwright, **88 pruebas**): foco en modales con teclado real, creación/validación de formularios y llave con rueda/zoom/arrastre en 5 anchos × 2 temas (sesión 4); navegación pública, Error Boundary, admin, mesa, sesión y tiempo real (sesión 5)
- [x] Manual de usuario en PDF con capturas (sesión 6; rehecho en la sesión 8: `docs/manual/Manual_Torneo_Dojo.pdf`, 22 páginas)
- [x] Repositorio git con commit inicial (sesión 7). **Sin remoto**: el usuario crea el repo en GitHub y hace `git push` (comandos en `DEPLOY.md` §1)
- [x] Preparado para Render + Neon (sesión 7). **Despliegue real pendiente** (lo hace el usuario en los paneles)

### Cambios relevantes de la sesión 2
- Mesa: "Iniciar" ya no abre el diálogo de resultado (lo tapaba durante todo el combate)
- `/auth/me` y login devuelven `tournamentName` en los tatamis de la mesa, para distinguir tatamis homónimos de torneos distintos
- PDF: cabeceras de tabla alineadas, marcador de ganador dibujado (Helvetica no tiene ▶ ni emojis), fechas sin hora
- Excel de torneo ahora **requiere sesión** (contiene documento, correo y teléfono). Los PDF siguen públicos
- Contraste: oro y ámbar más oscuros en claro; token `--c-on-accent` (texto oscuro sobre acentos en modo oscuro); podio con rellenos de medalla fijos
- `.card` es `position: relative` (una etiqueta sr-only escapaba del scroll de las tablas)
- Llave: etiqueta de método/orden en el borde inferior, más separación entre filas, BYE con borde discontinuo en vez de opacidad; (sesión 4: en móvil la llave pasó a árbol vertical, ver más abajo)
- Modo TV escala `font-size` de `<html>` con `clamp(16px, 1.15vw, 30px)`
- `xlsx` se carga bajo demanda; vendor en chunks separados (bundle principal ≈ 49 kB gzip)
- Producción: `disableRequestLogging` para no registrar cada health check

### Revisión de la sesión 3 (errores confirmados y corregidos)
- **Editar categoría con llave fallaba siempre** (no se podía cambiar tatami ni nombre): el formulario reenvía todos los campos y el backend rechazaba cualquier presencia de `format`/`gender`/…. Ahora solo rechaza cambios reales de valor.
- **Usuario desactivado o con rol cambiado seguía operando** hasta que caducaba su JWT (12 h). `plugins/auth.ts` relee el usuario de la BD en cada petición autenticada; el rol vigente es el de la BD.
- **La mesa podía leer documento y contacto** de atletas e inscripciones. `GET /api/athletes[/:id]` y `GET /api/tournaments/:id/registrations` ahora son solo ADMIN.
- **Torneos en borrador accesibles sin sesión** conociendo el id (llave, tatamis en vivo, medallero, PDF, combates). Nuevo `src/lib/visibility.ts` (`assertPublicTournament`, `assertPublicCategory`): sin sesión válida → 404.
- `?status=` del endpoint público de combates sin validar → 500. Ahora es enum (400 si es inválido).
- Un token inválido en una ruta pública se trata como petición pública (antes podía quedar `req.user` a medias).
- Verificado: 46 tests, E2E por la UI, barrido 160 combinaciones y axe 0 violaciones. El backend de Docker se reconstruyó con estos cambios.

### Sesión 4: tres fallos encontrados por el usuario en el navegador

La QA anterior no los detectó porque usaba `fill()` (no simula teclear con foco real) y no probaba la rueda del ratón. Ahora las pruebas usan `pressSequentially` / `keyboard.type`, `mouse.wheel` y emulación de móvil.

**1. El foco saltaba al botón "Cerrar" al escribir en cualquier modal con formulario**
- *Causa raíz:* en `components/ui/Modal.tsx` el efecto de apertura dependía de `[open, onClose]`. Todos los formularios pasan `onClose` inline (función nueva en cada render), así que cada pulsación re-renderizaba el padre, el efecto se limpiaba y re-ejecutaba, y su autofoco (`querySelector('input,select,textarea,button')`) elegía el primer enfocable en orden del documento: el botón "Cerrar" de la cabecera. El campo perdía el foco tras la primera tecla y quedaba vacío.
- *Solución:* `onClose` se guarda en una ref; el efecto depende solo de `open`. Foco inicial una vez por apertura: `[data-autofocus]` → primer campo del cuerpo → primer botón del pie → el diálogo. Se añadió trampa de Tab/Shift+Tab y la devolución del foco al elemento que abrió el modal. No había formularios definidos dentro de otros componentes ni `key` inestables (revisado).

**2. "Datos inválidos" al crear torneo o deporte**
- *Causa raíz:* con datos válidos la API guardaba bien (201). El aviso aparecía porque, por el fallo 1, los campos quedaban con 0–1 caracteres (sede `min(2)`, filas nuevas de método vacías). Además el backend devolvía los issues de Zod en inglés y en un formato que el frontend ignoraba, y `useMut` solo mostraba un toast genérico. Defectos asociados: opcionales vacíos guardados como `""`, y nombre duplicado → 409 sin indicar el campo.
- *Solución:*
  - Backend: `src/lib/zod-es.ts` registra mensajes en español globalmente; el manejador de errores de `app.ts` devuelve `details.fields = { "ruta.del.campo": "mensaje" }` (incluye rutas anidadas como `victoryMethods.1.code`); P2002 se mapea al campo (`name: "Ya existe un registro con este valor"`); `fieldErrors()` en `lib/errors.ts` para errores manuales (ej. fecha de fin anterior a la de inicio). `optionalText()` recorta y convierte `""` en `null`. Esquemas con `trim()` y máximos.
  - Frontend central: `useMut` acepta `schema` (Zod, o función que lo devuelve) y valida en el cliente antes de enviar; expone `fieldErrors` (cliente o servidor). `<FormErrors errors={m.fieldErrors}>` en `ui/Field.tsx` reparte los mensajes por `name` a `Input`/`Select`/`Textarea`/`InlineInput`, pone `aria-invalid` y `aria-describedby`, limpia el error al editar el campo y enfoca el primer campo inválido. Toast: "Revisa los campos marcados". Esquemas en `lib/validation.ts` (mismos mensajes que el backend).
  - Conectado en: torneo (crear y configurar), divisiones, grupos de edad, deporte, academia, usuario, atleta, categoría, inscripción (alta y edición) y login. Los formularios usan `<form noValidate onSubmit>` con botón `type="submit"` en el pie (`form="id"`).

**3. La llave se veía mal en móvil y se "perdía" con el trackpad**
- *Causa raíz (medida con rueda real):* `onWheel` sin Ctrl sumaba el delta a la traslación **sin límite** y, al ser un listener pasivo de React, tampoco evitaba el scroll de la página: se movían ambas y con un trackpad el gráfico salía del lienzo. En móvil el ajuste tenía un mínimo de escala 0.35 (384 px de llave en 358 px), `touch-action: none` bloqueaba el scroll con el dedo, la altura era fija (72 dvh, lienzo vacío) y el ajuste no se recalculaba al cambiar tamaño/orientación. Al reescribir aparecieron dos causas más: el contenido `absolute` medía como ancho el del lienzo (faltaba `width: max-content`), y la transición CSS animaba desde escala 1 al primer encaje (se pintaba desbordado 120 ms). Y `overscroll-behavior: contain` en un contenedor `overflow:hidden` bloqueaba el scroll de la página en Chrome (se quitó).
- *Solución (`components/Bracket.tsx`):*
  - < 768 px (`useMediaQuery`): árbol **vertical**; rondas de arriba abajo, combates emparejados con conector "]" que se vuelve dorado al resolverse, y texto "Los ganadores se enfrentan en Semifinal 2". Ancho = pantalla, solo scroll vertical natural.
  - ≥ 768 px: horizontal con auto-ajuste al ancho (`ResizeObserver` del lienzo y del contenido), altura = contenido escalado (máx. 75 vh), `clamp` de arrastre y zoom (nunca más pequeño que el encaje), rueda **sin** Ctrl ignorada (desplaza la página), Ctrl/⌘ + rueda o pinza del trackpad = zoom alrededor del cursor (listener no pasivo), pinza táctil con dos dedos, `touch-action: pan-y`, botón "Ajustar a pantalla", doble clic/doble toque para reajustar, contenido oculto hasta el primer encaje y transición activa un fotograma después.
  - Vista "Lista" se mantiene (botones de 44 px). Podio: los nombres largos hacen salto de línea (sin `…`) y tienen `title`.

**Verificación de la sesión 4:** backend `typecheck` + 46 tests; frontend `typecheck` + `build`; `npx playwright test` → 68 pruebas en verde contra Vite local y contra el build de Docker (`E2E_BASE_URL=http://localhost:8080`); barrido 16 pantallas × 5 anchos × 2 temas con axe → 0 violaciones; axe en modales con errores visibles (claro/oscuro, 390 px) → 0. El bundle principal pasa de ≈ 49 a ≈ 67 kB gzip (Zod en el cliente).

### Sesión 5: pantalla en negro al pulsar el logo desde una categoría

**Síntoma (reportado por el usuario):** en `/t/:id/c/:cid`, al pulsar el logo la pantalla completa quedaba en negro (también el header) y la URL era `localhost:5173/`.

**Causa raíz (reproducida con Playwright y medida):** no era una excepción de React. `App.tsx` envolvía las rutas en `<AnimatePresence mode="wait">` con `exit={{ opacity: 0 }}` y `key` = primeros 3 segmentos de la ruta. Torneo (`/t/ID`) y categoría (`/t/ID/c/CID`) comparten esa clave, así que al llegar a la categoría *navegando* desde el torneo se reutiliza el mismo `motion.div`. Al salir a `/`, la animación de salida llegaba a `opacity: 0` pero `mode="wait"` nunca completaba la salida: la página de inicio no se montaba y la categoría quedaba invisible (`#root > div` con `opacity: 0` indefinidamente, URL ya en `/`). Pasaba con y sin `prefers-reduced-motion`, sin `pageerror` ni `console.error`, y **no ocurría al cargar la categoría directamente** (por eso la QA anterior no lo vio). Descartado: limpieza de `Bracket`/`MatchBox`, caché de TanStack Query, `fullName(null)`, polling.

**Corrección:** `App.tsx` ya no usa `AnimatePresence` ni `exit`; solo animación de entrada (`initial`/`animate`) con la misma `key`. Hay un comentario en el código que explica el motivo: **no volver a poner `AnimatePresence mode="wait"` alrededor de las rutas.**

**Error Boundaries** (`components/ErrorBoundary.tsx`, clase React):
- Raíz (`main.tsx`, `scope="aplicación"`), ruta (`App.tsx`, `scope="ruta"`, cubre TV y login) y página (dentro de `PublicLayout` y `AppLayout` alrededor del `<Outlet/>`, `scope="página"`, así el header/menú siguen visibles).
- Mensaje "Algo salió mal", botones "Reintentar" (rearma el límite) y "Volver al inicio" (enlace nativo `/`, no depende del router). El límite de ruta/página se rearma solo al cambiar de ruta (`resetKey`).
- En desarrollo (`import.meta.env.DEV`) muestra el detalle (mensaje + primeras líneas de la pila); en producción solo el mensaje amable. Usa tokens de tema (`card`, `text-ink`, `text-shu`), `role="alert"`.
- Registra en consola `[ErrorBoundary:<scope>] ruta=<pathname> componente=<primer frame del componentStack>` con el error y la pila.

**Pruebas añadidas** (`frontend/e2e`, 20 nuevas; total 88):
- `helpers.ts`: `watchErrors(page)` (falla ante `pageerror`, `console.error` o respuestas 5xx), `expectPageAlive` (h1 visible **y** `#root > div` con opacidad 1), `expectNoHorizontalOverflow`.
- `navigation.spec.ts`: categoría → logo → inicio para las 8 categorías, con/sin movimiento reducido (comprobado que **falla con el código antiguo**); logo tras arrastrar/hacer zoom en la llave y un ciclo de polling; atrás/adelante/F5 en rutas profundas (incluye TV); recorrido público en 3 anchos × 2 temas con clics reales y sin desbordes; Error Boundary (datos corruptos simulados con `page.route` → "Algo salió mal" con header intacto, Reintentar, log en consola); el guardián detecta un `pageerror`.
- `app-tour.spec.ts`: las 6 pantallas de admin y las 9 pestañas del torneo con clics reales en 3 anchos (+ F5 en ruta profunda); la mesa no entra a `/admin*`; sin sesión y token inválido → login y token limpiado; cerrar sesión borra el token; usuario desactivado pierde acceso (crea y borra un usuario temporal); tiempo real: un combate iniciado por la API de mesa aparece "En curso" en la llave pública en ≤ 12 s **sin reiniciar el zoom**, y se restaura con `cancel-start`.

**Otros hallazgos de la pasada:** ninguna otra excepción, 5xx ni desborde en 3 anchos × claro/oscuro (público, admin, mesa); 0 errores/500 en los logs del backend (dev y Docker). Pendiente menor, sin arreglar: los avisos de consola de React Router 6 (`v7_startTransition`, `v7_relativeSplatPath`) — no son errores; activar los *future flags* cambia el momento de las actualizaciones de estado, conviene probarlo aparte.

**Verificación sesión 5:** backend `typecheck` + 46 tests; frontend `typecheck` + `build`; `npx playwright test` → 88/88 en verde contra Vite (:5173) y contra el build de Docker (`E2E_BASE_URL=http://localhost:8080`); `docker compose logs backend` sin errores.

**Cómo ejecutar las nuevas:** `cd frontend && npx playwright test e2e/navigation.spec.ts e2e/app-tour.spec.ts` (con app y backend levantados; mismas credenciales del seed). El test de tiempo real necesita un combate PENDING con ambos lados en un tatami de `mesa@zenkai.dojo` (el seed lo tiene; si no, se salta).

**Estado del entorno al cerrar la sesión 5:** stack de Docker **levantado** con `API_PORT=4100` (web http://localhost:8080, API :4100, db sin puerto publicado); backend y Vite de desarrollo corriendo (:4000 y :5173, lanzados con `nohup`, no mueren con la sesión). Si el compose se levanta sin `API_PORT`, el :4000 choca con el backend de desarrollo. El puerto 5433 lo comparten el Postgres local de Zenkai, el túnel de Colima y el contenedor de otro proyecto (`stockya-db-1`).

### Sesión 6: llave gráfica en móvil, app más sencilla y manual de usuario

**1. Llave en móvil (petición del usuario: no gustó el árbol vertical, quería el gráfico).** `components/Bracket.tsx` ya no decide por ancho de pantalla: el gráfico horizontal (`ZoomableBracket`) se usa también en móvil. En < 768 px arranca a escala legible (`readable`: una ronda y el principio de la siguiente, para invitar a deslizar), la altura del lienzo es la del contenido (sin tope; la página hace el scroll vertical), se desliza de lado a lado con un dedo, pinza para zoom, doble toque o botón "Tamaño normal" para volver y "Ver completa" para encajar toda la llave. El árbol vertical sigue existiendo como opción (`layout="vertical"`). `CategoryPage` tiene selector **Gráfico | Vertical (solo móvil) | Lista** (el botón "Llave" pasó a llamarse "Gráfico"; el título h2 sigue siendo "Llave"). `e2e/bracket.spec.ts` actualizado: en móvil comprueba el gráfico, que la rueda no lo mueve, "Ver completa" y la vista vertical.

**2. App más sencilla.**
- `SummaryTab` es ahora una **guía de 8 pasos** (Configurar → Categorías → Inscribir → Pesar → Llaves → Tatamis → Resultados → Exportar) con marca verde en los hechos, dato por paso y tarjeta "Siguiente paso" con botón.
- `TournamentAdminPage`: línea de ayuda (`HELP`) bajo las pestañas explicando qué se hace y qué sigue.
- `AdminDashboard`: tarjeta "Cómo funciona" (4 pasos). `TablePage`: frase de uso de la mesa.
- `Tabs`: borde derecho desvanecido (máscara, solo < 1024 px) para indicar que hay más pestañas.
- `WeighInTab`: en móvil el nombre ocupa toda la fila (antes se partía en 3 líneas).
- **Bug corregido:** importar un CSV UTF-8 rompía los acentos (`AthletesPage` leía el CSV como binario). Ahora los `.csv` se leen como texto.

**3. Manual de usuario en PDF.** *(Sustituido en la sesión 8: ver arriba.)* `docs/Manual_de_usuario_Zenkai_Dojo.pdf` (43 páginas, 45 capturas). Fuente editable: `docs/manual/manual.html` + `docs/manual/img/*.png`. Se regenera así (app y backend levantados con los datos del seed, desde `frontend/`): `node scripts/manual-shots.mjs` (capturas; `BASE=…` para otra URL) y `node scripts/manual-pdf.mjs` (PDF). El índice del HTML tiene números de página a mano: tras cambiar el contenido hay que repasarlos (comprobados contra el PDF el 2026-11-17). Las capturas usan los datos del seed; si se vuelve a sembrar cambian nombres/estados.

**Verificación sesión 6:** `tsc -b` y `npm run build` del frontend, `typecheck` del backend, `npx playwright test` → 88/88 en verde contra Vite. El frontend de Docker (:8080) se reconstruyó con estos cambios.

### Sesión 8: renombrado a "Torneo Dojo" y manual nuevo

**Renombrado (solo lo visible; identificadores internos intactos).** Logo (`Logo.tsx`: Torneo·Dojo), `aria-label` "Torneo Dojo, inicio" (e2e `navigation.spec.ts` actualizado), `<title>` y meta de `index.html`, antetítulo del inicio, lema del login ("Tu torneo, de principio a fin"), Swagger "Torneo Dojo API", log del servidor y del entrypoint, PDF exportados ("TORNEO DOJO", autor), Excel (`creator`, nombre `torneo_dojo_<torneo>.xlsx`). Seed: torneo **"Open de Madrid 2026"**, academia "Dojo Central Madrid" (DCM), correos **`@torneo.dojo`** (`admin@`, `mesa@`, `mesa2@`; también en e2e, tests, `.env.example`, docker-compose, README y DEPLOY). Se dejaron a propósito: BD/rol `zenkai`, proyecto compose `zenkai-dojo`, claves `localStorage` `zenkai-theme`/`zenkai-token` y evento `zenkai:logout` (cambiarlas cerraría sesiones y no se ven), nombres de paquete, carpeta del proyecto y sugerencias de nombre de repo GitHub/proyecto Neon en `DEPLOY.md`. `DEPLOY.md` usa ya los servicios `torneo-dojo-api` / `torneo-dojo` de `render.yaml`.

**Login:** la caja "Credenciales de prueba" solo se muestra con `import.meta.env.DEV` (en la demo publicada las contraseñas son las de `SEED_*` y la caja mostraba otras). Placeholder del correo: `tu@correo.com`.

**Manual** (`docs/manual/`): `manual.html` (fuente, identidad visual de la app: papel washi, bermellón, Zen Kaku Gothic New + Inter + JetBrains Mono) + `img/*.png` (46 capturas) → `Manual_Torneo_Dojo.pdf` (A4, 22 páginas, ~7 MB, índice con enlaces, marcadores y "Página X de Y"). Orden: portada, índice, qué es, primeros pasos, guía del administrador (3.1–3.9), mesa, vista pública, FAQ (8). Se borró `docs/Manual_de_usuario_Zenkai_Dojo.pdf`.
- Regenerar (desde `frontend/`, con backend + Vite levantados y **datos recién sembrados** — `npm run seed` en backend borra la BD local): `npm run manual` (= `manual:shots` + `manual:pdf`).
- `scripts/manual-shots.mjs`: escritorio 1440 px (admin), tablet 768 (mesa), móvil 390 (público), modo claro forzado, recuadros dorados numerados (`mark(page, locator, n, side)`; no desplaza la página, el número va en `tl|tr|l|r|b`). Chromium en macOS ignora `--lang` en los `input[type=date|datetime-local]`: `shot()` los convierte a texto dd/mm/aaaa 24 h antes de capturar. La caja de credenciales de desarrollo se quita del DOM. No cambia datos salvo un atleta temporal "Laura Ejemplo Ruiz" para la captura de inscripción, que se borra al momento. Para recortes con coordenadas del documento usar `full: true` + `clip`.
- `scripts/manual-pdf.mjs`: dos pasadas; lee con `pdfjs-dist` (devDependency nueva) la página de cada destino `#c1`, `#s3-2`… y rellena `.pg` del índice (ya no hay números a mano). Falla si una página se mueve entre pasadas.
- Revisión: cada página renderizada y revisada; texto extraído del PDF sin "Zenkai" ni contraseñas.

**Verificación sesión 8:** backend `typecheck` + 60 tests; frontend `typecheck` + `build`; `npx playwright test` → 88/88 contra Vite con el seed nuevo. La BD local de desarrollo se volvió a sembrar (datos nuevos). El stack de Docker (:8080/:4100) **no** se reconstruyó: sigue con el código y los datos antiguos.

**Pendiente para el usuario:** `git push` para que Render despliegue. Si la BD de Neon ya estaba sembrada, seguirá mostrando "Zenkai Open 2026" y `mesa@zenkai.dojo` hasta ejecutar `seed:demo:reset` (`DEPLOY.md` §8); revisar también `SEED_ADMIN_EMAIL` en Render. Las capturas del README (`docs/capturas/`) son antiguas y aún muestran el logo anterior.

### Sesión 7: preparar el despliegue gratuito (Render + Neon)

**Backend**
- `src/lib/env.ts` reescrito: `parseEnv()` exportada (con pruebas). En `NODE_ENV=production`: `JWT_SECRET` obligatorio (≥ 16, nunca el de desarrollo; el de ejemplo `cambia-este-secreto-en-produccion` se acepta con aviso para no romper Docker), `CORS_ORIGIN` obligatorio, lista exacta separada por comas, nunca `*` (fuera de producción, `*`/vacío = abierto). Nuevas: `DOCS_ENABLED` (Swagger en `/docs`, por defecto true), `TRUST_PROXY` (true en Render).
- `app.ts`: CORS con `exposedHeaders: ['Content-Disposition']` (sin esto el frontend en otro dominio no ve el nombre del PDF/Excel), `@fastify/rate-limit` (global: false) + `@fastify/helmet` (CSP compatible con Swagger: `'unsafe-inline'` solo en `style-src` y solo con docs; **sin** `upgrade-insecure-requests` porque Docker sirve `/docs` por http; **no** usar `staticCSP: true` en swagger-ui, impone su propia CSP con upgrade-insecure-requests; CORP `cross-origin`). `logController: new LogController({ disableRequestLogging })` (la opción antigua está deprecada en Fastify 5.12; `fastify` pasa a `^5.12.0`). `GET /health` y `GET /api/health` sin BD (el segundo atraviesa el proxy de nginx/Vite; lo usa el frontend).
- Login: 10 intentos cada 15 min por **IP + correo** (`hook: 'preValidation'` para que el cuerpo esté leído; con `onRequest` el correo no entraba en la clave). 429 → `AppError` `RATE_LIMIT` con mensaje en español.
- Prisma: `directUrl = env("DIRECT_URL")`. `DATABASE_URL` = pooler de Neon (app), `DIRECT_URL` = directa (migraciones). Con Prisma 5.22 no hace falta `pgbouncer=true`. `channel_binding=require` lo entiende el motor (probado: con Postgres local sin TLS falla, con Neon es lo esperado). Docker, `backend/.env` y `.env.example` tienen `DIRECT_URL` (misma cadena en local).
- Seed: credenciales en `prisma/seed-credentials.ts`. Desarrollo: `admin123`/`mesa123`. Producción o `SEED_REQUIRE_ENV=true`: exige `SEED_ADMIN_PASSWORD` y `SEED_TABLE_PASSWORD` (≥ 6 caracteres, por `mesa123` de Docker), `SEED_ADMIN_EMAIL` opcional; se validan **antes** de borrar nada y no se imprimen en logs. Los usuarios de mesa siguen siendo `mesa@`/`mesa2@zenkai.dojo`.
- `seed-if-empty.ts` respeta `SEED_ON_START=false`. Nuevo `prisma/demo-reset.ts` → `npm run seed:demo:reset` (tsx): exige `ALLOW_DEMO_RESET=true` y fuerza `SEED_REQUIRE_ENV`. Render Free no tiene shell: se ejecuta desde el ordenador del usuario con `backend/.env.demo` (ignorado por git), ver `DEPLOY.md` §8.
- Scripts: `start:prod` (= migrate deploy → seed-if-empty → server). `engines.node = 22.x`, `.node-version` en backend y frontend.
- Pruebas nuevas: `tests/env.test.ts` y `tests/http.test.ts` (app.inject sin BD: health, helmet, CORS, 429, docs on/off). **60 pruebas**.

**Frontend**
- `lib/api.ts`: `API_BASE` = `VITE_API_URL` sin barra final (vacía → rutas relativas, como antes en Docker/dev); usada en `api()`, `downloadUrl` y `downloadFile`. No había enlaces a `/docs` en el frontend. `send()` tolera el arranque en frío: GET/HEAD se reintentan ante error de red o 502/503/504 con espera creciente (1, 2, 4, 8, 10 s…) durante ~90 s; escrituras: si no hubo respuesta en 10 min primero se despierta con `/api/health` y luego se envían una vez (solo se reintentan ante 502/503, para no duplicar altas). `isTransientError()` exportada.
- `lib/serverStatus.ts`: estado `ok | waking | down` (store con `useSyncExternalStore`). "waking" si una petición pasa de 3 s **y** no hubo respuesta en 2 min (un PDF lento con el servidor despierto no dispara el aviso) o si falla de forma transitoria; "down" al agotar ~90 s, con comprobación en segundo plano cada 15 s; `onRecovered` → `invalidateQueries()`.
- `components/ServerWakeNotice.tsx` (montado en `main.tsx`): tarjeta fija arriba, `role="status"` + `aria-live`, tokens de tema (claro/oscuro), spinner con `motion-reduce:animate-none`, contador de segundos `aria-hidden`; en "down": "El servidor aún no responde" + botón Reintentar. `data-testid="server-wake-notice"`.
- `main.tsx`: Query reintenta errores transitorios 3 veces (2, 4, 8 s); 4xx una vez como antes. `auth.tsx`: solo un 401 borra el token; con el servidor dormido se mantiene "Cargando…" y se reintenta `/auth/me` al recuperarse.
- `e2e/helpers.ts`: `apiLogin` cachea el token por usuario (el límite de login frenaba la batería: 12 fallos con 429).

**Infra y docs**
- `render.yaml` (validado con el esquema oficial `https://render.com/schema/render.yaml.json` vía ajv): API `rootDir: backend`, free, `region: ohio` (emparejar con Neon AWS us-east-2), build `npm ci --include=dev && npx prisma generate && npm run build` (**`--include=dev` necesario**: con `NODE_ENV=production` npm omite TypeScript y Prisma CLI), start `npx prisma migrate deploy && node dist/prisma/seed-if-empty.js && node dist/src/server.js`, `healthCheckPath: /health`, `JWT_SECRET generateValue`, resto `sync: false`. Web: `runtime: static`, `rootDir: frontend`, `npm ci && npm run build`, `staticPublishPath: dist`, rewrite `/*` → `/index.html`, cabeceras de seguridad y caché de `/assets/*`. Ojo: `sync: false` solo se pregunta al crear el Blueprint.
- docker-compose: `DIRECT_URL`, `CORS_ORIGIN` por defecto `http://localhost:${WEB_PORT:-8080}` (antes `*`, que ahora se rechaza en producción), `SEED_*` con `admin123`/`mesa123` por defecto, `DOCS_ENABLED`. Comportamiento igual que antes.
- `.gitignore`: `.env.*` (salvo `.env.example`), `*.tsbuildinfo`, informes de Playwright. Se versionan `docs/manual/img` (≈ 10 MB, fuente del manual) y el PDF (8 MB).
- `DEPLOY.md`: guía paso a paso (GitHub, Neon con las dos cadenas + `connect_timeout=15`, Blueprint, orden de URLs, comprobación, problemas, monitor cron-job.org cada 5 min, reset, qué compartir). Límites verificados el 2026-11-24: Render Free 750 h/mes por cuenta, se duerme a los 15 min, sin shell; Neon Free 100 CU‑h/mes, 1 GB, suspende a los 5 min.

**Verificación sesión 7:** backend `typecheck` + 60 tests; frontend `typecheck` + `build`. Simulación de producción local: backend compilado con `NODE_ENV=production` (:4300, BD vacía aparte → migraciones + seed con `SEED_*`, reinicio sin re-sembrar), frontend compilado con `VITE_API_URL=http://localhost:4300` servido en :4400 (`vite preview`). Playwright con clics y teclado: público → torneo → categoría (llave, F5 en ruta profunda) → PDF público → login → crear torneo → descargar PDF y Excel (nombres correctos) → 0 errores de consola/CORS/5xx, todas las llamadas al otro origen. Swagger renderiza sin errores de CSP. 429 al 11.º intento; origen ajeno sin `Access-Control-Allow-Origin`. Arranque en frío con proxy delante del backend: (a) peticiones retenidas 25 s → aviso a los ~3 s, datos a los 26 s sin recargar; (b) 502 durante 20 s, modo oscuro, admin con sesión → sesión conservada y recuperada; (c) servidor caído > 90 s → "aún no responde" + Reintentar y recuperación sola al volver. `seed:demo:reset`: bloqueado sin `ALLOW_DEMO_RESET`, aborta sin credenciales sin borrar nada, y restablece con ellas. Docker: stack nuevo aislado (`-p zenkai-check`, volumen vacío) → migraciones + seed por defecto, nginx/SPA/Swagger OK, **e2e 88/88**; luego se borró y se reconstruyó el stack habitual (`API_PORT=4100`, datos conservados).

**Estado del entorno al cerrar la sesión 7:** stack Docker levantado (web :8080, API :4100); backend y Vite de desarrollo siguen en :4000 y :5173. La BD temporal `zenkai_prodsim` se borró.

## 3. Estructura del proyecto

```
Zenkai_Dojo/
├─ MEMORIA.md                      ← este archivo
├─ README.md                       documentación de usuario (instalación, ER, diseño, decisiones, verificación)
├─ docker-compose.yml              db (postgres:16) + backend (:4000) + frontend nginx (:8080)
├─ render.yaml                     Blueprint de Render (API Free + sitio estático)
├─ DEPLOY.md                       guía de despliegue Render + Neon para el usuario
├─ .env.example                    variables de compose (contraseñas, JWT_SECRET, puertos, SEED_ON_START)
├─ .gitignore
├─ docs/capturas/                  capturas usadas en el README
├─ docs/manual/                    manual.html + img/ (fuente) y Manual_Torneo_Dojo.pdf (resultado; `npm run manual` en frontend)
├─ backend/
│  ├─ Dockerfile                   multi-stage node:22-slim con openssl
│  ├─ docker-entrypoint.sh         prisma migrate deploy → seed-if-empty → node dist/src/server.js
│  ├─ package.json                 scripts: dev, build, start (dist/src/server.js), prisma:*, seed, seed:prod, seed:if-empty, test, typecheck
│  ├─ tsconfig.json                ESM NodeNext, strict
│  ├─ vitest.config.ts             tests en tests/**/*.test.ts
│  ├─ .env / .env.example          DATABASE_URL, JWT_SECRET, PORT, CORS_ORIGIN (.env local apunta a puerto 5433)
│  ├─ prisma/
│  │  ├─ schema.prisma             modelo completo (ver §4)
│  │  ├─ migrations/               init + victory_points
│  │  ├─ seed.ts                   datos de prueba reproducibles (PRNG fijo). ⚠️ borra todo antes de cargar
│  │  ├─ seed-if-empty.ts          ejecuta el seed solo si no hay usuarios (arranque en Docker y Render; SEED_ON_START=false lo omite)
│  │  ├─ seed-credentials.ts       credenciales del seed (dev por defecto; SEED_* obligatorias en producción)
│  │  └─ demo-reset.ts             npm run seed:demo:reset (exige ALLOW_DEMO_RESET=true)
│  ├─ src/
│  │  ├─ server.ts / app.ts        bootstrap Fastify, swagger, error handler unificado, registro de rutas
│  │  ├─ lib/ env.ts, prisma.ts, errors.ts (AppError, notFound, badRequest, fieldErrors), schemas.ts (enums Zod), visibility.ts (ocultar borradores al público), zod-es.ts (mensajes en español + optionalText)
│  │  ├─ plugins/auth.ts           JWT + decoradores authenticate/requireRole/optionalAuth; relee usuario activo y rol de la BD
│  │  └─ modules/
│  │     ├─ auth/routes.ts         POST /api/auth/login, GET /api/auth/me (mats incluyen tournamentName)
│  │     ├─ users/routes.ts        CRUD /api/users (admin), matIds por usuario
│  │     ├─ sports/routes.ts       CRUD /api/sports (métodos de victoria con points, cinturones con color/secondary)
│  │     ├─ tournaments/routes.ts  CRUD torneos + /weight-divisions + /age-groups
│  │     ├─ categories/            service.ts (findMatchingCategories, buildCategoryName), routes.ts (CRUD + /generate + /empty)
│  │     ├─ academies/routes.ts
│  │     ├─ athletes/routes.ts     CRUD + POST /api/athletes/import (rows JSON normalizadas)
│  │     ├─ registrations/         weighin.ts (validateWeight, competitionAge), routes.ts (inscribir, weigh-in, suggestions, disqualify, auto-assign)
│  │     ├─ brackets/
│  │     │  ├─ types.ts            Participant, GenMatch, GenerateOptions
│  │     │  ├─ generator.ts        ★ generación pura (SE, SE+bronce, DE, RR; BYEs; siembra; evitar misma academia)
│  │     │  ├─ advance.ts          ★ applyResult: propagación de ganador/perdedor e invalidación en cascada
│  │     │  ├─ standings.ts        ★ tabla RR con desempates por grupos
│  │     │  ├─ podium.ts           ★ computePodium por formato
│  │     │  ├─ service.ts          persistencia: generateForCategory, deleteBracket, getBracket, recordResult, refreshCategoryStatus, assignMatOrder
│  │     │  ├─ dto.ts              schemas Zod de salida (matchOut, bracketOut…)
│  │     │  └─ routes.ts           GET/POST/DELETE /api/categories/:id/bracket[/generate]
│  │     ├─ matches/routes.ts      /api/mats/:id/matches, /api/matches/:id/{start,cancel-start,result,reset,audit}, /api/tournaments/:id/audit
│  │     ├─ mats/routes.ts         CRUD tatamis, PUT /mats/:id/users, PUT /tournaments/:id/schedule, PATCH /matches/:id/schedule, GET /tournaments/:id/mats/live (público)
│  │     ├─ medals/                calc.ts ★ computeMedalTable, service.ts tournamentMedals, routes.ts GET /api/tournaments/:id/medals (público)
│  │     ├─ public/routes.ts       /api/public/tournaments[/:id][/categories], /api/public/categories/:id/bracket, /api/public/tournaments/:id/matches
│  │     └─ exports/routes.ts      /api/export/categories/:id/bracket.pdf, tournaments/:id/{participants,schedule,results}.pdf (públicos), tournaments/:id/export.xlsx (requiere sesión), athletes/template.xlsx
│  └─ tests/                       helpers.ts, generator, advance, weighin, medals, env, http (*.test.ts) (60 tests ✅)
└─ frontend/
   ├─ Dockerfile, nginx.conf       build Vite → nginx; proxy /api y /docs → backend:4000; fallback SPA
   ├─ package.json, vite.config.ts (proxy /api → :4000, alias @, chunks react/motion/query), tailwind.config.js, postcss.config.js, index.html (tema anti-flash), .env.example
   ├─ tsconfig.json                strict + noUnusedLocals/noUnusedParameters
   ├─ scripts/                     manual-shots.mjs (capturas del manual) y manual-pdf.mjs (PDF con índice numerado solo; usa pdfjs-dist)
   ├─ playwright.config.ts         e2e; baseURL = E2E_BASE_URL o http://localhost:5173
   ├─ e2e/                         helpers.ts (watchErrors, expectPageAlive…), modals-focus, forms-validation, bracket, navigation, app-tour (*.spec.ts)
   ├─ public/favicon.svg
   └─ src/
      ├─ main.tsx                  providers: Query, Theme, MotionConfig(reducedMotion="user"), Toast, Auth, Router
      ├─ App.tsx                   rutas + navs admin/mesa (solo animación de entrada; NO usar AnimatePresence mode="wait")
      ├─ index.css                 tokens de color (incl. --c-on-accent), .card (relative)/.obi/.btn-*/.input/.tatami-weave
      ├─ vite-env.d.ts
      ├─ lib/ api.ts (fetch con reintentos de arranque en frío+token+downloadFile; API_BASE = VITE_API_URL), serverStatus.ts (estado ok/waking/down), types.ts, format.ts (labels ES), auth.tsx, theme.tsx, motion.ts, toast.tsx, queries.ts (hooks públicos con polling 5s), hooks.ts (useMut con schema y fieldErrors), validation.ts (esquemas Zod de formularios), useMediaQuery.ts
      ├─ components/ui/ Logo, BeltBadge, Badge, States, Modal (foco estable + trampa de Tab), Field (FormErrors, InlineInput), Tabs, Page, ThemeToggle
      ├─ components/ ServerWakeNotice (aviso de arranque en frío), ErrorBoundary, MatchBox, Bracket, Podium, MatBoard, MedalTable, Standings, MatchList, ResultModal
      ├─ layouts/ PublicLayout, AppLayout
      └─ pages/
         ├─ LoginPage.tsx
         ├─ public/ HomePage, TournamentsPage, TournamentPage, CategoryPage, TvPage
         ├─ admin/ AdminDashboard, SportsPage, AcademiesPage, UsersPage, AdminTournamentsPage, TournamentForm, AthletesPage
         │   ├─ TournamentAdminPage.tsx (pestañas por URL /admin/torneos/:id/:tab)
         │   └─ tournament/ shared.ts + Summary, Config, Categories, Registrations, WeighIn, Brackets, Mats, Audit, Export (*Tab.tsx)
         └─ table/ TablePage.tsx
```

---

## 4. Decisiones de diseño y técnicas

### Modelo de datos (Prisma)
`User(role ADMIN|TABLE) → MatAssignment ← Mat`, `Sport → VictoryMethod(points) / BeltLevel(color, secondary)`, `Tournament(status, pointsGold/Silver/Bronze) → WeightDivision(minKg?, maxKg?, gender?) / AgeGroup / Category / Mat / Registration`, `Category(gender, format, status, tiebreakRules, avoidSameAcademy, matId, scheduledAt, order) → CategoryBelt (cinturones agrupados opcional)`, `Academy → Athlete(document único) → Registration(tournamentId+athleteId único; declaredWeight, weightKg, weighInStatus, seed)`, `Match(side WINNERS|LOSERS|GRAND_FINAL|THIRD_PLACE|ROUND_ROBIN, round, position, label, order, redId/blueId/winnerId, victoryMethodId, status PENDING|IN_PROGRESS|FINISHED|BYE, nextMatchId+nextSlot, loserNextId+loserNextSlot, matId, matOrder, scheduledAt, resultById)`, `ResultAudit(previous*/new*, reason, userId)`.

### Reglas de negocio implementadas
- **Edad competitiva** = año del torneo − año de nacimiento (convención IBJJF).
- **Rangos de peso inclusivos**; `minKg`/`maxKg` null = sin límite (absoluto).
- **Pesaje**: `OK | OVERWEIGHT | UNDERWEIGHT`; si falla, el backend devuelve categorías sugeridas (mismo género/edad/cinturón, división que contiene el peso, status OPEN). `DISQUALIFIED` excluye de la llave.
- **Auto-asignación de categoría** solo si hay exactamente 1 coincidencia; si hay varias queda sin categoría para decisión manual.
- **Llaves**: siembra estándar (1 vs N…), BYEs para los mejores seeds; "participante vs vacío" → combate `BYE` con ganador preasignado (visible); "pendiente vs vacío" se **colapsa** recableando la fuente; vacío-vacío se elimina.
- **Evitar misma academia en R1**: intercambio greedy solo entre no sembrados; si es imposible, no falla.
- **Eliminación simple sin bronce**: 2 bronces = perdedores de semifinal (regla BJJ). **Con bronce**: ganador del combate por 3º; si hubo BYE en semis y el combate se colapsó, bronce = perdedor de la única semi real.
- **Eliminación doble**: WB + LB + **gran final única (sin reset de llave)**; bronce = perdedor de la final de repechaje; cruces LB en orden inverso para evitar revanchas tempranas.
- **Round robin**: método del círculo; desempates configurables por grupos (`WINS, HEAD_TO_HEAD, METHOD_POINTS, FEWEST_LOSSES, DRAW`), puntos por método desde `VictoryMethod.points`.
- **Resultado** = solo ganador + método. Corrección: la mesa debe indicar `reason`; el admin no. Cada cambio crea `ResultAudit`; los combates posteriores cuyos participantes cambian se **invalidan en cascada** (vuelven a PENDING, con auditoría).
- **Regenerar/eliminar llave** solo si no hay combates `IN_PROGRESS|FINISHED`. Cambiar formato/división/edad/cinturón/género de categoría solo si status `OPEN`.
- **Estado de categoría** automático: OPEN → BRACKET_READY → IN_PROGRESS → FINISHED; el torneo pasa a IN_PROGRESS al primer combate.
- **Mesa**: solo opera combates de sus `MatAssignment`; admin opera todo. No accede a datos personales (atletas, inscripciones).
- **Sesión**: cada petición autenticada comprueba en la BD que el usuario existe y está activo.
- **Público**: torneos `DRAFT` no se exponen en ninguna ruta sin sesión (404). Tiempo real por **polling** (5 s llaves/tatamis, 15 s medallero/categorías) en lugar de WebSocket (simplicidad tras proxies).
- **Cola por tatami** (`matOrder`): se recalcula al generar llave y al programar (orden: `scheduledAt` de categoría → `order` de categoría → `order` de combate).
- **Importación**: el frontend parsea Excel/CSV con `xlsx` y envía JSON; cabeceras flexibles (nombres/apellidos/documento/fechaNacimiento/genero/cinturon/academia/pesoDeclarado/email/telefono). Crea academias faltantes, upsert por documento, inscribe y auto-asigna si se indica torneo.
- **Medallero**: puntos configurables por torneo (9/3/1 por defecto); orden puntos → oros → platas → bronces → nombre.
- **Exportación**: los PDF son públicos (solo datos ya visibles en la vista pública). El XLSX completo **requiere sesión** porque incluye documento, correo y teléfono. PDF con pdfkit (llave dibujada por columnas con conectores; ganador marcado con una barra dorada dibujada, no con caracteres especiales); XLSX con exceljs (hojas Participantes, Categorías, Resultados, Medallero, Podios).
- **Mesa**: "Iniciar" solo marca el combate en curso; el resultado se registra con "Registrar ganador". También puede registrarse sin iniciar.

### Dirección visual — "Tatami & Obi"
- Paleta semántica vía variables CSS (`--c-*`) consumidas por Tailwind (`bg-bg`, `text-ink`, `bg-shu`…): **shu** (bermellón, acción / esquina roja), **ai** (índigo, esquina azul / enlaces), **tatami** (verde, OK/en curso), gold/silver/bronze, warn. Claro = papel washi `#f4f1ea`; oscuro = gris azulado `#15181f` (nunca negro puro). Texto sobre acentos con `text-on-accent` (blanco en claro, tinta oscura en oscuro). Podio con rellenos de medalla fijos y texto tinta. Verificado con axe: 0 violaciones AA. **No usar `opacity` para atenuar texto** (rompe el contraste); usar borde discontinuo o fondo.
- Tipografías Google Fonts: **Zen Kaku Gothic New** (títulos), **Inter** (texto), **JetBrains Mono** (números, clase `.num`).
- Formas: radios 10 px (`rounded-dojo`), franja vertical "obi" (`.obi`, color vía `--obi`), textura sutil de tatami (`.tatami-weave`), logo ensō + barra.
- Esquinas rojo/azul siempre con **texto o icono además del color** (sr-only "Rojo:"/"Azul:", 🏆 ganador, tachado perdedor).
- Tema: `data-theme` en `<html>`, auto por sistema + selector manual (localStorage `zenkai-theme`), script anti-flash en `index.html`.
- Movimiento: Framer Motion con `MotionConfig reducedMotion="user"` + CSS `prefers-reduced-motion`; transiciones 150–400 ms; conectores de llave con `pathLength` animado al avanzar; podio escalonado.
- Responsive mobile-first: nav inferior <640 px (público) / <1024 px (admin y mesa), sidebar en PC, zonas táctiles ≥ 44 px (`min-h-touch`), mesa con botones de 52–112 px.
- Modo TV: `/t/:id/tv`, rotación automática tatamis ↔ medallero cada 20 s, reloj, fullscreen API, `font-size` de `<html>` escalado con `clamp(16px, 1.15vw, 30px)`.
- Llave: gráfico horizontal en todos los tamaños (en móvil a escala legible y deslizable; ≥ 768 px con auto-ajuste), zoom solo con Ctrl/⌘ + rueda o pinza, arrastre limitado. La rueda normal nunca mueve la llave (desplaza la página). Vistas alternativas: Vertical (solo móvil) y Lista.

---

## 5. Cómo ejecutar el proyecto

### Requisitos locales
Node ≥ 20, PostgreSQL. En esta máquina hay un Postgres local (Homebrew) en **puerto 5433** (socket `/tmp`) con rol/BD `zenkai`/`zenkai`; `backend/.env` apunta ahí y su BD quedó recién sembrada al final de la sesión 2. Docker Desktop está instalado; se arrancó con `open -a Docker`.

### Backend
```bash
cd backend
npm install                       # (si pide aprobar scripts: npm install-scripts approve esbuild @prisma/client @prisma/engines prisma)
cp .env.example .env              # ajustar DATABASE_URL
npx prisma migrate dev            # o: npm run prisma:migrate (deploy)
npm run seed                      # datos de prueba
npm run dev                       # http://localhost:4000  — docs: http://localhost:4000/docs
npm test                          # 46 tests vitest
npm run typecheck
```
El puerto 4000 lo ocupa el backend de Docker si el stack está levantado: `docker compose stop backend` antes de `npm run dev`, o arranca compose con `API_PORT=4100`.

### Frontend
```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173 (proxy /api → :4000; VITE_API_PROXY para otro puerto)
npm run typecheck && npm run build
```

### Pruebas e2e (Playwright)
```bash
cd frontend
npx playwright install chromium                     # solo la primera vez
npm run test:e2e                                    # 88 pruebas contra http://localhost:5173 (app + backend levantados)
E2E_BASE_URL=http://localhost:8080 npm run test:e2e # contra Docker
```
Requieren los datos del seed (credenciales de prueba). Crean datos con sufijo único y los borran al terminar.

Desarrollo local con Docker levantado (sesión 4; en la sesión 5 se hizo al revés: dev en :4000 y compose con `API_PORT=4100 docker compose up -d --build`): backend con `PORT=4100 npx tsx watch src/server.ts` y frontend con `VITE_API_PROXY=http://localhost:4100 npx vite`.

### Credenciales de prueba (seed)
| Rol | Correo | Contraseña | Tatamis |
|---|---|---|---|
| Admin | `admin@torneo.dojo` | `admin123` | todos |
| Mesa | `mesa@torneo.dojo` | `mesa123` | Tatami 1 |
| Mesa | `mesa2@torneo.dojo` | `mesa123` | Tatamis 2 y 3 |

En producción (`NODE_ENV=production`, incluido Docker) las contraseñas salen de `SEED_ADMIN_PASSWORD` / `SEED_TABLE_PASSWORD` (Docker las pone por defecto a `admin123` / `mesa123`; en Render las elige el usuario) y el correo admin de `SEED_ADMIN_EMAIL`.

### Variables de entorno nuevas (sesión 7)
Backend: `DIRECT_URL` (obligatoria para Prisma; en local igual que `DATABASE_URL`), `DOCS_ENABLED`, `TRUST_PROXY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_TABLE_PASSWORD`, `ALLOW_DEMO_RESET`. Frontend: `VITE_API_URL` (ya existía en `api.ts`; ahora documentada y usada en todas las llamadas). Tabla completa al final de `DEPLOY.md`.

Torneo seed: "Open de Madrid 2026" (IN_PROGRESS; antes "Zenkai Open 2026"), 8 categorías (SE, SE+bronce, DE, RR), 3 finalizadas, 2 en curso (una con combate IN_PROGRESS en Tatami 1), 2 sin llave, 1 atleta con sobrepeso y 2 sin pesar.

### docker-compose
```bash
docker compose up -d --build       # web http://localhost:8080 · API :4000 · docs /docs
docker compose down -v             # borrar también la base de datos
```
Verificado: construye y arranca en una sola orden; migraciones + seed en BD vacía; un reinicio conserva datos ("se omite el seed"); web, API y Swagger responden a través de nginx.

Variables en `.env.example` de la raíz. **Estado al cerrar la sesión 5:** ver el final de la sección de la sesión 5 (Docker levantado con `API_PORT=4100`; backend y Vite de desarrollo en marcha).

---

## 6. Problemas conocidos y pendientes

- **Doble eliminación sin "bracket reset"**: si el campeón del repechaje gana la gran final, no hay segunda final. Decisión documentada en el README.
- **Zonas horarias**: `scheduledAt` se guarda en UTC. El PDF de horarios muestra la hora en UTC, mientras la web usa la hora local del navegador.
- **QA visual/axe no versionada**: el barrido de 160 combinaciones con axe sigue fuera del repo. Para repetirlo: Playwright + `@axe-core/playwright` recorriendo las 16 rutas en 360/768/1024/1440/1920 × claro/oscuro con `reducedMotion: 'reduce'`, comprobando `scrollWidth > innerWidth`, errores de consola y axe con tags `wcag2a, wcag2aa, wcag21a, wcag21aa`.
- **Seed destructivo**: `npm run seed` borra toda la BD. En Docker se usa `seed-if-empty`.
- **Seguridad de despliegue**: en Docker siguen los valores de ejemplo (`JWT_SECRET` de ejemplo, avisado en el log; `admin123`). En producción (`NODE_ENV=production`) el servidor exige `JWT_SECRET` y un `CORS_ORIGIN` exacto. Límite de login en memoria (se reinicia con el proceso; una sola instancia en Render, suficiente).
- **Demo pública**: las credenciales de administración se comparten con clientes, que pueden crear/borrar datos; restablecer con `seed:demo:reset` de vez en cuando.
- **Bundle de `xlsx`** (≈ 140 kB gzip) se carga solo al importar atletas.

### Siguiente paso sugerido
**Inmediato (lo hace el usuario):** `git push` de la sesión 8 y, si la demo ya estaba sembrada, `seed:demo:reset`; crear el repo en GitHub y `git push`, crear el proyecto en Neon y el Blueprint en Render siguiendo `DEPLOY.md`, ajustar `CORS_ORIGIN`/`VITE_API_URL` con las URL reales y configurar el monitor de `/health`. Después, comprobar la demo en línea (recorrido del §5 de `DEPLOY.md`).

Posibles mejoras: restablecer la demo automáticamente (p. ej. GitHub Action programada con secretos), activar los future flags de React Router 6 (v7_startTransition, v7_relativeSplatPath) y probar, añadir el barrido axe a `frontend/e2e`, integrar `test:e2e` en CI, inicializar git, y opcionalmente WebSocket o SSE en vez de polling.
