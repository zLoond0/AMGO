import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserPayload } from "@/lib/types";
import { PASSWORD_MAX_LENGTH } from "@/lib/validation";

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
    return jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] }) as UserPayload;
  } catch {
    return null;
  }
}
