# Informe de Auditoría de Código y Seguridad

**Proyecto:** AMGO - Sistema de Gestión de Laboratorios  
**Módulo:** HU002 - Autenticación e Inicio de Sesión & Hardening Paso 0  
**Fecha original:** 2026-10-09  
**Fecha actualización (Paso 0 - Hardening):** 2026-10-12  
**Estado:** Aprobado  

---

## 1. Alcance y Objetivos

La presente auditoría técnica evaluó la calidad del código, robustez criptográfica, prevención de vulnerabilidades web (OWASP Top 10), mitigación de ataques de denegación de servicio (DoS) y fuerza bruta, manejo de sesiones y buenas prácticas de desarrollo en frontend (React / Next.js) y backend (Node.js Route Handlers), preparando la base para la construcción del sistema de reservas (HU4).

---

## 2. Hallazgos Identificados y Acciones Correctivas

### 2.1. Vulnerabilidades en Dependencias Base
- **Diagnóstico:** La versión inicial de Next.js (14.2.15) presentaba avisos de vulnerabilidad en la auditoría de dependencias secundarias (`npm audit`).
- **Riesgo:** Potencial afectación en componentes de servidor y caché en versiones no parcheadas.
- **Acción Correctiva:** Se actualizó la dependencia a `next: ^14.2.25` en `package.json`, mitigando las vulnerabilidades reportadas en las subdependencias del framework.

### 2.2. Prevención de Ataques DoS por Sobrecarga de CPU en Algoritmo de Hashing (bcrypt)
- **Diagnóstico:** El algoritmo `bcrypt` tiene un costo computacional intencionalmente elevado. Si un atacante envía cadenas arbitrariamente largas (miles de caracteres) en el campo de contraseña, el cómputo puede saturar el procesador del servidor.
- **Riesgo:** Denegación de servicio por agotamiento de recursos de cómputo (CWE-400).
- **Acción Correctiva:** Se implementó una restricción de longitud máxima de 128 caracteres para contraseñas en el endpoint `POST /api/auth/login` y en la función `verifyPassword` (`PASSWORD_MAX_LENGTH`), rechazando de inmediato entradas sobredimensionadas antes del procesamiento criptográfico.

### 2.3. Mitigación de Ataques de Temporización (Timing Attacks)
- **Diagnóstico:** Al autenticar, si el usuario no existía en la base de datos, la API respondía de inmediato sin ejecutar `bcrypt.compare`. Si el usuario sí existía, la API ejecutaba la comparación (tardando cientos de milisegundos).
- **Riesgo:** Un atacante podía deducir qué correos institucionales existen en el sistema analizando la latencia de respuesta (User Enumeration via Timing Analysis).
- **Acción Correctiva:** Cuando el usuario no es encontrado, se ejecuta una comparación dummy contra un hash predefinido utilizando `bcrypt.compare`. Con esto, el tiempo de respuesta es indistinguible entre credenciales de usuarios existentes y no existentes.

### 2.4. Protección contra Expresiones Regulares Catastróficas (ReDoS)
- **Diagnóstico:** La validación de correo mediante expresiones regulares complejas puede sufrir degradación exponencial ante cadenas maliciosas con patrones repetitivos sin límite de longitud.
- **Riesgo:** Denegación de servicio por evaluación de expresiones regulares (CWE-1333).
- **Acción Correctiva:** Se incorporó una validación previa de longitud máxima de 254 caracteres (estándar RFC 5321) en `validateEmailFormat` antes de evaluar la expresión regular.

### 2.5. Gestión Criptográfica de Secretos JWT (Paso 0)
- **Diagnóstico:** El código poseía un secreto JWT estático por defecto en el código fuente (`JWT_SECRET = process.env.JWT_SECRET || "amgo-laboratorio-secret-key-..."`), permitiendo la falsificación de tokens si la variable de entorno no se configuraba. Asimismo, no se forzaba explícitamente el algoritmo en la firma/verificación.
- **Riesgo:** Falsificación de identidad y elevación de privilegios por secretos débiles o ataques de confusión de algoritmos (CWE-326 / CWE-327).
- **Acción Correctiva:** Se eliminó cualquier fallback en código de producción. La función `getJwtSecret` lee de forma perezosa y exige estrictamente que `JWT_SECRET` esté definido con una longitud mínima de 32 caracteres. Se forzó el algoritmo `HS256` tanto en la firma como en la verificación. Para la suite de pruebas se configuró un secreto aislado vía `setupFiles` de Jest.

### 2.6. Almacenamiento Inseguro de Tokens en el Cliente (Paso 0)
- **Diagnóstico:** El token JWT era retornado en el cuerpo JSON del login y almacenado en `localStorage` o `sessionStorage`, exponiéndolo a exfiltración ante ataques de Cross-Site Scripting (XSS). Adicionalmente, el dashboard mostraba el string completo del token en pantalla.
- **Riesgo:** Robo de sesión mediante XSS (CWE-79 / CWE-922).
- **Acción Correctiva:** Se eliminó el token del cuerpo JSON de respuesta y se erradicó el uso de Web Storage (`localStorage`/`sessionStorage`). La sesión se gestiona únicamente mediante cookies seguras con atributo `httpOnly: true`, `sameSite: "lax"`, y `secure` activo en producción. Se removió la visualización del token en el panel de usuario.

### 2.7. Protección de Rutas y Autorización en Servidor (Paso 0)
- **Diagnóstico:** El acceso a `/dashboard` se protegía únicamente mediante redirección en el navegador dentro de un hook `useEffect`, permitiendo que el árbol DOM y assets fueran servidos por el servidor sin validación de credenciales. No existían mecanismos estandarizados de autorización basada en roles para nuevos endpoints.
- **Riesgo:** Acceso no autorizado a vistas protegidas y falta de control de acceso a nivel de API.
- **Acción Correctiva:** Se implementó `src/app/dashboard/layout.tsx` como un Server Component que valida la sesión en el servidor mediante `cookies()` y `verifyToken`, ejecutando un `redirect("/login")` antes de entregar el contenido. Se crearon los helpers `requireAuth` y `requireRole` para proteger Route Handlers presentes y futuros.

### 2.8. Mitigación de Falsificación de Peticiones en Sitios Cruzados (CSRF) (Paso 0)
- **Diagnóstico:** Al migrar a autenticación por cookies para Route Handlers, las solicitudes de mutación de estado podrían ser vulnerables si un navegador adjunta la cookie en contextos cruzados.
- **Riesgo:** Cross-Site Request Forgery (CWE-352).
- **Acción Correctiva:** Se implementó validación del encabezado `Origin` dentro de `requireAuth` para todos los métodos de mutación (`POST`, `PUT`, `PATCH`, `DELETE`). Si la autenticación proviene de una cookie y el origen de la petición difiere del host de destino, se rechaza inmediatamente con código HTTP 403.

### 2.9. Cierre de Sesión Formal (Logout) (Paso 0)
- **Diagnóstico:** El logout se efectuaba únicamente del lado del cliente mediante la manipulación de `document.cookie` (lo cual es inviable con cookies `httpOnly`) y el vaciado de `localStorage`.
- **Acción Correctiva:** Se construyó el endpoint `POST /api/auth/logout` que invalida la cookie `auth_token` desde el servidor asignándole `maxAge: 0` con idénticos atributos de ruta y seguridad.

### 2.10. Mitigación de Ataques de Fuerza Bruta (Rate Limiting) (Paso 0)
- **Diagnóstico:** El endpoint `POST /api/auth/login` no poseía restricción en la tasa de intentos fallidos sucesivos.
- **Riesgo:** Ataques de fuerza bruta y adivinación de contraseñas (CWE-307).
- **Acción Correctiva:** Se implementó un limitador de tasa con ventana deslizante (`src/lib/rate-limit.ts`) configurado a un máximo de 5 intentos fallidos por tupla IP + correo en una ventana de 15 minutos. Ante excesos se responde HTTP 429 ("Demasiados intentos") con el encabezado `Retry-After`. Un intento exitoso restablece el contador de la clave.

### 2.11. Higiene del Repositorio y Arquitectura de Módulos (Paso 0)
- **Diagnóstico:** El repositorio no contaba con `.gitignore` y versionaba artefactos compilados de `.next/`. Asimismo, existían componentes cliente que importaban librerías nativas de servidor (como `bcryptjs`) a través de módulos compartidos de utilidades.
- **Acción Correctiva:** Se configuró un `.gitignore` estricto y se desindexaron los directorios temporales. Se modularizó la lógica separando tipos en `src/lib/types.ts` y validaciones puras en `src/lib/validation.ts`, previniendo la contaminación de bundles en el navegador.

---

## 3. Limitaciones Conocidas y Deuda Técnica Documentada

Las siguientes limitaciones son conocidas y deliberadas para la etapa actual, y serán abordadas en fases posteriores:

1. **Tokens JWT sin revocación en servidor y rol congelado:**  
   El rol institucional viaja firmado dentro del payload del JWT. Si el rol de un usuario cambia o se requiere revocar su acceso inmediatamente, el token continuará siendo aceptado hasta que alcance su fecha de expiración (hasta 30 días con Recordarme). No existe lista negra ni tabla de sesiones persistente.  
   *Mitigación prevista:* Se implementará una base de datos relacional con tabla de usuarios y sesiones en la **HU4**.

2. **Almacenamiento de Rate Limiting en memoria del proceso:**  
   El estado del limitador de intentos reside en memoria volátil de Node.js (`Map`). Esto es válido para una única instancia del servidor, pero en un entorno distribuido (múltiples réplicas de pods o funciones Serverless) el conteo no se comparte y se reinicia al reiniciar el proceso.  
   *Mitigación prevista:* Migrar el almacén a Redis o tablas de base de datos en entornos de producción con escalado horizontal.

3. **Confianza en encabezados de IP (`X-Forwarded-For`):**  
   La detección de la IP cliente para el limitador de tasa extrae el primer valor de `X-Forwarded-For`. Esto asume que el despliegue cuenta con un proxy inverso o balanceador de carga institucional confiable que reescribe o sanitiza dicha cabecera.

---

## 4. Matriz de Seguridad y Cumplimiento

| Control | Criterio Evaluado | Estado | Implementación |
| :--- | :--- | :--- | :--- |
| **Hashing de Claves** | No almacenar contraseñas en texto plano | Conforme | Algoritmo bcrypt con factor de salting 10 (`src/lib/auth.ts`). |
| **Protección DoS Hashing** | Restringir longitud máxima de contraseñas | Conforme | Límite de 128 caracteres antes de procesar con bcrypt. |
| **Mitigación Timing Attacks**| Respuestas uniformes ante usuarios inexistentes | Conforme | Verificación dummy con bcrypt ante usuarios no encontrados. |
| **Manejo de Sesión** | Stateless, firmado criptográficamente | Conforme | JWT firmado con HS256 y clave forzosa en `JWT_SECRET` (>= 32 chars). |
| **Seguridad de Cookies** | Protección contra XSS | Conforme | Cookie `auth_token` con `httpOnly: true`, `sameSite: lax` y `path: /`. |
| **Protección CSRF** | Validación de origen en mutaciones | Conforme | Inspección de header `Origin` en peticiones autenticadas por cookie. |
| **Defensa Fuerza Bruta** | Límite de intentos fallidos en login | Conforme | Rate limiter deslizante: máx 5 intentos en 15 min por IP+email (HTTP 429). |
| **Control de Acceso (RBAC)** | Validación de rol en endpoints y vistas | Conforme | `requireRole`, `requireAuth` y Server Component en `/dashboard`. |
| **Sanitización de Entrada** | Tipado y validación de estructura | Conforme | Validación estricta en `src/lib/validation.ts` (RFC 5321 y límites). |

---

## 5. Resultados de Pruebas Automatizadas

Se ejecutó la suite completa de pruebas unitarias y de integración mediante Jest (`npm test`):

- **Suites de pruebas:** 3 suites (`tests/auth.test.ts`, `tests/session.test.ts`, `tests/rate-limit.test.ts`)
- **Pruebas ejecutadas:** 53 pruebas
- **Pruebas aprobadas:** 53 pruebas (100%)
- **Pruebas fallidas:** 0
- **Tiempo de ejecución aproximado:** ~6.6 segundos

---

## 6. Conclusión

El código del sistema de autenticación cumple con los estándares de seguridad exigidos para la fase de preparación de la HU4. Se eliminaron vectores críticos de robo de sesión (XSS/WebStorage), se reforzó la gestión de secretos criptográficos, se aseguraron las rutas en servidor y se añadieron controles efectivos contra ataques de fuerza bruta y CSRF.
