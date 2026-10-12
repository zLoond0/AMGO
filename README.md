# AMGO - Sistema de Gestión de Laboratorios

Sistema de Autenticación e Inicio de Sesión para el Laboratorio de Analítica e IA de la Universidad Católica Luis Amigó (Facultad de Ingeniería).

---

## Tecnologías Utilizadas

- **Frontend:** React 18, Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React
- **Backend:** Node.js, Route Handlers (Next.js API Routes), TypeScript
- **Seguridad:** Encriptación y hashing de contraseñas con bcryptjs, Tokens de sesión con jsonwebtoken (JWT HS256), Cookies httpOnly, Protección CSRF por Origin, Rate Limiting
- **Pruebas:** Jest, ts-jest para pruebas unitarias y de integración

---

## Requisitos Funcionales y No Funcionales

### Requisitos Funcionales (RF)

| ID | Nombre | Descripción |
| :--- | :--- | :--- |
| **RF-01** | **Formulario de Login** | Muestra un formulario centrado con los campos Correo institucional, Contraseña (con botón mostrar/ocultar), opción Recordarme, enlace Olvidaste tu contraseña y botón Iniciar sesión. |
| **RF-02** | **Validación de Campos Obligatorios** | Impide el envío si el correo o la contraseña están vacíos, mostrando avisos de error por cada campo. |
| **RF-03** | **Validación de Formato de Correo** | Verifica que el correo cumpla el formato RFC 5322 válido (ej. nombre@amigo.edu.co) en frontend y backend mediante módulo compartido. |
| **RF-04** | **Autenticación de Credenciales** | Consulta el backend (POST /api/auth/login) comparando la contraseña enviada con la contraseña encriptada en la base de datos. |
| **RF-05** | **Notificación de Error Claro** | Despliega el mensaje genérico "Credenciales incorrectas" si el correo o la contraseña no coinciden (sin revelar cuál falló por seguridad). |
| **RF-06** | **Redirección al Panel Principal** | Redirige automáticamente al panel principal (/dashboard) tras la autenticación exitosa. El panel está protegido en servidor. |
| **RF-07** | **Asignación de Rol Institucional** | Identifica y muestra automáticamente el rol del usuario (Docente, Coordinador o Administrador) asignado a su cuenta. |
| **RF-08** | **Persistencia de Sesión (Recordarme)** | Almacena la sesión exclusivamente en una cookie httpOnly (`auth_token`). Si se marca Recordarme, tiene vigencia persistente de 30 días (`maxAge`). Si no, se emite como cookie de sesión que expira al cerrar el navegador. No se almacena ningún token en localStorage ni sessionStorage. |
| **RF-09** | **Recuperación de Contraseña** | Enlace visible y funcional hacia la vista de recuperación de clave (/recuperar-contrasena). |
| **RF-10** | **Cierre de Sesión (Logout)** | Cierra la sesión mediante el endpoint formal `POST /api/auth/logout`, expirando la cookie `auth_token` de forma segura y redirigiendo al login. |

### Requisitos No Funcionales (RNF)

| ID | Categoría | Descripción |
| :--- | :--- | :--- |
| **RNF-01** | **Seguridad** | Las contraseñas se almacenan e inspeccionan mediante hash unidireccional con salt (bcryptjs, factor de costo 10). Se mitigan ataques de temporización (timing attacks). Se restringen contraseñas a 128 caracteres. |
| **RNF-02** | **Autenticación y Sesión** | Sesión basada en JWT con algoritmo explícito HS256 firmado con `JWT_SECRET` obligatorio (mínimo 32 caracteres). El token viaja únicamente en cookie httpOnly (`sameSite: lax`). Endpoints protegidos validan el header Origin ante peticiones de mutación para mitigar CSRF. |
| **RNF-03** | **Control de Tasa (Rate Limiting)** | Endpoint de login protegido contra ataques de fuerza bruta: máximo 5 intentos fallidos por combinación IP + correo en una ventana de 15 minutos; ante excesos responde HTTP 429 con header `Retry-After`. |
| **RNF-04** | **Usabilidad / UI** | Réplica del diseño institucional de la Universidad Católica Luis Amigó (tokens Tailwind `amigo.blue`, `amigo.btn`, `amigo.teal`, `amigo.dark`, encabezado `AppHeader`). |
| **RNF-05** | **Rendimiento** | Respuestas de autenticación ágiles con verificación de rate limit previa a operaciones criptográficas costosas, y protección frente a cadenas sobredimensionadas (ReDoS / DoS). |
| **RNF-06** | **Calidad / Pruebas** | Suite integral automatizada en Jest (53 pruebas unitarias y de integración) cubriendo validaciones, hashing, JWT, cookies, autorización y rate limiting. |
| **RNF-07** | **Responsividad** | Interfaz totalmente adaptable a pantallas de escritorio, tablets y dispositivos móviles. |
| **RNF-08** | **Mantenibilidad** | Arquitectura modular en Next.js App Router con TypeScript estricto, separación entre utilidades cliente y servidor, y tipos compartidos. |

---

## Criterios de Aceptación Cumplidos

| Criterio | Estado | Implementación |
| :--- | :--- | :--- |
| Muestra campos para correo electrónico y contraseña, junto con el botón "Iniciar Sesión" | Cumplido | Formulario fiel al diseño con etiquetas, placeholders e icono para ver/ocultar contraseña. |
| Valida el formato del correo electrónico y que ningún campo obligatorio quede vacío | Cumplido | Validación tanto en Frontend como en Backend compartida desde `src/lib/validation.ts`. |
| Autentica con éxito y redirige al panel principal si los datos son correctos | Cumplido | Autentica con POST /api/auth/login, fija cookie httpOnly y redirige al panel (/dashboard). |
| Muestra un mensaje de error claro ("Credenciales incorrectas") si el correo o la contraseña fallan | Cumplido | Banner de error visible con el mensaje exacto "Credenciales incorrectas". |
| Incluye un enlace visible para "Olvidaste tu contraseña" | Cumplido | Enlace directo a la interfaz institucional de recuperación de contraseña (/recuperar-contrasena). |
| Mantiene la sesión activa si se selecciona la opción "Recordarme" | Cumplido | Cookie httpOnly con `maxAge` de 30 días si está activo, o cookie de sesión (sin maxAge) si no. Sin almacenamiento en el navegador. |

---

## Credenciales Institucionales de Prueba

Todas las cuentas de prueba comparten la contraseña predeterminada: **Password123!**

- **Docente:** docente@amigo.edu.co
- **Coordinador:** coordinador@amigo.edu.co
- **Administrador:** admin@amigo.edu.co
- **Genérico:** nombre@amigo.edu.co

Nota: El rol (Docente, Coordinador o Administrador) se asigna automáticamente según tu cuenta institucional al autenticarte.

---

## Instalación y Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo de plantilla `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Genera una clave criptográfica de al menos 32 caracteres y asígnala a `JWT_SECRET`:
   ```bash
   # En Linux / macOS:
   openssl rand -base64 48

   # O usando Node.js:
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```

3. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

4. **Ejecutar Pruebas Automatizadas:**
   ```bash
   npm test
   ```

5. **Compilar para Producción:**
   ```bash
   npm run build
   ```

---

## Estructura del Proyecto

```
AMGO/
├── src/
│   ├── app/
│   │   ├── api/auth/login/route.ts   # Endpoint POST /api/auth/login con Rate Limiting
│   │   ├── api/auth/logout/route.ts  # Endpoint POST /api/auth/logout (expira cookie)
│   │   ├── api/auth/me/route.ts      # Endpoint GET /api/auth/me (sesión actual)
│   │   ├── dashboard/
│   │   │   ├── layout.tsx            # Server Component que protege el panel y layout común
│   │   │   └── page.tsx              # Vista del panel principal
│   │   ├── login/page.tsx            # Formulario de Login (cliente)
│   │   ├── recuperar-contrasena/     # Vista de recuperación de clave
│   │   ├── globals.css               # Estilos globales y tokens CSS
│   │   ├── layout.tsx                # Layout raíz institucional
│   │   └── page.tsx                  # Redirección raíz a /login
│   ├── components/
│   │   ├── AmigoLogo.tsx             # Logo vectorial Universidad Católica Luis Amigó
│   │   ├── AppHeader.tsx             # Encabezado institucional unificado
│   │   ├── DashboardNav.tsx          # Barra de navegación del dashboard
│   │   └── LogoutButton.tsx          # Botón interactivo de cierre de sesión
│   └── lib/
│       ├── auth.ts                   # Hashing, JWT, requireAuth, requireRole, cookies
│       ├── rate-limit.ts             # Limitador de tasa en memoria con ventana deslizante
│       ├── session.ts                # Helper getCurrentUser para Server Components
│       ├── types.ts                  # Tipos compartidos (RoleType, UserPayload, UserData)
│       ├── users.ts                  # Base de datos simulada en memoria
│       └── validation.ts             # Validaciones puras y constantes de longitud
├── tests/
│   ├── auth.test.ts                  # Pruebas unitarias de hashing, validación y login
│   ├── rate-limit.test.ts            # Pruebas de ventana deslizante y HTTP 429
│   ├── session.test.ts               # Pruebas de verifyToken, me, logout, CSRF y requireRole
│   └── setup-env.ts                  # Configuración de variables de entorno para Jest
├── docs/
│   └── informe-estado-hu4.md         # Diagnóstico técnico para la HU4
├── .env.example                      # Plantilla de variables de entorno
├── .gitignore                        # Reglas de exclusión de repositorio
├── AUDIT.md                          # Informe técnico de auditoría y seguridad
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── jest.config.js
```
