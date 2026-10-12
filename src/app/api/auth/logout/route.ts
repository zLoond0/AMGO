import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "@/lib/auth";

// No exige sesion valida: cerrar sesion siempre debe poder limpiar la cookie.
// Limitacion conocida: no hay revocacion de tokens en servidor (ver AUDIT.md).
export async function POST() {
  const response = NextResponse.json(
    { success: true, message: "Sesión cerrada" },
    { status: 200 }
  );

  // Mismos atributos que en el login: el navegador solo expira la cookie si coinciden
  response.cookies.set(AUTH_COOKIE_NAME, "", { ...getAuthCookieOptions(false), maxAge: 0 });

  return response;
}
