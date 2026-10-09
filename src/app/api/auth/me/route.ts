import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Extrae el token priorizando el header Bearer y recurriendo a la cookie como respaldo
  const authHeader = request.headers.get("authorization");
  let token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token) {
    token = request.cookies.get("auth_token")?.value || null;
  }

  if (!token) {
    return NextResponse.json(
      { success: false, message: "No autenticado" },
      { status: 401 }
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, message: "Token inválido o expirado" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    user: payload,
  });
}
