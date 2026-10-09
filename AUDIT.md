# Informe de Auditoría de Código y Seguridad

**Proyecto:** AMGO - Sistema de Gestión de Laboratorios  
**Módulo:** HU002 - Autenticación e Inicio de Sesión  
**Fecha:** 2026-10-09  
**Estado:** Aprobado  

---

## 1. Alcance y Objetivos

La presente auditoría técnica evaluó la calidad del código, robustez criptográfica, prevención de vulnerabilidades web (OWASP Top 10), mitigación de ataques de denegación de servicio (DoS) y buenas prácticas de desarrollo en frontend (React / Next.js) y backend (Node.js Route Handlers).

---

## 2. Hallazgos Identificados y Acciones Correctivas

### 2.1. Vulnerabilidades en Dependencias Base
- **Diagnóstico:** La versión inicial de Next.js (14.2.15) presentaba avisos de vulnerabilidad en la auditoría de dependencias secundarias (`npm audit`).
- **Riesgo:** Potencial afectación en componentes de servidor y caché en versiones no parcheadas.
- **Acción Correctiva:** Se actualizó la dependencia a `next: ^14.2.25` en `package.json`, mitigando las vulnerabilidades reportadas en las subdependencias del framework.

### 2.2. Prevención de Ataques DoS por Sobrecarga de CPU en Algoritmo de Hashing (bcrypt)
- **Diagnóstico:** El algoritmo `bcrypt` tiene un costo computacional intencionalmente elevado. Si un atacante envía cadenas arbitrariamente largas (miles de caracteres) en el campo de contraseña, el cómputo puede saturar el procesador del servidor.
- **Riesgo:** Denegación de servicio por agotamiento de recursos de cómputo (CWE-400).
- **Acción Correctiva:** Se implementó una restricción de longitud máxima de 128 caracteres para contraseñas en el endpoint `POST /api/auth/login` y en la función `verifyPassword`, rechazando de inmediato entradas sobredimensionadas antes del procesamiento criptográfico.

### 2.3. Mitigación de Ataques de Temporización (Timing Attacks)
- **Diagnóstico:** Al autenticar, si el usuario no existía en la base de datos, la API respondía de inmediato sin ejecutar `bcrypt.compare`. Si el usuario sí existía, la API ejecutaba la comparación (tardando cientos de milisegundos).
- **Riesgo:** Un atacante podía deducir qué correos institucionales existen en el sistema analizando la latencia de respuesta (User Enumeration via Timing Analysis).
- **Acción Correctiva:** Cuando el usuario no es encontrado, se ejecuta una comparación dummy contra un hash predefinido utilizando `bcrypt.compare`. Con esto, el tiempo de respuesta es indistinguible entre credenciales de usuarios existentes y no existentes.

### 2.4. Protección contra Expresiones Regulares Catastróficas (ReDoS)
- **Diagnóstico:** La validación de correo mediante expresiones regulares complejas puede sufrir degradación exponencial ante cadenas maliciosas con patrones repetitivos sin límite de longitud.
- **Riesgo:** Denegación de servicio por evaluación de expresiones regulares (CWE-1333).
- **Acción Correctiva:** Se incorporó una validación previa de longitud máxima de 254 caracteres (estándar RFC 5321) en `validateEmailFormat` antes de evaluar la expresión regular.

### 2.5. Depuración de Comentarios y Estandarización de Código
- **Diagnóstico:** Presencia de comentarios redundantes sobre sintaxis elemental y uso de emojis en documentación y código fuente.
- **Acción Correctiva:** Se removieron comentarios obvios, conservando únicamente notas técnicas esenciales que justifican decisiones arquitectónicas y de seguridad. Se eliminaron todos los caracteres emoji de todo el repositorio.

---

## 3. Matriz de Seguridad y Cumplimiento

| Control | Criterio Evaluado | Estado | Implementación |
| :--- | :--- | :--- | :--- |
| **Hashing de Claves** | No almacenar contraseñas en texto plano | Conforme | Algoritmo bcrypt con factor de salting 10 (`src/lib/auth.ts`). |
| **Manejo de Sesión** | Stateless, firmado criptográficamente | Conforme | JWT firmado con secreto de servidor y expiración diferenciada. |
| **Separación de Storage** | Persistencia controlada por el usuario | Conforme | `localStorage` con sesión prolongada si selecciona "Recordarme"; `sessionStorage` temporal si no. |
| **Mensajes de Error** | Evitar fuga de información en autenticación | Conforme | Mensaje neutral "Credenciales incorrectas" ante fallas de correo o clave. |
| **Sanitización de Entrada** | Tipado y validación de estructura | Conforme | Validación estricta de tipos (`string`), campos vacíos y formato RFC 5322. |

---

## 4. Resultados de Pruebas Automatizadas

Se ejecutó la suite completa de pruebas unitarias y de integración mediante Jest (`npm test`):

- **Suite de pruebas:** `tests/auth.test.ts`
- **Pruebas ejecutadas:** 15 pruebas
- **Pruebas aprobadas:** 15 pruebas (100%)
- **Pruebas fallidas:** 0
- **Tiempo de ejecución:** 8.2 segundos

---

## 5. Conclusión

El código del módulo de autenticación cumple con los estándares de seguridad requeridos, mitigando vectores comunes de denegación de servicio, temporización e inyección de datos inválidos.
