import { NextRequest, NextResponse } from "next/server";
import { validateEmailFormat, verifyPassword, generateToken, UserPayload } from "@/lib/auth";
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
    if (password.length > 128) {
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

    const isRemember = Boolean(rememberMe);
    const token = generateToken(payload, isRemember);

    const response = NextResponse.json(
      {
        success: true,
        message: "Inicio de sesión exitoso",
        token,
        user: payload,
      },
      { status: 200 }
    );

    // Configura cookie segura con vigencia condicionada al parametro de persistencia
    const maxAge = isRemember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    response.cookies.set("auth_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (error) {
    console.error("Error en POST /api/auth/login:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
