# Informe de Ejecución: Paso 0 - Hardening y Orden del Proyecto AMGO

**Fecha:** 2026-10-12  
**Rama de trabajo:** `chore/paso-0-hardening`  
**Objetivo:** Endurecer la seguridad, arquitectura de tipos y sesiones, y la higiene del repositorio antes de iniciar la construcción de la HU4 (sistema de reservas).  
**Estado:** Completado y verificado.

---

## 1. Resumen de Commits Creados

Se trabajó bajo la convención de mensajes convencionales en español con un commit por bloque lógico:

| Hash | Tipo / Prefijo | Mensaje | Descripción |
|---|---|---|---|
| `d95efd4` | `chore` | `chore: añade .gitignore y deja de versionar .next y node_modules` | Creación de `.gitignore` y desindexación de 111 artefactos de `.next` sin alterar archivos en disco. |
| `de7b833` | `fix` | `fix: elimina el secreto JWT por defecto y exige JWT_SECRET` | Eliminación de fallback inseguro en código productivo, función `getJwtSecret` con lectura perezosa (>= 32 chars), algoritmo HS256 explícito y setup de variables en Jest. |
| `e42e83f` | `refactor` | `refactor: unifica tipos y validaciones compartidas` | Creación de `src/lib/types.ts` y `src/lib/validation.ts` sin dependencias de Node. Retiro de regex duplicado en frontend y eliminación de `inferRoleFromEmail`. |
| `2de43b8` | `feat` | `feat: cookie httpOnly como única credencial, helpers de autorización y logout` | Eliminación del token en JSON; cookie `auth_token` con `httpOnly: true`. Helpers `getUserFromRequest`, `requireAuth` con mitigación CSRF por header `Origin`, `requireRole` y endpoint `POST /api/auth/logout`. |
| `6c62b34` | `feat` | `feat: dashboard protegido en servidor con layout compartido y logout por endpoint` | Conversión de `/dashboard` a Server Component mediante `dashboard/layout.tsx`. Erradicación de `localStorage`/`sessionStorage` y retiro de la exposición del JWT en pantalla. |
| `8d3c494` | `feat` | `feat: limita intentos de login por IP y correo` | Limitador de tasa en memoria con ventana deslizante (`src/lib/rate-limit.ts`). Máximo 5 fallos en 15 minutos por IP+email; respuesta HTTP 429 con `Retry-After`. |
| `0195770` | `refactor/docs`| `refactor: unifica header y tokens de diseño; docs: actualiza README y AUDIT` | Extracción del componente unificado `AppHeader.tsx`, reemplazo de colores hex en código por tokens Tailwind, y actualización de `README.md` y `AUDIT.md`. |

---

## 2. Inventario de Archivos Creados y Modificados

### Archivos Nuevos

1. `.gitignore`: Reglas de exclusión para `node_modules/`, `.next/`, `out/`, variables de entorno `.env*` (excepto `.env.example`), logs, temporales del sistema operativo y `.tsbuildinfo`.
2. `.env.example`: Plantilla documentada con instrucciones para generar el secreto criptográfico obligatorio mediante `openssl` o Node.js.
3. `.env.local` *(ignorado por git)*: Clave local de desarrollo generada criptográficamente (48 bytes base64).
4. `tests/setup-env.ts`: Inyección de `JWT_SECRET` para el entorno de pruebas de Jest (`setupFiles`), asegurando aislamiento del código productivo.
5. `src/lib/types.ts`: Fuente única de tipos compartidos entre cliente y servidor (`ROLES`, `RoleType`, `UserData`, `UserPayload`).
6. `src/lib/validation.ts`: Módulo de validaciones puras sin dependencias de Node (`validateEmailFormat`, `EMAIL_MAX_LENGTH`, `PASSWORD_MAX_LENGTH`). Seguro para importación en componentes cliente.
7. `src/lib/session.ts`: Helper `getCurrentUser()` para Server Components, basado en `cookies()` de Next.js y `verifyToken()`.
8. `src/lib/rate-limit.ts`: Implementación de limitador en memoria con ventana deslizante, purga automática de entradas vencidas y tope máximo de claves.
9. `src/components/AppHeader.tsx`: Encabezado institucional azul unificado (`bg-amigo-blue`).
10. `src/components/DashboardNav.tsx`: Navegación del dashboard con enlace activo a "Panel" y placeholder accesible deshabilitado para "Reservas".
11. `src/components/LogoutButton.tsx`: Botón cliente de cierre de sesión interactivo con manejo de estados de carga (`Loader2`), error y llamada al endpoint de logout.
12. `src/app/api/auth/logout/route.ts`: Route Handler para invalidación de la cookie de sesión (`maxAge: 0`).
13. `src/app/dashboard/layout.tsx`: Server Component que restringe el acceso al panel antes de renderizar la página.
14. `tests/session.test.ts`: 23 pruebas de integración y unitarias para tokens, cookies, CSRF, autorización por rol y `/api/auth/me`.
15. `tests/rate-limit.test.ts`: 12 pruebas de integración y unitarias para la ventana deslizante y la respuesta HTTP 429 en login.

### Archivos Modificados

- `jest.config.js`: Inclusión de `setupFiles: ["<rootDir>/tests/setup-env.ts"]`.
- `tailwind.config.js`: Unificación de tokens `amigo.btnHover` (`#6ca1ea`), adición de `amigo.btnActive` (`#5c94e5`) y `amigo.bg` (`#fbfbfa`).
- `src/lib/auth.ts`: Eliminación de fallback de secreto, forzado de algoritmo HS256, saneamiento de claims, `getAuthCookieOptions`, `getUserFromRequest`, `requireAuth` y `requireRole`.
- `src/lib/users.ts`: Uso del tipo `RoleType` importado; eliminación de la función sin uso `inferRoleFromEmail`.
- `src/app/api/auth/login/route.ts`: Integración de rate limiting previo a bcrypt, retiro del token en JSON, emisión de cookie httpOnly segura y saneamiento de entradas.
- `src/app/api/auth/me/route.ts`: Refactorizado para utilizar `requireAuth(request)`.
- `src/app/login/page.tsx`: Eliminación total de Web Storage (`localStorage`/`sessionStorage`), integración de `AppHeader`, validación con `validation.ts` y tokens de diseño.
- `src/app/recuperar-contrasena/page.tsx`: Integración de `AppHeader`, importación de validación desde `validation.ts` y tokens de diseño.
- `src/app/dashboard/page.tsx`: Migrado a Server Component sin lógica de storage del cliente ni exposición del token JWT en pantalla.
- `src/app/layout.tsx`: Aplicación del token de fondo `bg-amigo-bg`.
- `tests/auth.test.ts`: Adaptación de la prueba de login para verificar la cookie httpOnly y ausencia del token en el cuerpo JSON; pruebas de exigencia de `JWT_SECRET`.
- `README.md` y `AUDIT.md`: Documentación completa de cambios arquitectónicos, controles OWASP y estado de las pruebas.

---

## 3. Decisiones Técnicas y de Diseño

1. **Cookie `httpOnly` como única credencial del navegador:**  
   Se eliminó por completo el almacenamiento del token en `localStorage` o `sessionStorage`. Esto mitiga el riesgo de exfiltración de credenciales ante vulnerabilidades de Cross-Site Scripting (XSS).
2. **Defensa CSRF por `Origin`:**  
   Dado que los navegadores envían cookies automáticamente en peticiones hacia el mismo dominio, las solicitudes de mutación (`POST`, `PUT`, `PATCH`, `DELETE`) procesadas por `requireAuth` verifican que el encabezado `Origin` coincida con el host de la aplicación.
3. **Persistencia condicional sin Web Storage:**  
   Si el usuario activa "Recordarme", la cookie se configura con `maxAge: 30 días` y el JWT se firma por 30 días. Si no lo activa, se emite una cookie de sesión (sin `maxAge`) que el navegador elimina al cerrarse, y el JWT dura 1 día.
4. **Protección en servidor para `/dashboard`:**  
   En lugar de depender de redirecciones asíncronas en el cliente (`useEffect`), `dashboard/layout.tsx` valida la cookie en el servidor antes de emitir cualquier contenido HTML sensible.
5. **Aislamiento de dependencias cliente/servidor:**  
   `src/lib/validation.ts` y `src/lib/types.ts` son módulos limpios sin dependencias nativas de Node.js. Esto previene que librerías pesadas o de servidor (`bcryptjs`, `jsonwebtoken`) sean empaquetadas en los bundles de React para el navegador.
6. **Rate Limiting preventivo:**  
   La verificación de tasa de intentos fallidos en `POST /api/auth/login` se realiza antes del cálculo de hash de contraseñas. Un atacante bloqueado recibe HTTP 429 de inmediato sin consumir tiempo de procesador en comparaciones criptográficas.

---

## 4. Resultados de la Verificación

- **Verificación de Tipos (`npx tsc --noEmit`):** 0 errores.
- **Suite de Pruebas Automatizadas (`npm test`):**  
  - 3 suites ejecutadas: `tests/auth.test.ts`, `tests/session.test.ts`, `tests/rate-limit.test.ts`.  
  - 53 pruebas aprobadas de 53 (100% de éxito).  
  - Tiempo de ejecución: ~7.1 segundos.
- **Compilación de Producción (`npm run build`):**  
  - Generación de páginas estáticas (10/10) completada con éxito.  
  - Rutas dinámicas (`/api/auth/*`, `/dashboard`) operando correctamente en modo servidor bajo demanda.

---

## 5. Casos de Prueba Funcionales Verificados

1. **Inicio de sesión estándar (sin "Recordarme"):**  
   Emite cookie `auth_token` con atributos `httpOnly: true`, `sameSite: lax`, `path: /` y sin `maxAge`. El cuerpo de respuesta entrega `{ success: true, message: "Inicio de sesión exitoso", user: { ... } }` sin exponer el token.
2. **Inicio de sesión persistente (con "Recordarme"):**  
   Emite la misma cookie con `maxAge = 2592000` (30 días).
3. **Acceso no autenticado al panel:**  
   Al intentar ingresar a `/dashboard` sin cookie válida, el servidor responde con redirección HTTP 307 hacia `/login`.
4. **Cierre de sesión formal:**  
   Al presionar "Cerrar sesión", el cliente invoca `POST /api/auth/logout`. La respuesta invalida la cookie asignando `maxAge: 0`. El navegador borra la credencial y redirige al login.
5. **Mitigación de fuerza bruta (Rate Limiting):**  
   Tras 5 intentos fallidos consecutivos para la misma combinación IP + correo, el 6.º intento es rechazado con código HTTP 429, cuerpo `{ success: false, message: "Demasiados intentos. Intente de nuevo más tarde." }` y encabezado `Retry-After`. Un intento exitoso restablece el contador.

---

## 6. Aspectos Pendientes y Deuda Técnica para la HU4

1. **`package-lock.json` modificado:**  
   Existe un cambio de 2 líneas en `c:\AMGO\AMGO\package-lock.json` correspondiente a la actualización de Next.js (`14.2.15` a `14.2.25`) detallada en AUDIT.md. No fue commiteado y permanece disponible para incluirse cuando se autorice.
2. **Archivo huérfano fuera del proyecto:**  
   En `c:\AMGO` (directorio padre) existe un `package-lock.json` vacío (83 bytes). No afecta la ejecución del proyecto, pero puede ser eliminado manualmente para evitar confusiones.
3. **Rol en JWT y falta de revocación de sesiones (limitación documentada):**  
   El rol del usuario viaja firmado dentro del payload del JWT. Si el rol cambia en el sistema, el usuario conserva el rol anterior hasta que la sesión expire o se cierre voluntariamente. Asimismo, no existe lista negra de tokens en servidor. Esta limitación se superará al integrar la base de datos relacional y la persistencia de usuarios durante la implementación de la **HU4**.
4. **Almacenamiento de Rate Limit en memoria:**  
   El limitador opera en el proceso local de Node.js. En caso de desplegar múltiples instancias o contenedores detrás de un balanceador de carga, el límite debe migrarse a Redis o a la base de datos.
