import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { ROLES } from "@/lib/types";
import type { RoleType, UserPayload } from "@/lib/types";
import { PASSWORD_MAX_LENGTH } from "@/lib/validation";

export const AUTH_COOKIE_NAME = "auth_token";
const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const JWT_ALGORITHM = "HS256";
const JWT_SECRET_MIN_LENGTH = 32;

// Lectura perezosa: evita fallar al importar el modulo (p. ej. durante `next build`)
// y obliga a que el secreto exista cuando realmente se firma o verifica un token.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET no está configurado o tiene menos de ${JWT_SECRET_MIN_LENGTH} caracteres. ` +
        "Defínelo en .env.local (ver .env.example)."
    );
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Limita contraseñas excesivas para prevenir sobrecarga de CPU en el hashing de bcrypt
  if (!password || password.length > PASSWORD_MAX_LENGTH) return false;
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: UserPayload, rememberMe: boolean = false): string {
  // Define expiracion prolongada (30 dias) si el usuario marco "Recordarme", o 1 dia por defecto
  const expiresIn = rememberMe ? "30d" : "1d";
  return jwt.sign(payload, getJwtSecret(), { algorithm: JWT_ALGORITHM, expiresIn });
}

export function verifyToken(token: string): UserPayload | null {
  // La configuracion ausente es un error del servidor, no un token invalido: debe propagarse.
  const secret = getJwtSecret();
  try {
    const decoded = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] }) as Partial<UserPayload>;
    if (
      typeof decoded.id !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.nombre !== "string" ||
      !ROLES.includes(decoded.rol as RoleType)
    ) {
      return null;
    }
    // Devuelve solo los claims de usuario (sin iat/exp) para no filtrarlos a las respuestas
    return { id: decoded.id, email: decoded.email, nombre: decoded.nombre, rol: decoded.rol as RoleType };
  } catch {
    return null;
  }
}

// Atributos de la cookie de sesion. Sin maxAge es una cookie de sesion (se borra al cerrar el navegador).
// Se reutilizan en login y logout: para expirarla el navegador exige los mismos atributos.
export function getAuthCookieOptions(rememberMe: boolean = false) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(rememberMe ? { maxAge: REMEMBER_ME_MAX_AGE_SECONDS } : {}),
  };
}

type TokenSource = "bearer" | "cookie";

// Prioriza el header Authorization: Bearer y recurre a la cookie auth_token como respaldo
function extractToken(request: NextRequest): { token: string; source: TokenSource } | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) return { token, source: "bearer" };
  }

  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) return { token: cookieToken, source: "cookie" };

  return null;
}

export function getUserFromRequest(request: NextRequest): UserPayload | null {
  const extracted = extractToken(request);
  return extracted ? verifyToken(extracted.token) : null;
}

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// Defensa CSRF: si la peticion modifica estado y se autentica por cookie, el Origin
// (cuando el navegador lo envia) debe coincidir con el host al que va dirigida.
function isForeignOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const expectedHost = request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host !== expectedHost;
  } catch {
    // Un Origin que no es una URL valida (p. ej. "null") se trata como ajeno
    return true;
  }
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

export function requireAuth(request: NextRequest): { user: UserPayload } | NextResponse {
  const extracted = extractToken(request);
  if (!extracted) {
    return errorResponse("No autenticado", 401);
  }

  const user = verifyToken(extracted.token);
  if (!user) {
    return errorResponse("Token inválido o expirado", 401);
  }

  if (
    extracted.source === "cookie" &&
    STATE_CHANGING_METHODS.includes(request.method.toUpperCase()) &&
    isForeignOrigin(request)
  ) {
    return errorResponse("No tiene permisos para realizar esta acción", 403);
  }

  return { user };
}

export function requireRole(
  request: NextRequest,
  roles: RoleType[]
): { user: UserPayload } | NextResponse {
  const result = requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (!roles.includes(result.user.rol)) {
    return errorResponse("No tiene permisos para realizar esta acción", 403);
  }

  return result;
}
