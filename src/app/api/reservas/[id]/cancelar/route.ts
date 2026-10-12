import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/reservas/[id]/cancelar
 * Permite cancelar una reserva:
 * - El dueño puede cancelar su reserva si está CONFIRMADA o RETENIDA.
 * - Coordinador y Administrador pueden cancelar cualquier reserva CONFIRMADA.
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

    if (!reserva) {
      return NextResponse.json(
        { success: false, message: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    const esDuenio = reserva.usuarioId === auth.user.id;
    const esStaff = ["Coordinador", "Administrador"].includes(auth.user.rol);

    if (esDuenio) {
      if (
        reserva.estado !== "CONFIRMADA" &&
        reserva.estado !== "RETENIDA"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `La reserva ya se encuentra en estado ${reserva.estado}`,
          },
          { status: 400 }
        );
      }
    } else if (esStaff) {
      if (reserva.estado !== "CONFIRMADA") {
        return NextResponse.json(
          {
            success: false,
            message: `Solo se pueden cancelar reservas en estado CONFIRMADA (estado actual: ${reserva.estado})`,
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "No tienes permisos para cancelar esta reserva",
        },
        { status: 403 }
      );
    }

    const reservaCancelada = await prisma.reserva.update({
      where: { id },
      data: {
        estado: "CANCELADA",
        expiraEn: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reserva cancelada correctamente",
      reserva: reservaCancelada,
    });
  } catch (error) {
    console.error("Error al cancelar reserva:", error);
    return NextResponse.json(
      { success: false, message: "Error interno al cancelar la reserva" },
      { status: 500 }
    );
  }
}
