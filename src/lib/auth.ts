import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "amgo-laboratorio-secret-key-2026-super-secure";

export interface UserPayload {
  id: string;
  email: string;
  nombre: string;
  rol: "Docente" | "Coordinador" | "Administrador";
}

export function validateEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  // RFC 5321 limita la longitud del correo a 254 caracteres para prevenir ataques ReDoS
  if (email.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Limita contraseñas excesivas para prevenir sobrecarga de CPU en el hashing de bcrypt
  if (!password || password.length > 128) return false;
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: UserPayload, rememberMe: boolean = false): string {
  // Define expiracion prolongada (30 dias) si el usuario marco "Recordarme", o 1 dia por defecto
  const expiresIn = rememberMe ? "30d" : "1d";
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}
