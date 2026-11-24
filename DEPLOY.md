# Desplegar la demo de Zenkai Dojo (gratis, 24/7)

Guía paso a paso para publicar una demo que los posibles clientes puedan probar libremente:

| Pieza | Dónde | Plan |
|---|---|---|
| Web (React, sitio estático) | Render → *Static Site* | Gratis |
| API (Fastify + Prisma) | Render → *Web Service* | Free |
| Base de datos PostgreSQL | Neon | Free |

Todo está descrito en [`render.yaml`](render.yaml) (un *Blueprint* de Render). Tú solo creas las cuentas, copias dos cadenas de conexión y rellenas unas variables en los paneles. **Nunca escribas contraseñas ni cadenas de conexión en archivos del repositorio** ni en el chat.

> El despliegue con Docker (`docker compose up -d --build`) sigue funcionando igual; esta guía es solo para la demo en internet.

---

## 0. Lo que conviene saber antes

- **El backend gratuito de Render se duerme** tras 15 min sin visitas y tarda hasta ~1 min en despertar. La web lo gestiona sola: si la primera petición tarda más de 3 s muestra *"Despertando el servidor, puede tardar hasta un minuto…"* y reintenta. Con el monitor del paso 7 casi nunca se dormirá.
- **Render da 750 horas gratis al mes por cuenta**: alcanzan para **un** servicio web encendido 24/7 (un mes tiene como mucho 744 h). No tengas otro servicio web gratuito en la misma cuenta. El sitio estático no gasta horas.
- **Neon Free**: 1 GB de datos por proyecto y 100 CU‑horas de cómputo al mes. La base se suspende tras 5 min sin consultas y despierta en menos de un segundo. El health check (`/health`) **no consulta la base de datos**, así que el monitor no gasta horas de Neon.
- Sin consola (*shell*) en el plan gratuito de Render: el restablecimiento de la demo se hace desde tu ordenador (paso 8).

Prepara también las **credenciales de la demo** (las que darás a los clientes). Mínimo 6 caracteres; mejor algo fácil de dictar pero no trivial, por ejemplo:

| Variable | Ejemplo (invéntate las tuyas) |
|---|---|
| `SEED_ADMIN_EMAIL` | `demo@zenkai.dojo` |
| `SEED_ADMIN_PASSWORD` | `Dojo-Demo-2026` |
| `SEED_TABLE_PASSWORD` | `Mesa-Demo-2026` (para `mesa@zenkai.dojo` y `mesa2@zenkai.dojo`) |

---

## 1. Subir el código a GitHub

1. En GitHub: **New repository** → nombre (p. ej. `zenkai-dojo`) → **Private** o Public → **sin** README, .gitignore ni licencia (el proyecto ya los tiene) → *Create repository*.
2. En la terminal, desde la carpeta del proyecto (sustituye `TU_USUARIO`):

```bash
cd /Users/jesuscf/Propio/Proyectos/Zenkai_Dojo
git remote add origin https://github.com/TU_USUARIO/zenkai-dojo.git
git branch -M main
git push -u origin main
```

Comprueba en GitHub que **no** aparecen `backend/.env`, `node_modules` ni `dist` (los excluye `.gitignore`).

---

## 2. Crear la base de datos en Neon

1. Entra en <https://neon.com> → **Sign up** (puedes usar tu cuenta de GitHub).
2. **Create project**:
   - *Project name*: `zenkai-dojo`
   - *Postgres version*: la que proponga (16 o superior).
   - *Region*: **AWS US East 2 (Ohio)**, que es la región del backend en `render.yaml` (`region: ohio`). Si tus clientes están en Europa, elige **AWS EU Central 1 (Frankfurt)** y cambia `region: ohio` por `region: frankfurt` en `render.yaml` antes de crear el Blueprint (haz commit y push).
3. (Recomendado) En **Branches → main → Compute** deja el tamaño en **0.25 CU** fijo para estirar las 100 CU‑horas del mes.
4. En el panel del proyecto pulsa **Connect**. Se abre un diálogo con la cadena de conexión:
   - Con **Connection pooling activado** → copia la cadena. El host contiene `-pooler`. Esta es **`DATABASE_URL`** (la usa la app).
   - Con **Connection pooling desactivado** → copia la cadena. El host **no** contiene `-pooler`. Esta es **`DIRECT_URL`** (la usa `prisma migrate deploy` para las migraciones).
5. Las dos cadenas ya terminan en `?sslmode=require&channel_binding=require`. Déjalo así y **añade al final `&connect_timeout=15`** (da margen a que Neon despierte). Quedan así (con tus datos):

```
DATABASE_URL = postgresql://USUARIO:CLAVE@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15
DIRECT_URL   = postgresql://USUARIO:CLAVE@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15
```

Guárdalas en un gestor de contraseñas: las vas a pegar en Render.

> ¿Por qué dos? La app abre muchas conexiones cortas y conviene que pasen por el *pooler* (PgBouncer). Las migraciones de Prisma necesitan una conexión directa. Con Prisma 5.22 **no** hace falta añadir `pgbouncer=true`.

---

## 3. Crear el Blueprint en Render

1. Entra en <https://render.com> → **Get Started** → regístrate con GitHub y autoriza el acceso al repositorio `zenkai-dojo`.
2. **New → Blueprint** → elige el repositorio → rama `main`. Render lee `render.yaml` y muestra dos servicios:
   - `zenkai-dojo-api` (Web Service, Free)
   - `zenkai-dojo` (Static Site)
3. Render pide las variables marcadas como `sync: false`. Rellénalas así:

| Servicio | Variable | Valor |
|---|---|---|
| zenkai-dojo-api | `DATABASE_URL` | cadena **con** `-pooler` de Neon |
| zenkai-dojo-api | `DIRECT_URL` | cadena **sin** `-pooler` de Neon |
| zenkai-dojo-api | `CORS_ORIGIN` | `https://zenkai-dojo.onrender.com` (provisional, ver paso 4) |
| zenkai-dojo-api | `SEED_ADMIN_EMAIL` | el correo de la demo |
| zenkai-dojo-api | `SEED_ADMIN_PASSWORD` | la contraseña de administración de la demo |
| zenkai-dojo-api | `SEED_TABLE_PASSWORD` | la contraseña de las mesas |
| zenkai-dojo | `VITE_API_URL` | `https://zenkai-dojo-api.onrender.com` (provisional, ver paso 4) |

   `JWT_SECRET` lo genera Render solo (valor aleatorio); `NODE_ENV`, `NODE_VERSION=22`, `TRUST_PROXY`, `DOCS_ENABLED` y `SEED_ON_START` ya vienen en el Blueprint.

4. **Deploy Blueprint / Apply**. Render compila los dos servicios. En el primer arranque el backend aplica las migraciones y, como la base está vacía, **carga los datos de demo** con tus credenciales. Los arranques siguientes no tocan los datos.

> Si falta alguna variable o es insegura, el backend **no arranca** y el log lo dice en español (p. ej. *"JWT_SECRET es obligatorio en producción"*, *"CORS_ORIGIN no puede ser `*` en producción"*, *"Faltan variables para el seed de demo"*). Corrígela en **Environment** y vuelve a desplegar.

---

## 4. Orden correcto: primero el backend, luego las URL reales

Las URL `https://zenkai-dojo-api.onrender.com` y `https://zenkai-dojo.onrender.com` son las esperadas, pero si el nombre ya está cogido Render añade un sufijo (p. ej. `zenkai-dojo-api-x7k2.onrender.com`). Por eso:

1. Espera a que **zenkai-dojo-api** esté **Live**. Abre `https://<tu-api>.onrender.com/health` → debe responder `{"ok":true,…}`.
2. Copia la **URL real del backend** (arriba en la página del servicio).
3. Abre **zenkai-dojo** (Static Site) y copia su **URL real**.
4. Si alguna no coincide con lo que pusiste:
   - En **zenkai-dojo-api → Environment**: `CORS_ORIGIN` = URL real del sitio estático, **sin barra final** → guarda eligiendo la opción que vuelve a desplegar (*Save and deploy* / *Save, rebuild, and deploy*).
   - En **zenkai-dojo → Environment**: `VITE_API_URL` = URL real del backend, **sin barra final** → guarda y **recompila** (*Save, rebuild, and deploy*; si no aparece, **Manual Deploy → Clear build cache & deploy**). Esta variable se incrusta al compilar: siempre hay que recompilar el sitio después de cambiarla.
5. Si ya coincidían, no hace falta nada más.

---

## 5. Comprobar que funciona

1. `https://<tu-api>.onrender.com/health` → `{"ok":true,…}`
2. `https://<tu-api>.onrender.com/docs` → documentación Swagger (si no quieres que sea pública: `DOCS_ENABLED=false` en el backend).
3. `https://<tu-web>.onrender.com`:
   - Inicio → **Ver torneos** → *Zenkai Open 2026* → una categoría → la llave se ve.
   - Recarga (F5) dentro de la categoría: debe seguir cargando (regla de reescritura de la SPA).
   - **Entrar** con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` → crea un torneo de prueba.
   - En el torneo de ejemplo → pestaña **Exportar** → descarga un PDF y el Excel.
4. Abre las herramientas del navegador (F12 → *Console*): no debe haber errores rojos de **CORS**. Si los hay, `CORS_ORIGIN` no coincide exactamente con la URL de la web (revisa `https`, sufijos y que no tenga `/` al final).

---

## 6. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| La web se queda en *"El servidor aún no responde"* | `VITE_API_URL` mal escrita o el backend no arrancó | Revisa la URL (y recompila la web) y los *Logs* del backend |
| Errores de CORS en la consola | `CORS_ORIGIN` ≠ URL real de la web | Corrígela en el backend (sin `/` final) |
| El build del backend falla con *tsc: not found* o *prisma: not found* | Se cambió el *Build Command* | Debe ser `npm ci --include=dev && npx prisma generate && npm run build` |
| *Can't reach database server* | Cadena de Neon incompleta | Copia de nuevo desde **Connect**; mantén `sslmode=require` |
| Error de *channel binding* | Red o cliente sin soporte | Quita `&channel_binding=require` (deja `sslmode=require`) |
| *"Demasiados intentos. Espera 15 min…"* al entrar | Límite de 10 intentos de login por IP y correo cada 15 min | Esperar; es la protección contra fuerza bruta |
| Las migraciones fallan con un error de *prepared statement* o bloqueo | `DIRECT_URL` apunta al pooler | `DIRECT_URL` debe ser la cadena **sin** `-pooler` |

---

## 7. Monitor externo para evitar arranques en frío

Un servicio que visite `/health` cada 5 min mantiene despierto el backend (y no gasta horas de Neon, porque `/health` no consulta la base de datos).

**Opción recomendada: cron-job.org (gratis)**
1. Regístrate en <https://cron-job.org>.
2. **Create cronjob**:
   - *Title*: `Zenkai demo health`
   - *URL*: `https://<tu-api>.onrender.com/health`
   - *Execution schedule*: **Every 5 minutes**
   - (Opcional) *Notifications*: avisar si falla.
3. Guarda y comprueba en el historial que las ejecuciones devuelven **200**.

**Alternativa: UptimeRobot** (<https://uptimerobot.com>) → *New monitor* → tipo **HTTP(s)** → URL anterior → intervalo **5 minutes**. Revisa sus condiciones de uso del plan gratuito para usos comerciales.

> Con el monitor activo el backend consume unas 720–744 h al mes de las 750 gratuitas de Render. Si algún mes ves que se acaban, quita el monitor unos días: la demo seguirá funcionando, solo con arranques en frío.

---

## 8. Restablecer la demo

Cuando los clientes hayan jugado con la demo, puedes dejarla como el primer día (**borra todos los datos** y vuelve a cargar el torneo de ejemplo con tus credenciales). Se ejecuta desde tu ordenador contra Neon:

1. Crea el archivo `backend/.env.demo` (está excluido de git por `.gitignore`; no lo subas nunca):

```bash
ALLOW_DEMO_RESET=true
DATABASE_URL="<DIRECT_URL de Neon, la cadena SIN -pooler>"
DIRECT_URL="<la misma DIRECT_URL>"
SEED_ADMIN_EMAIL="demo@zenkai.dojo"
SEED_ADMIN_PASSWORD="<la de la demo>"
SEED_TABLE_PASSWORD="<la de las mesas>"
```

2. Ejecuta:

```bash
cd /Users/jesuscf/Propio/Proyectos/Zenkai_Dojo/backend
npm ci
(set -a; . ./.env.demo; set +a; npm run seed:demo:reset)
```

Verás `♻️ Restableciendo la demo en ep-xxxx…neon.tech/neondb…` y `✅ Seed completo`. No hace falta reiniciar Render; las sesiones abiertas se cierran solas (los usuarios se recrean).

Protecciones: sin `ALLOW_DEMO_RESET=true` el script se niega a borrar nada, y sin `SEED_ADMIN_PASSWORD`/`SEED_TABLE_PASSWORD` aborta **antes** de tocar la base (nunca deja la demo con `admin123`).

> Para empezar de cero también puedes, en Neon, borrar y recrear la base (o el proyecto) y redeplegar el backend: al encontrarla vacía cargará la demo sola.

---

## 9. Qué compartir con los clientes

Copia y adapta:

> **Demo de Zenkai Dojo** — https://&lt;tu-web&gt;.onrender.com
>
> - **Vista pública** (sin cuenta): torneos, llaves en vivo, tatamis, medallero y modo TV.
> - **Administración**: `<SEED_ADMIN_EMAIL>` / `<SEED_ADMIN_PASSWORD>` — crea torneos, inscribe, pesa, genera llaves, exporta PDF y Excel.
> - **Mesa de control** (mejor en tablet): `mesa@zenkai.dojo` / `<SEED_TABLE_PASSWORD>` (Tatami 1) o `mesa2@zenkai.dojo` (Tatamis 2 y 3).
>
> Es una demo gratuita: si nadie la ha usado en un rato, la primera carga puede tardar hasta un minuto. Los datos son ficticios y se restablecen periódicamente; no introduzcas datos personales reales.

Opcional para perfiles técnicos: la API documentada en `https://<tu-api>.onrender.com/docs`.

---

## Referencia de variables

### Backend (`zenkai-dojo-api`)

| Variable | Obligatoria en producción | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión de la app (Neon: con `-pooler`) |
| `DIRECT_URL` | Sí | Conexión directa para migraciones (Neon: sin `-pooler`) |
| `JWT_SECRET` | Sí (Render la genera) | Firma de sesiones. Sin ella el servidor no arranca |
| `CORS_ORIGIN` | Sí | URL exacta de la web; varias separadas por comas. `*` no se admite |
| `SEED_ADMIN_EMAIL` | No (por defecto `admin@zenkai.dojo`) | Correo del administrador de la demo |
| `SEED_ADMIN_PASSWORD`, `SEED_TABLE_PASSWORD` | Sí, si se carga la demo | Contraseñas de la demo (mín. 6 caracteres) |
| `SEED_ON_START` | No (`true`) | Cargar la demo al arrancar si la base está vacía |
| `DOCS_ENABLED` | No (`true`) | `false` oculta Swagger en `/docs` |
| `TRUST_PROXY` | No (`false`; `true` en Render) | Usar la IP real del cliente tras el proxy de Render |
| `JWT_EXPIRES_IN` | No (`12h`) | Duración de la sesión |
| `PORT`, `HOST` | No | Render inyecta `PORT`; el servidor escucha en `0.0.0.0` |
| `NODE_VERSION` | — | `22` (también `engines` en `package.json` y `.node-version`) |
| `ALLOW_DEMO_RESET` | — | Solo para `npm run seed:demo:reset` |

### Web (`zenkai-dojo`)

| Variable | Para qué |
|---|---|
| `VITE_API_URL` | URL del backend, sin `/` final. Se incrusta al compilar. Vacía = rutas relativas `/api` (Docker y desarrollo) |
| `NODE_VERSION` | `22` |
