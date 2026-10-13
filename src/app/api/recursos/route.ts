import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const recursos = await prisma.recurso.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({
      success: true,
      recursos,
    });
  } catch (error) {
    console.error("Error al obtener recursos:", error);
    return NextResponse.json(
      { success: false, message: "Error interno al consultar los recursos" },
      { status: 500 }
    );
  }
}
