import { NextRequest } from "next/server";
import {
  createRateLimiter,
  loginRateLimiter,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  getClientIp,
  loginRateLimitKey,
} from "../src/lib/rate-limit";
import { POST as loginPOST } from "../src/app/api/auth/login/route";

describe("11. Limitador en memoria (createRateLimiter)", () => {
  const WINDOW = 15 * 60 * 1000;
  let currentTime: number;
  const makeLimiter = (maxEntries?: number) =>
    createRateLimiter({ maxAttempts: 5, windowMs: WINDOW, maxEntries, now: () => currentTime });

  beforeEach(() => {
    currentTime = 1_000_000;
  });

  test("Permite 5 fallos y limita a partir del siguiente intento", () => {
    const limiter = makeLimiter();
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("k").limited).toBe(false);
      limiter.recordFailure("k");
    }
    const status = limiter.check("k");
    expect(status.limited).toBe(true);
    expect(status.retryAfterSeconds).toBe(WINDOW / 1000);
  });

  test("Retry-After disminuye con el tiempo y se libera al salir el fallo más antiguo de la ventana", () => {
    const limiter = makeLimiter();
    for (let i = 0; i < 5; i++) limiter.recordFailure("k");

    currentTime += 10 * 60 * 1000;
    const mid = limiter.check("k");
    expect(mid.limited).toBe(true);
    expect(mid.retryAfterSeconds).toBe(5 * 60);

    currentTime += 5 * 60 * 1000;
    expect(limiter.check("k").limited).toBe(false);
  });

  test("reset elimina el contador de esa clave sin afectar a otras", () => {
    const limiter = makeLimiter();
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure("a");
      limiter.recordFailure("b");
    }
    limiter.reset("a");
    expect(limiter.check("a").limited).toBe(false);
    expect(limiter.check("b").limited).toBe(true);
  });

  test("Purga las entradas vencidas: el Map no crece indefinidamente", () => {
    const limiter = makeLimiter();
    for (let i = 0; i < 100; i++) limiter.recordFailure(`ip|correo${i}@amigo.edu.co`);
    expect(limiter.size()).toBe(100);

    // Pasada la ventana, cualquier operacion dispara el barrido global
    currentTime += WINDOW + 1;
    limiter.check("otra-clave");
    expect(limiter.size()).toBe(0);
  });

  test("Respeta el tope maxEntries descartando las claves más antiguas", () => {
    const limiter = makeLimiter(10);
    for (let i = 0; i < 50; i++) limiter.recordFailure(`clave${i}`);
    expect(limiter.size()).toBe(10);
  });
});

describe("12. POST /api/auth/login: límite de intentos (429)", () => {
  const EMAIL = "docente@amigo.edu.co";

  const attempt = (password: string, options: { email?: string; ip?: string } = {}) =>
    loginPOST(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": options.ip ?? "10.0.0.1",
        },
        body: JSON.stringify({ email: options.email ?? EMAIL, password }),
      })
    );

  beforeEach(() => {
    loginRateLimiter.clear();
  });

  test("Constantes: 5 intentos en 15 minutos", () => {
    expect(LOGIN_MAX_ATTEMPTS).toBe(5);
    expect(LOGIN_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  test("El 6.º intento fallido responde 429 con mensaje y Retry-After", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await attempt("ContrasenaIncorrecta1");
      expect(res.status).toBe(401);
    }

    const blocked = await attempt("ContrasenaIncorrecta1");
    const data = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(data).toEqual({
      success: false,
      message: "Demasiados intentos. Intente de nuevo más tarde.",
    });
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(Number(blocked.headers.get("Retry-After"))).toBeLessThanOrEqual(15 * 60);
  });

  test("Con la clave bloqueada incluso la contraseña correcta recibe 429", async () => {
    for (let i = 0; i < 5; i++) await attempt("ContrasenaIncorrecta1");
    const res = await attempt("Password123!");
    expect(res.status).toBe(429);
  });

  test("Un login exitoso reinicia el contador de la clave", async () => {
    for (let i = 0; i < 4; i++) await attempt("ContrasenaIncorrecta1");

    const ok = await attempt("Password123!");
    expect(ok.status).toBe(200);

    // Tras el reinicio hay otros 5 intentos fallidos disponibles antes del bloqueo
    for (let i = 0; i < 5; i++) {
      const res = await attempt("ContrasenaIncorrecta1");
      expect(res.status).toBe(401);
    }
    expect((await attempt("ContrasenaIncorrecta1")).status).toBe(429);
  });

  test("El límite es por combinación IP + correo: otra IP u otro correo no se ven afectados", async () => {
    for (let i = 0; i < 5; i++) await attempt("ContrasenaIncorrecta1");
    expect((await attempt("ContrasenaIncorrecta1")).status).toBe(429);

    expect((await attempt("Password123!", { ip: "10.0.0.2" })).status).toBe(200);
    expect((await attempt("Password123!", { email: "admin@amigo.edu.co" })).status).toBe(200);
  });

  test("El correo se normaliza (mayúsculas/espacios) al construir la clave", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      headers: { "X-Forwarded-For": "203.0.113.7, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.7");
    expect(loginRateLimitKey(req, "  Docente@Amigo.edu.co ")).toBe("203.0.113.7|docente@amigo.edu.co");
  });

  test("Las solicitudes con formato inválido (400) no cuentan como intentos fallidos", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await attempt("x", { email: "correo-invalido" });
      expect(res.status).toBe(400);
    }
    expect(loginRateLimiter.size()).toBe(0);
  });
});
