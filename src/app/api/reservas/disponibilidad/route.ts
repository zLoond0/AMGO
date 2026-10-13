import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  BLOQUES,
  ANTICIPACION_MAXIMA_DIAS,
  normalizarSemanaBogota,
  crearFechaBogota,
} from "@/lib/config";
import type { EstadoBloqueDisponibilidad } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const recursoId = searchParams.get("recursoId");
  const semana = searchParams.get("semana");

  if (!recursoId || !semana) {
    return NextResponse.json(
      {
        success: false,
        message: "Los parámetros recursoId y semana son obligatorios",
      },
      { status: 400 }
    );
  }

  // 1. Normalizar semana (Bogotá)
  let semanaNormalizada: ReturnType<typeof normalizarSemanaBogota>;
  try {
    semanaNormalizada = normalizarSemanaBogota(semana);
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Formato de fecha inválido para el parámetro semana",
      },
      { status: 400 }
    );
  }

  // 2. Verificar existencia y actividad del recurso
  const recurso = await prisma.recurso.findUnique({
    where: { id: recursoId },
    select: { id: true, nombre: true, activo: true },
  });

  if (!recurso || !recurso.activo) {
    return NextResponse.json(
      {
        success: false,
        message: "Recurso no encontrado o inactivo",
      },
      { status: 404 }
    );
  }

  const ahora = new Date();

  // 3. Liberar retenciones vencidas antes de calcular disponibilidad
  await prisma.reserva.updateMany({
    where: {
      estado: "RETENIDA",
      expiraEn: { lte: ahora },
    },
    data: {
      estado: "EXPIRADA",
    },
  });

  // 4. Consultar reservas activas (CONFIRMADA o RETENIDA) en el rango de la semana
  const fechaInicioSemana = crearFechaBogota(semanaNormalizada.lunes, "00:00");
  const fechaFinSemana = crearFechaBogota(
    semanaNormalizada.viernes,
    "23:59:59"
  );

  const reservasSemana = await prisma.reserva.findMany({
    where: {
      recursoId,
      estado: { in: ["CONFIRMADA", "RETENIDA"] },
      inicio: { lt: fechaFinSemana },
      fin: { gt: fechaInicioSemana },
    },
    select: {
      id: true,
      usuarioId: true,
      inicio: true,
      fin: true,
      estado: true,
      expiraEn: true,
    },
  });

  const limiteFuturoMs =
    ahora.getTime() + ANTICIPACION_MAXIMA_DIAS * 24 * 60 * 60 * 1000;

  // 5. Construir los días y bloques
  const dias = semanaNormalizada.dias.map((fechaDia) => {
    const bloques = BLOQUES.map((bloque) => {
      const inicioBloque = crearFechaBogota(fechaDia, bloque.inicio);
      const finBloque = crearFechaBogota(fechaDia, bloque.fin);

      let estado: EstadoBloqueDisponibilidad = "disponible";

      if (inicioBloque.getTime() <= ahora.getTime()) {
        estado = "pasada";
      } else if (inicioBloque.getTime() > limiteFuturoMs) {
        estado = "fuera_de_rango";
      } else {
        // Buscar reserva que solape con este bloque
        const solape = reservasSemana.find(
          (r) =>
            r.inicio.getTime() < finBloque.getTime() &&
            r.fin.getTime() > inicioBloque.getTime()
        );

        if (solape) {
          if (solape.estado === "CONFIRMADA") {
            estado = "ocupada";
          } else if (solape.estado === "RETENIDA") {
            estado =
              solape.usuarioId === auth.user.id ? "tu_retencion" : "retenida";
          }
        }
      }

      return {
        inicio: bloque.inicio,
        fin: bloque.fin,
        inicioIso: inicioBloque.toISOString(),
        finIso: finBloque.toISOString(),
        estado,
      };
    });

    return {
      fecha: fechaDia,
      bloques,
    };
  });

  return NextResponse.json({
    success: true,
    semana: {
      lunes: semanaNormalizada.lunes,
      viernes: semanaNormalizada.viernes,
    },
    dias,
  });
}
