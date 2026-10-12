import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, generateToken, getAuthCookieOptions, AUTH_COOKIE_NAME } from "@/lib/auth";
import type { UserPayload } from "@/lib/types";
import { validateEmailFormat, PASSWORD_MAX_LENGTH } from "@/lib/validation";
import { findUserByEmail } from "@/lib/users";
import bcrypt from "bcryptjs";

// Hash dummy para mitigar ataques de temporizacion (timing attacks) cuando el usuario no existe
const DUMMY_HASH = "$2a$10$wN1b6h8t8mPZqH8kK.6R9.WwE8lI4x1dJbM0oG9rQ5z7T6s5A4k2u";

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Cuerpo de solicitud inválido" },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = body;

    if (!email || typeof email !== "string" || email.trim() === "") {
      return NextResponse.json(
        { success: false, message: "El correo electrónico es obligatorio" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password === "") {
      return NextResponse.json(
        { success: false, message: "La contraseña es obligatoria" },
        { status: 400 }
      );
    }

    // Previene ataques de denegacion de servicio por hashes excesivos en CPU
    if (password.length > PASSWORD_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, message: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    if (!validateEmailFormat(email)) {
      return NextResponse.json(
        { success: false, message: "El formato del correo electrónico no es válido" },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);

    if (!user) {
      // Ejecuta verificacion dummy para que el tiempo de respuesta sea uniforme
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json(
        { success: false, message: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
    };

    // Solo un booleano true activa la persistencia (evita que el texto "false" cuente como verdadero)
    const isRemember = rememberMe === true;
    const token = generateToken(payload, isRemember);

    // El token viaja unicamente en la cookie httpOnly: nunca en el cuerpo de la respuesta
    const response = NextResponse.json(
      {
        success: true,
        message: "Inicio de sesión exitoso",
        user: payload,
      },
      { status: 200 }
    );

    response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions(isRemember));

    return response;
  } catch (error) {
    console.error("Error en POST /api/auth/login:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
