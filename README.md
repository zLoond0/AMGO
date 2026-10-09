# AMGO - Sistema de Gestión de Laboratorios

Sistema de Autenticación e Inicio de Sesión para el Laboratorio de Analítica e IA de la Universidad Católica Luis Amigó (Facultad de Ingeniería).

---

## Tecnologías Utilizadas

- **Frontend:** React 18, Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React
- **Backend:** Node.js, Route Handlers (Next.js API Routes), TypeScript
- **Seguridad:** Encriptación y hashing de contraseñas con bcryptjs, Tokens de sesión con jsonwebtoken (JWT)
- **Pruebas:** Jest, ts-jest para pruebas unitarias y de integración

---

## Requisitos Funcionales y No Funcionales

### Requisitos Funcionales (RF)

| ID | Nombre | Descripción |
| :--- | :--- | :--- |
| **RF-01** | **Formulario de Login** | Muestra un formulario centrado con los campos Correo institucional, Contraseña (con botón mostrar/ocultar), opción Recordarme, enlace Olvidaste tu contraseña y botón Iniciar sesión. |
| **RF-02** | **Validación de Campos Obligatorios** | Impide el envío si el correo o la contraseña están vacíos, mostrando avisos de error por cada campo. |
| **RF-03** | **Validación de Formato de Correo** | Verifica que el correo cumpla el formato RFC 5322 válido (ej. nombre@amigo.edu.co) en frontend y backend. |
| **RF-04** | **Autenticación de Credenciales** | Consulta el backend (POST /api/auth/login) comparando la contraseña enviada con la contraseña encriptada en la base de datos. |
| **RF-05** | **Notificación de Error Claro** | Despliega el mensaje genérico "Credenciales incorrectas" si el correo o la contraseña no coinciden (sin revelar cuál falló por seguridad). |
| **RF-06** | **Redirección al Panel Principal** | Redirige automáticamente al panel principal (/dashboard) tras la autenticación exitosa. |
| **RF-07** | **Asignación de Rol Institucional** | Identifica y muestra automáticamente el rol del usuario (Docente, Coordinador o Administrador) asignado a su cuenta. |
| **RF-08** | **Persistencia de Sesión (Recordarme)** | Guarda el token en localStorage si se marca Recordarme (sesión persistente 30 días) o en sessionStorage si no (sesión temporal). |
| **RF-09** | **Recuperación de Contraseña** | Enlace visible y funcional hacia la vista de recuperación de clave (/recuperar-contrasena). |
| **RF-10** | **Cierre de Sesión (Logout)** | Permite cerrar sesión en el panel principal, destruyendo tokens/cookies y redirigiendo al login. |

### Requisitos No Funcionales (RNF)

| ID | Categoría | Descripción |
| :--- | :--- | :--- |
| **RNF-01** | **Seguridad** | Las contraseñas se almacenan e inspeccionan mediante hash unidireccional con salt (bcryptjs, factor de costo 10). Se mitigan ataques de temporización (timing attacks). |
| **RNF-02** | **Autenticación** | Gestión de sesión basada en JSON Web Tokens (JWT) firmados criptográficamente. |
| **RNF-03** | **Usabilidad / UI** | Réplica fiel del diseño institucional de la Universidad Católica Luis Amigó (colores #4A85F6, #85B4F2, #009688, tipografía y distribución HU002). |
| **RNF-04** | **Rendimiento** | El endpoint de autenticación procesa solicitudes en un tiempo de respuesta inferior a 500 ms con protección frente a cadenas sobredimensionadas (ReDoS / DoS). |
| **RNF-05** | **Calidad / Pruebas** | Suite automatizada de pruebas unitarias y de integración en Jest para validar flujos de éxito, errores y JWT. |
| **RNF-06** | **Responsividad** | Interfaz totalmente adaptable a pantallas de escritorio, tablets y dispositivos móviles. |
| **RNF-07** | **Mantenibilidad** | Arquitectura modular en Next.js App Router estructurada en TypeScript con tipado estricto. |

---

## Criterios de Aceptación Cumplidos

| Criterio | Estado | Implementación |
| :--- | :--- | :--- |
| Muestra campos para correo electrónico y contraseña, junto con el botón "Iniciar Sesión" | Cumplido | Formulario fiel al diseño con etiquetas, placeholders e icono para ver/ocultar contraseña. |
| Valida el formato del correo electrónico y que ningún campo obligatorio quede vacío | Cumplido | Validación tanto en Frontend como en Backend (RFC 5322 regex y chequeo de campos vacíos). |
| Autentica con éxito y redirige al panel principal si los datos son correctos | Cumplido | Autentica con POST /api/auth/login y redirige al panel principal (/dashboard). |
| Muestra un mensaje de error claro ("Credenciales incorrectas") si el correo o la contraseña fallan | Cumplido | Banner de error visible con el mensaje exacto "Credenciales incorrectas". |
| Incluye un enlace visible para "Olvidaste tu contraseña" | Cumplido | Enlace directo a la interfaz institucional de recuperación de contraseña (/recuperar-contrasena). |
| Mantiene la sesión activa si se selecciona la opción "Recordarme" | Cumplido | Almacenamiento condicional: localStorage con JWT persistente si está activo, o sessionStorage temporal si no. |

---

## Credenciales Institucionales de Prueba

Todas las cuentas de prueba comparten la contraseña predeterminada: **Password123!**

- **Docente:** docente@amigo.edu.co
- **Coordinador:** coordinador@amigo.edu.co
- **Administrador:** admin@amigo.edu.co
- **Genérico:** nombre@amigo.edu.co

Nota: El rol (Docente, Coordinador o Administrador) se asigna automáticamente según tu cuenta institucional al autenticarte.

---

## Instalación y Ejecución

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

3. **Ejecutar Pruebas Unitarias y de Integración:**
   ```bash
   npm test
   ```

---

## Estructura del Proyecto

```
AMGO/
├── src/
│   ├── app/
│   │   ├── api/auth/login/route.ts  # Endpoint POST /api/auth/login
│   │   ├── api/auth/me/route.ts     # Endpoint verificación de sesión
│   │   ├── dashboard/page.tsx       # Panel principal post-login
│   │   ├── login/page.tsx           # Vista y formulario de Login
│   │   ├── recuperar-contrasena/    # Pantalla de recuperación
│   │   ├── globals.css              # Estilos Tailwind CSS
│   │   ├── layout.tsx               # Layout raíz institucional
│   │   └── page.tsx                 # Redirección inicial
│   ├── components/
│   │   └── AmigoLogo.tsx            # Logo vectorial Universidad Católica Luis Amigó
│   └── lib/
│       ├── auth.ts                  # Funciones de hash (bcrypt), JWT y validaciones
│       └── users.ts                 # Base de datos simulada y asignación de roles
├── tests/
│   └── auth.test.ts                 # Pruebas unitarias y de integración Jest
├── AUDIT.md                     # Informe técnico de auditoría y seguridad
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── jest.config.js
```

