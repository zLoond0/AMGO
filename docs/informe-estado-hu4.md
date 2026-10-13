# Informe de estado del proyecto AMGO para la HU4

**Fecha:** 2026-10-12
**Alcance:** revisión de solo lectura previa a la construcción de la HU4 (sistema de reservas).

La raíz real del proyecto es `c:\AMGO\AMGO`. En `c:\AMGO` solo hay un `package-lock.json` vacío.

---

## a) Resumen del estado actual

### 1. Stack (versiones instaladas en `node_modules`)

| Pieza | Versión real |
|---|---|
| Next.js | 14.2.35 (declarado `^14.2.25`), App Router |
| React | 18.3.1 |
| TypeScript | 5.9.3 |
| Tailwind | 3.4.19 |
| Jest | 29.7.0, con `ts-jest` y entorno `node` |
| Otras dependencias | `bcryptjs`, `jsonwebtoken`, `lucide-react` |

- **No existe ninguna librería de fechas** (date-fns, dayjs, luxon).
- **No existe ORM** ni driver de base de datos.
- **No existe librería de UI.** Todo es Tailwind a mano con íconos de `lucide-react`.
- `tsconfig.json`: `strict: true`, alias `@/*` -> `./src/*`, `moduleResolution: bundler`.
- `jest.config.js`: mapea `^@/(.*)$` a `src/$1`, `testMatch: **/tests/**/*.test.ts` y fuerza `module: commonjs`.
- El script de pruebas es `jest --runInBand`.
- `tailwind.config.js` define los tokens `amigo.blue #4a85f6`, `amigo.btn #85b4f2`, `amigo.btnHover #6ca1ea`, `amigo.teal #009688`, `amigo.dark #1e293b`, `amigo.border #cbd5e1` y `amigo.bg #fcfbf9`.
- Esos tokens casi no se usan. Las páginas escriben los hex a mano, por ejemplo `bg-[#4A85F6]` y `bg-[#85B4F2]`. `#009688` no aparece en ningún componente.

### Qué existe

Árbol de `src/`:

- **Páginas:** `/` (redirige a `/login`), `/login`, `/recuperar-contrasena` y `/dashboard`.
- **API:** `api/auth/login` (POST) y `api/auth/me` (GET).
- **Otros:** `components/AmigoLogo.tsx`, `lib/auth.ts` y `lib/users.ts`.
- **Pruebas:** un solo archivo, `tests/auth.test.ts` (15 pruebas según AUDIT.md; no se ejecutaron en esta revisión).

### Qué no existe

- Base de datos, ORM y migraciones.
- `middleware.ts`.
- Endpoint de logout.
- Layout compartido del dashboard, sidebar o navegación.
- Componentes UI reutilizables (solo `AmigoLogo`).
- Concepto de laboratorio, recurso o reserva.
- `.gitignore` y `.env*`.
- Documentos de HU, DoR o DoD.
- Librería de fechas.

---

## b) Puntos de integración para la HU4

### Autenticación (cómo funciona)

**JWT** en `src/lib/auth.ts`:

- `generateToken(payload, rememberMe)` firma con HS256 (valor por defecto de `jsonwebtoken`) y expira en `30d` o `1d`.
- `verifyToken(token): UserPayload | null` devuelve `null` si el token es inválido o expiró.
- `UserPayload` es `{ id, email, nombre, rol: "Docente" | "Coordinador" | "Administrador" }`.
- `RoleType` está duplicado en `src/lib/users.ts` (línea 3). `dashboard/page.tsx` redeclara además `UserData`.

**Dónde viaja el token** (`src/app/api/auth/login/route.ts` y `src/app/login/page.tsx`):

1. El servidor devuelve el token en el JSON (`{ success, message, token, user }`).
2. El servidor también fija la cookie `auth_token` con `httpOnly: false`, `sameSite: lax`, `secure` solo en producción y `maxAge` de 1 o 30 días.
3. El cliente guarda `amgo_token` y `amgo_user` en `localStorage` si marcó "Recordarme", o en `sessionStorage` si no.
4. Hay tres copias del token: cookie, storage y la respuesta JSON.

**Proteger un endpoint nuevo.** Hoy no hay helper. La extracción vive inline en `src/app/api/auth/me/route.ts`:

- Lee `Authorization: Bearer ...` y, si no está, la cookie `auth_token`.
- Llama a `verifyToken`.
- Responde 401 con `"No autenticado"` o `"Token inválido o expirado"`.

Opción recomendada: extraer ese bloque a `getUserFromRequest(request)` en `lib/auth.ts`. Después se añadiría `requireRole(request, roles[])` que devuelva 403 con `"No tiene permisos para realizar esta acción"`. `me/route.ts` se refactorizaría para usarlo.

**Cliente.** El `fetch` desde el cliente tendría que enviar `Authorization: Bearer <token>` leyéndolo del storage. La cookie viaja sola en same-origin, así que también funcionaría.

**Protección de `/dashboard`.** Es solo del lado del cliente:

- `src/app/dashboard/page.tsx` lee `localStorage` y `sessionStorage` en un `useEffect`.
- Si no hay token ni usuario, hace `router.push("/login")`.
- **Nunca llama a `/api/auth/me`** y no verifica expiración ni firma.
- Un valor basura en `sessionStorage` abre el panel.
- No hay `middleware.ts`, por lo que el servidor sirve la página a cualquiera.

**Logout** (`handleLogout` en `src/app/dashboard/page.tsx`): es local.

- Borra las 4 claves de storage, expira la cookie con `document.cookie` y redirige a `/login`.
- No hay endpoint de logout ni revocación.
- Un token robado sigue siendo válido hasta que expire.
- Funciona únicamente porque la cookie es `httpOnly: false`. Si se endurece la cookie, el logout cliente deja de poder borrarla.

### Archivos y funciones a reutilizar

| Qué | Dónde |
|---|---|
| Verificar token y obtener usuario | `verifyToken` en `lib/auth.ts` |
| Extracción Bearer/cookie | bloque de `me/route.ts` (extraer a helper) |
| Tipo de usuario y rol | `UserPayload` en `lib/auth.ts` y `RoleType` en `lib/users.ts` |
| Validación de correo | `validateEmailFormat` en `lib/auth.ts` (usada también en el cliente de `recuperar-contrasena`) |
| Header azul y layout de página | el `<header className="bg-[#4A85F6]...">` copiado en las 3 páginas |
| Logo | `components/AmigoLogo.tsx` |
| Patrón de prueba de endpoints | sección 5 de `tests/auth.test.ts` |
| Usuarios de prueba | docente `usr_001`, coordinador `usr_002`, admin `usr_003` |

### Capa de datos

**Todo está en memoria.** `usersDatabase: User[]` es un array de 4 usuarios en `src/lib/users.ts` con una contraseña común (`Password123!`).

- `findUserByEmail` lo recorre con `find`.
- El README lo llama "base de datos simulada".
- `inferRoleFromEmail` está definida pero **no se usa en ningún lado** (verificado con grep). Los roles salen del array, no del correo.

**Qué tendría que cambiar para reservas confiables.** Un array de módulo no sirve para reservas, por tres razones:

- **Persistencia:** se pierde al reiniciar.
- **Instancias múltiples:** cada instancia de Next (varias lambdas, `next dev` con HMR) ve su propio estado.
- **Concurrencia:** en un solo proceso Node, un chequeo y un `push` síncronos serían atómicos. En cuanto haya cualquier `await` entre ambos, o más de un proceso, la validación de superposición falla.

Hace falta una base de datos real con una garantía a nivel de motor:

- **PostgreSQL** con `EXCLUDE USING gist (laboratorio_id WITH =, tstzrange(inicio, fin) WITH &&)`, o una transacción con bloqueo.
- **SQLite** con transacción `BEGIN IMMEDIATE`. Es lo mínimo si se quiere algo local.

Con un ORM (Prisma o Drizzle) la entidad `Reserva` necesitaría estos campos:

- `id`
- `laboratorioId`
- `usuarioId`
- `inicio`
- `fin` (en UTC)
- `estado`
- `createdAt`

También harían falta la tabla `Laboratorio` y la migración de `User` a una tabla real. Los IDs actuales (`usr_001`) son cadenas, lo que es compatible.

---

## c) Riesgos y deuda técnica que afectan las reservas

1. **Datos en memoria.** Es el bloqueante principal (ver arriba).
2. **Secreto JWT con valor por defecto** (`src/lib/auth.ts`, línea 4). Si `JWT_SECRET` no está definido, usa un literal que ya está en el repositorio. Cualquiera puede forjar un token con `rol: "Administrador"`. Debería fallar al arrancar en producción si falta la variable.
3. **Autorización inexistente.** Solo hay autenticación. El rol viaja en el JWT y nunca se comprueba en ningún endpoint. El rol del token queda congelado hasta 30 días, así que un cambio de rol no se refleja hasta que expire.
4. **Cookie `httpOnly: false`** más token en `localStorage`. Cualquier XSS lo roba. El dashboard incluso **muestra el JWT completo en pantalla** (`src/app/dashboard/page.tsx`, línea 155).
5. **Sin CSRF explícito.** La cookie `sameSite: lax` cubre `POST` cross-site, pero si un endpoint de reservas acepta la cookie además del Bearer, conviene tenerlo presente.
6. **Sin rate limiting** en el login ni en ningún endpoint.
7. **Zona horaria.** No hay ninguna definición ni librería de fechas. Para la HU4 hay que decidir cómo almacenar y comparar fechas. Lo más seguro es UTC en base de datos y conversión a `America/Bogota` solo al mostrar; Colombia no tiene horario de verano. La zona del servidor (ej. un despliegue en UTC) puede diferir de la del usuario.
8. **Higiene del repositorio.** No hay `.gitignore`, y `.next/` está versionado en git. `git status` muestra cientos de archivos de `.next` modificados o borrados, y `node_modules/` sin seguimiento. Esto generará ruido en cada commit y conflictos en el trabajo en equipo. Mientras no se resuelva, hay riesgo de subir secretos si se crea un `.env`.
9. **`package-lock.json` modificado** sin confirmar (aparece como `M` en `git status`). No se investigó el diff.
10. **Sin pruebas de `/api/auth/me`** ni de `verifyToken` con tokens expirados.
11. **Frontend sin consistencia:** el header y el layout están copiados en cada página. Para la HU4 habrá que extraerlos o se copiarán por cuarta vez.
12. **Posible problema de codificación.** Al leer `layout.tsx` y `AmigoLogo.tsx` con PowerShell, los acentos salen rotos. El resto de archivos se ve bien con el visor, así que probablemente sea solo la codificación de la consola. No se confirmó.

---

## Convenciones de código

**Respuestas de API:**

- **Forma:** siempre `{ success: boolean, message: string, ... }` con datos extra en el mismo nivel (`token`, `user`).
- **Mensajes:** siempre en español.
- **Códigos usados:** `200`, `400` (campo faltante o formato), `401` (credenciales o token) y `500` (`"Error interno del servidor"`, con `console.error`).
- **No hay `403`, `404`, `409` ni `422` todavía.** Habrá que fijar los de reservas, por ejemplo `409` para superposición.
- **Cuerpo inválido:** JSON malformado devuelve `400` con `"Cuerpo de solicitud inválido"`.

**Validación:**

- **Backend:** manual dentro del handler, sin librería (sin zod). Orden: tipos y vacío, longitud y formato, y luego lógica.
- **Frontend:** `validateForm()` local que llena un `errors` por campo, más `generalError`. Los errores por campo se limpian al escribir.
- **Duplicación:** el regex de correo está copiado en `login/page.tsx` aunque existe `validateEmailFormat`.

**Estados de carga y error:**

- **`isLoading`:** deshabilita el botón y muestra `Loader2` con `animate-spin` y el texto "Validando credenciales...".
- **Error general:** un banner con `role="alert"`, fondo rojo claro y `AlertCircle`.
- **Falla de red:** `"Error de conexión con el servidor. Intente más tarde."`.
- **Dashboard:** muestra "Verificando sesión..." mientras `user` es `null`.

**Diseño:**

- **Header:** barra `#4A85F6` con "Instituto - Sistema de gestión de laboratorios" y "Facultad de Ingeniería".
- **Botón primario:** `#85B4F2` con hover `#6FA2EA`, que no coincide exactamente con el token `btnHover #6ca1ea`.
- **Tarjetas:** `bg-white border rounded-xl/2xl shadow-sm`, fondo de página `#FBFBFA`.
- **Roles:** `Docente` en esmeralda, `Coordinador` en índigo y `Administrador` en ámbar. Son colores fuera de la paleta institucional.
- **Tipografía:** fuente del sistema, sin fuentes de Google.
- **Layout y navegación:** el dashboard no tiene navegación. Es una sola página con 3 tarjetas informativas y un botón de cerrar sesión.
- **`/dashboard/reservas`** podría ser la nueva ruta, pero no hay layout compartido que la enlace.

---

## Pruebas

`tests/auth.test.ts` es un solo archivo con 5 bloques `describe`:

1. Validación de formato de correo.
2. bcrypt.
3. JWT.
4. Roles.
5. Integración de `POST /api/auth/login`.

**Cómo se prueba un endpoint.** Se importa el handler directamente (`import { POST } from "../src/app/api/auth/login/route"`) y se construye `new Request("http://localhost:3000/api/...", { method, headers, body }) as any`. Se hace `await POST(req)` y se inspecciona `res.status` y `await res.json()`.

- No hay servidor, supertest ni mocks de módulos.
- Tampoco hay `beforeEach` ni setup compartido.
- Los handlers se usan con el estado real en memoria.

**Cómo correr pruebas de endpoints nuevos.** Se crearía `tests/reservas.test.ts` con el mismo patrón. Para rutas protegidas se genera un token con `generateToken(mockUser)` y se manda en `headers: { Authorization: "Bearer ..." }`.

- Hoy se usa `Request` con cast `as any`; si el handler lee `request.cookies`, puede requerir un `NextRequest` real.
- Para pruebas con base de datos real hará falta resetear la base entre pruebas. `--runInBand` ya está configurado, lo que ayuda.

---

## Documentación y proceso

- `README.md`: describe solo el módulo de login (RF-01 a RF-10, RNF-01 a RNF-07, criterios de aceptación y credenciales de prueba). Menciona "HU002" en el RNF-03.
- `AUDIT.md`: auditoría de seguridad del módulo HU002, fechada 2026-10-09. Cubre DoS por bcrypt, timing attacks, ReDoS y Next.js `^14.2.25`.
- **No hay** documentos de HU, DoR ni DoD en el repositorio.
- **Git:** un único commit, `ad9aa61` "primer commit corregido" (autor Tomas, 2026-10-09), en la rama `master`, con remoto `origin` en `https://github.com/zLoond0/AMGO`. No hay evidencia de convención de ramas ni de commits.

---

## d) Preguntas abiertas antes de empezar

1. **Base de datos:** ¿cuál usarán (PostgreSQL, SQLite, MySQL)? ¿Hay restricción institucional de infraestructura? ¿Aceptan agregar Prisma o Drizzle?
2. **Modelo de dominio:**
   - ¿Existe el concepto de laboratorio, sala o equipo, y cuántos hay?
   - ¿Qué se reserva: el laboratorio completo, un puesto o un equipo?
   - ¿Hay un catálogo previo o se crea en esta HU?
3. **Reglas de negocio de la reserva:**
   - Duración mínima y máxima.
   - Franjas de horario permitidas, y si el bloque es fijo (por ejemplo 1 hora) o libre.
   - Anticipación mínima y máxima.
   - Si se puede reservar en el pasado.
   - Límite de reservas por usuario.
   - Si se permite cancelar o editar.
4. **Roles:** ¿qué puede hacer cada uno?
   - Docente: ¿solo crea y ve las suyas?
   - Coordinador: ¿ve todas y aprueba?
   - Administrador: ¿gestiona laboratorios?
   - ¿Hay flujo de aprobación (estado `pendiente`/`aprobada`) o la reserva es inmediata?
5. **Zona horaria:** ¿fijamos `America/Bogota` como única zona del sistema? ¿Se guarda en UTC?
6. **Seguridad de sesión:** ¿aceptan migrar a cookie `httpOnly` y dejar de usar storage? Es un cambio que afecta el login existente y sus pruebas.
7. **`JWT_SECRET`:** ¿definirán `.env` y quitarán el valor por defecto?
8. **Repositorio:** ¿se puede proponer un `.gitignore` y sacar `.next/` y `node_modules/` del índice? Ahora hay cientos de cambios sin commitear. ¿Y la política de ramas y commits?
9. **Usuarios:** ¿seguirán los 4 usuarios en memoria o se migran a la base de datos con la HU4?
10. **Alcance de UI:** ¿una página `/dashboard/reservas` o un layout nuevo con navegación? ¿Vista de calendario o lista?
11. **Concurrencia:** ¿esperan carga alta o es de bajo volumen? Con una restricción de exclusión en la base el riesgo se cubre por completo.
12. **Pruebas:** ¿qué nivel esperan para la HU4? ¿Pruebas de integración contra una base real (de pruebas) o con repositorio simulado?
