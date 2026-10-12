import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import type { UserPayload } from "@/lib/types";

// Solo para Server Components. Devuelve el usuario de la sesion o null si no hay cookie valida.
// No usar middleware.ts para esto: corre en Edge y jsonwebtoken no funciona ahi.
// Nota: un layout de Next no se vuelve a ejecutar en navegacion suave entre rutas hijas,
// asi que cada page protegida debe llamar tambien a esta funcion.
export function getCurrentUser(): UserPayload | null {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
