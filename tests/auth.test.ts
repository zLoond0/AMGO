import {
  validateEmailFormat,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  UserPayload,
} from "../src/lib/auth";
import { findUserByEmail } from "../src/lib/users";
import { POST } from "../src/app/api/auth/login/route";

describe("1. Validaciones de Formato y Campos Obligatorios", () => {
  test("Debe aceptar correos con formato válido institucional", () => {
    expect(validateEmailFormat("docente@amigo.edu.co")).toBe(true);
    expect(validateEmailFormat("coordinador@amigo.edu.co")).toBe(true);
    expect(validateEmailFormat("admin@amigo.edu.co")).toBe(true);
    expect(validateEmailFormat("usuario.prueba@dominio.com")).toBe(true);
  });

  test("Debe rechazar correos con formato inválido o longitud excesiva", () => {
    expect(validateEmailFormat("")).toBe(false);
    expect(validateEmailFormat("correo-invalido")).toBe(false);
    expect(validateEmailFormat("correo@")).toBe(false);
    expect(validateEmailFormat("@amigo.edu.co")).toBe(false);
    expect(validateEmailFormat("correo@amigo")).toBe(false);
    // Simula correo con longitud superior a 254 caracteres
    expect(validateEmailFormat(`${"a".repeat(250)}@amigo.edu.co`)).toBe(false);
  });
});

describe("2. Encriptación y Verificación de Contraseñas (bcrypt)", () => {
  const plainPassword = "Password123!";

  test("Debe generar un hash seguro diferente a la contraseña en texto plano", async () => {
    const hash = await hashPassword(plainPassword);
    expect(hash).toBeDefined();
    expect(hash).not.toEqual(plainPassword);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
  });

  test("Debe verificar exitosamente la contraseña correcta", async () => {
    const hash = await hashPassword(plainPassword);
    const isValid = await verifyPassword(plainPassword, hash);
    expect(isValid).toBe(true);
  });

  test("Debe fallar la verificación cuando la contraseña es incorrecta", async () => {
    const hash = await hashPassword(plainPassword);
    const isValid = await verifyPassword("ContrasenaErronea999", hash);
    expect(isValid).toBe(false);
  });
});

describe("3. Generación y Validación de Token JWT / Sesión", () => {
  const mockUser: UserPayload = {
    id: "usr_001",
    email: "docente@amigo.edu.co",
    nombre: "Prof. Carlos Restrepo",
    rol: "Docente",
  };

  test("Debe generar un token JWT válido con el payload del usuario", () => {
    const token = generateToken(mockUser, false);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe(mockUser.email);
    expect(decoded?.rol).toBe("Docente");
    expect(decoded?.nombre).toBe(mockUser.nombre);
  });

  test("Debe generar token persistente cuando 'rememberMe' es verdadero", () => {
    const token = generateToken(mockUser, true);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(mockUser.id);
  });

  test("Debe retornar null al verificar un token inválido", () => {
    const decoded = verifyToken("token_invalido_totalmente_falso");
    expect(decoded).toBeNull();
  });
});

describe("4. Asignación Automática de Roles Institucionales", () => {
  test("Debe contener usuarios con roles Docente, Coordinador y Administrador", () => {
    const docente = findUserByEmail("docente@amigo.edu.co");
    expect(docente).toBeDefined();
    expect(docente?.rol).toBe("Docente");

    const coordinador = findUserByEmail("coordinador@amigo.edu.co");
    expect(coordinador).toBeDefined();
    expect(coordinador?.rol).toBe("Coordinador");

    const admin = findUserByEmail("admin@amigo.edu.co");
    expect(admin).toBeDefined();
    expect(admin?.rol).toBe("Administrador");
  });
});

describe("5. Pruebas de Integración - Endpoint POST /api/auth/login", () => {
  // Construye la peticion simulada para invocar el Route Handler de Next.js
  const createMockRequest = (body: any) => {
    return new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as any;
  };

  test("Debe responder 400 si falta el correo institucional", async () => {
    const req = createMockRequest({ email: "", password: "Password123!" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.message).toBe("El correo electrónico es obligatorio");
  });

  test("Debe responder 400 si el formato del correo es inválido", async () => {
    const req = createMockRequest({ email: "correo-sin-formato", password: "Password123!" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.message).toBe("El formato del correo electrónico no es válido");
  });

  test("Debe responder 400 si falta la contraseña", async () => {
    const req = createMockRequest({ email: "docente@amigo.edu.co", password: "" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.message).toBe("La contraseña es obligatoria");
  });

  test("Debe responder 401 con 'Credenciales incorrectas' si el correo no existe", async () => {
    const req = createMockRequest({
      email: "inexistente@amigo.edu.co",
      password: "Password123!",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Credenciales incorrectas");
  });

  test("Debe responder 401 con 'Credenciales incorrectas' si la contraseña es errónea", async () => {
    const req = createMockRequest({
      email: "docente@amigo.edu.co",
      password: "PasswordEquivocada999",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Credenciales incorrectas");
  });

  test("Debe responder 200 y retornar token JWT cuando las credenciales son correctas", async () => {
    const req = createMockRequest({
      email: "docente@amigo.edu.co",
      password: "Password123!",
      rememberMe: true,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("docente@amigo.edu.co");
    expect(data.user.rol).toBe("Docente");
  });
});
