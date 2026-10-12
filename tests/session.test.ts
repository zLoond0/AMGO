import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  generateToken,
  verifyToken,
  getUserFromRequest,
  requireAuth,
  requireRole,
} from "../src/lib/auth";
import type { UserPayload } from "../src/lib/types";
import { GET as meGET } from "../src/app/api/auth/me/route";
import { POST as loginPOST } from "../src/app/api/auth/login/route";
import { POST as logoutPOST } from "../src/app/api/auth/logout/route";

const docente: UserPayload = {
  id: "usr_001",
  email: "docente@amigo.edu.co",
  nombre: "Prof. Carlos Restrepo",
  rol: "Docente",
};

const BASE_URL = "http://localhost:3000";

const createRequest = (
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) =>
  new NextRequest(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

describe("6. verifyToken: expiración y manipulación", () => {
  test("Debe retornar null con un token expirado", () => {
    const expired = jwt.sign(docente, process.env.JWT_SECRET as string, {
      algorithm: "HS256",
      expiresIn: -10,
    });
    expect(verifyToken(expired)).toBeNull();
  });

  test("Debe retornar null si se manipula el payload (rol elevado) conservando la firma", () => {
    const [header, , signature] = generateToken(docente).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...docente, rol: "Administrador" })
    ).toString("base64url");
    expect(verifyToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  test("Debe retornar null con un token firmado con otro secreto", () => {
    const foreign = jwt.sign(docente, "otro-secreto-distinto-de-al-menos-32-caracteres", {
      algorithm: "HS256",
    });
    expect(verifyToken(foreign)).toBeNull();
  });

  test("Debe retornar null si el rol del token no es un rol conocido", () => {
    const token = jwt.sign({ ...docente, rol: "Superusuario" }, process.env.JWT_SECRET as string, {
      algorithm: "HS256",
    });
    expect(verifyToken(token)).toBeNull();
  });

  test("Debe devolver solo los claims del usuario (sin iat ni exp)", () => {
    const decoded = verifyToken(generateToken(docente));
    expect(decoded).toEqual(docente);
  });
});

describe("7. GET /api/auth/me", () => {
  test("Debe responder 401 'No autenticado' sin token", async () => {
    const res = await meGET(createRequest("/api/auth/me"));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data).toEqual({ success: false, message: "No autenticado" });
  });

  test("Debe responder 401 'Token inválido o expirado' con un token inválido", async () => {
    const res = await meGET(
      createRequest("/api/auth/me", { headers: { Authorization: "Bearer token.falso.invalido" } })
    );
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.message).toBe("Token inválido o expirado");
  });

  test("Debe responder 200 con el usuario cuando el token Bearer es válido", async () => {
    const token = generateToken(docente);
    const res = await meGET(
      createRequest("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toEqual(docente);
  });

  test("Debe responder 200 cuando el token llega por la cookie auth_token", async () => {
    const token = generateToken(docente);
    const res = await meGET(
      createRequest("/api/auth/me", { headers: { Cookie: `auth_token=${token}` } })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.user.email).toBe(docente.email);
  });
});

describe("8. getUserFromRequest y requireRole", () => {
  test("getUserFromRequest debe devolver null sin credenciales y el usuario con un token válido", () => {
    expect(getUserFromRequest(createRequest("/api/x"))).toBeNull();
    const token = generateToken(docente);
    const user = getUserFromRequest(
      createRequest("/api/x", { headers: { Authorization: `Bearer ${token}` } })
    );
    expect(user).toEqual(docente);
  });

  test("requireRole debe dejar pasar un rol permitido", () => {
    const token = generateToken(docente);
    const result = requireRole(
      createRequest("/api/x", { headers: { Authorization: `Bearer ${token}` } }),
      ["Docente", "Coordinador"]
    );
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { user: UserPayload }).user.rol).toBe("Docente");
  });

  test("requireRole debe responder 403 con un rol no permitido", async () => {
    const token = generateToken(docente);
    const result = requireRole(
      createRequest("/api/x", { headers: { Authorization: `Bearer ${token}` } }),
      ["Administrador"]
    );
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe("No tiene permisos para realizar esta acción");
  });

  test("requireRole debe responder 401 sin autenticación", () => {
    const result = requireRole(createRequest("/api/x"), ["Administrador"]);
    expect((result as NextResponse).status).toBe(401);
  });
});

describe("9. Cookie de sesión en login y logout", () => {
  const login = (rememberMe: boolean) =>
    loginPOST(
      createRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { email: "docente@amigo.edu.co", password: "Password123!", rememberMe },
      })
    );

  test("El login con 'Recordarme' fija cookie httpOnly de 30 días y no devuelve el token en el JSON", async () => {
    const res = await login(true);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.token).toBeUndefined();
    expect(data.user.email).toBe("docente@amigo.edu.co");

    const cookie = res.cookies.get("auth_token");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 30);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  });

  test("El login sin 'Recordarme' fija una cookie de sesión (sin maxAge) y JWT de 1 día", async () => {
    const res = await login(false);
    const cookie = res.cookies.get("auth_token");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBeUndefined();

    const decoded = jwt.decode(cookie?.value as string) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(60 * 60 * 24);
  });

  test("La cookie emitida por el login es aceptada por /api/auth/me", async () => {
    const res = await login(false);
    const token = res.cookies.get("auth_token")?.value as string;
    const me = await meGET(createRequest("/api/auth/me", { headers: { Cookie: `auth_token=${token}` } }));
    expect(me.status).toBe(200);
  });

  test("El logout expira la cookie auth_token con los mismos atributos", async () => {
    const res = await logoutPOST();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, message: "Sesión cerrada" });

    const cookie = res.cookies.get("auth_token");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("lax");
  });
});

describe("10. Defensa CSRF por Origin (autenticación por cookie)", () => {
  const cookieHeader = () => ({ Cookie: `auth_token=${generateToken(docente)}` });

  test("POST con Origin ajeno y auth por cookie responde 403", async () => {
    const result = requireAuth(
      createRequest("/api/reservas", {
        method: "POST",
        headers: { ...cookieHeader(), Origin: "http://sitio-malicioso.example" },
      })
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  test("POST con Origin igual al host de la petición pasa", () => {
    const result = requireAuth(
      createRequest("/api/reservas", {
        method: "POST",
        headers: { ...cookieHeader(), Origin: BASE_URL },
      })
    );
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  test("POST sin header Origin pasa (peticiones que no son de navegador)", () => {
    const result = requireAuth(
      createRequest("/api/reservas", { method: "POST", headers: cookieHeader() })
    );
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  test("Un Origin 'null' se trata como ajeno", () => {
    const result = requireAuth(
      createRequest("/api/reservas", {
        method: "DELETE",
        headers: { ...cookieHeader(), Origin: "null" },
      })
    );
    expect((result as NextResponse).status).toBe(403);
  });

  test("GET con Origin ajeno no se bloquea (no modifica estado)", () => {
    const result = requireAuth(
      createRequest("/api/reservas", {
        method: "GET",
        headers: { ...cookieHeader(), Origin: "http://sitio-malicioso.example" },
      })
    );
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  test("POST con Origin ajeno pero autenticado por Bearer no se bloquea", () => {
    const result = requireAuth(
      createRequest("/api/reservas", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${generateToken(docente)}`,
          Origin: "http://sitio-malicioso.example",
        },
      })
    );
    expect(result).not.toBeInstanceOf(NextResponse);
  });
});
