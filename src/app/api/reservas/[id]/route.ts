import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/reservas/[id]
 * Consulta el detalle de una reserva.
 * Accesible por el dueño de la reserva o por Coordinador/Administrador (solo lectura).
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = params;

  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id },
      include: {
        recurso: {
          select: { id: true, nombre: true, descripcion: true, activo: true },
        },
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
      },
    });

    if (!reserva) {
      return NextResponse.json(
        { success: false, message: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    const esDuenio = reserva.usuarioId === auth.user.id;
    const esStaff = ["Coordinador", "Administrador"].includes(auth.user.rol);

    if (!esDuenio && !esStaff) {
      return NextResponse.json(
        { success: false, message: "No tienes permiso para ver esta reserva" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      reserva,
    });
  } catch (error) {
    console.error("Error al obtener reserva por id:", error);
    return NextResponse.json(
      { success: false, message: "Error interno al consultar la reserva" },
      { status: 500 }
    );
  }
}
