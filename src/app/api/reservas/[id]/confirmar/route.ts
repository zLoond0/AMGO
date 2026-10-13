import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/reservas/[id]/confirmar
 * Pasa atómicamente la reserva de RETENIDA a CONFIRMADA.
 * Valida que la retención no haya expirado (410), que siga RETENIDA (409) y pertenezca al usuario (404).
 */
export async function PATCH(
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
    });

    if (!reserva || reserva.usuarioId !== auth.user.id) {
      return NextResponse.json(
        { success: false, message: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    if (reserva.estado !== "RETENIDA") {
      return NextResponse.json(
        {
          success: false,
          message: `La reserva ya no se encuentra retenida (estado: ${reserva.estado})`,
        },
        { status: 409 }
      );
    }

    const ahora = new Date();
    if (reserva.expiraEn && reserva.expiraEn <= ahora) {
      await prisma.reserva.update({
        where: { id },
        data: { estado: "EXPIRADA" },
      });
      return NextResponse.json(
        {
          success: false,
          message: "El tiempo de retención ha expirado",
        },
        { status: 410 }
      );
    }

    // Actualización atómica con updateMany para garantizar concurrencia
    const resultado = await prisma.reserva.updateMany({
      where: {
        id,
        usuarioId: auth.user.id,
        estado: "RETENIDA",
        expiraEn: { gt: ahora },
      },
      data: {
        estado: "CONFIRMADA",
        expiraEn: null,
      },
    });

    if (resultado.count === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "El tiempo de retención ha expirado o el estado cambió",
        },
        { status: 410 }
      );
    }

    const reservaConfirmada = await prisma.reserva.findUnique({
      where: { id },
      include: {
        recurso: {
          select: { id: true, nombre: true, descripcion: true },
        },
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reserva confirmada con éxito",
      reserva: reservaConfirmada,
    });
  } catch (error) {
    console.error("Error al confirmar reserva:", error);
    return NextResponse.json(
      { success: false, message: "Error interno al confirmar la reserva" },
      { status: 500 }
    );
  }
}
