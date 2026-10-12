// Limitador de intentos en MEMORIA con ventana deslizante.
//
// LIMITACIONES (ver AUDIT.md):
// - El estado vive en el proceso de Node: solo es valido para UNA instancia. Con varias
//   instancias (o serverless) cada una tendria su propio contador y el limite real seria
//   N veces mayor. En produccion multi-instancia debe moverse a Redis o a la base de datos.
// - Se pierde al reiniciar el servidor.
// - La IP se toma de X-Forwarded-For / X-Real-IP. Solo es confiable si hay un proxy de
//   confianza delante que sobrescriba esos headers; si no, el cliente puede falsearla.
//   Por eso el limite no debe ser la unica defensa contra fuerza bruta distribuida.

import type { NextRequest } from "next/server";

export interface RateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
  // Tope de claves almacenadas: evita que un atacante agote la memoria variando correos/IP
  maxEntries?: number;
  // Reloj inyectable para pruebas
  now?: () => number;
}

export interface RateLimitStatus {
  limited: boolean;
  // Segundos hasta que se libere un intento (0 si no esta limitado)
  retryAfterSeconds: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { maxAttempts, windowMs, maxEntries = 10_000, now = Date.now } = options;
  // Cada clave guarda los instantes de sus intentos fallidos dentro de la ventana
  const failures = new Map<string, number[]>();
  let lastSweep = now();

  // Descarta del arreglo los fallos fuera de la ventana; elimina la clave si queda vacia
  function prune(key: string, current: number): number[] {
    const timestamps = failures.get(key);
    if (!timestamps) return [];
    const valid = timestamps.filter((t) => current - t < windowMs);
    if (valid.length === 0) {
      failures.delete(key);
    } else if (valid.length !== timestamps.length) {
      failures.set(key, valid);
    }
    return valid;
  }

  // Barrido global de claves vencidas, como maximo una vez por ventana, para no depender
  // de que la misma clave vuelva a consultarse.
  function sweep(current: number): void {
    if (current - lastSweep < windowMs) return;
    lastSweep = current;
    for (const key of Array.from(failures.keys())) {
      prune(key, current);
    }
  }

  return {
    check(key: string): RateLimitStatus {
      const current = now();
      sweep(current);
      const valid = prune(key, current);
      if (valid.length < maxAttempts) {
        return { limited: false, retryAfterSeconds: 0 };
      }
      // Se libera un intento cuando el fallo mas antiguo sale de la ventana
      const retryAfterMs = valid[0] + windowMs - current;
      return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    },

    recordFailure(key: string): void {
      const current = now();
      sweep(current);
      const valid = prune(key, current);
      valid.push(current);
      // Reinsertar mueve la clave al final del Map (orden de insercion = mas reciente)
      failures.delete(key);
      failures.set(key, valid);

      // Si se supera el tope, descarta las claves mas antiguas
      while (failures.size > maxEntries) {
        const oldest = failures.keys().next().value as string;
        failures.delete(oldest);
      }
    },

    reset(key: string): void {
      failures.delete(key);
    },

    // Solo para pruebas y diagnostico
    size(): number {
      return failures.size;
    },

    clear(): void {
      failures.clear();
    },
  };
}

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const loginRateLimiter = createRateLimiter({
  maxAttempts: LOGIN_MAX_ATTEMPTS,
  windowMs: LOGIN_WINDOW_MS,
});

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Clave de limite: combinacion IP + correo normalizado
export function loginRateLimitKey(request: NextRequest, email: string): string {
  return `${getClientIp(request)}|${email.trim().toLowerCase()}`;
}
