import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  validarInicioReserva,
  HOLD_MINUTOS,
} from "@/lib/config";
import { TIPOS_USO, ESTADOS_RESERVA } from "@/lib/types";
import type { TipoUso, EstadoReserva } from "@/lib/types";

/**
 * POST /api/reservas
 * Crea una retención temporal (estado RETENIDA) de 5 minutos sobre un bloque de 2 horas.
 * Body: { recursoId: string, inicio: string, tipo: TipoUso }
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { recursoId?: string; inicio?: string; tipo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo de la petición inválido" },
      { status: 400 }
    );
  }

  const { recursoId, inicio: inicioRaw, tipo } = body;

  if (!recursoId || typeof recursoId !== "string") {
    return NextResponse.json(
      { success: false, message: "El recursoId es obligatorio" },
      { status: 400 }
    );
  }

  if (!tipo || !TIPOS_USO.includes(tipo as TipoUso)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "El tipo de uso es obligatorio y debe ser CLASE, PRACTICA o INVESTIGACION",
      },
      { status: 400 }
    );
  }

  if (!inicioRaw) {
    return NextResponse.json(
      { success: false, message: "La fecha y hora de inicio es obligatoria" },
      { status: 400 }
    );
  }

  // 1. Validar el inicio según las reglas de negocio de Bogotá
  const validacion = validarInicioReserva(inicioRaw);
  if (!validacion.valido) {
    return NextResponse.json(
      { success: false, message: validacion.error },
      { status: 400 }
    );
  }

  const { inicio, fin } = validacion;
  const ahora = new Date();

  try {
    // 2. Transacción atómica para evitar condiciones de carrera (concurrencia)
    const resultado = await prisma.$transaction(
      async (tx) => {
        // Liberar retenciones vencidas
        await tx.reserva.updateMany({
          where: {
            estado: "RETENIDA",
            expiraEn: { lte: ahora },
          },
          data: {
            estado: "EXPIRADA",
          },
        });

        // Verificar que el recurso exista y esté activo
        const recurso = await tx.recurso.findUnique({
          where: { id: recursoId },
          select: { id: true, nombre: true, activo: true },
        });

        if (!recurso || !recurso.activo) {
          return {
            error: "Recurso no encontrado o inactivo",
            status: 404 as const,
          };
        }

        // Máximo una retención activa por usuario
        const retencionUsuario = await tx.reserva.findFirst({
          where: {
            usuarioId: auth.user.id,
            estado: "RETENIDA",
            expiraEn: { gt: ahora },
          },
        });

        if (retencionUsuario) {
          return {
            error:
              "Ya tienes una reserva en proceso de confirmación. Confírmala o cancélala antes de solicitar otra.",
            status: 409 as const,
          };
        }

        // Restricción anti-solape: cubre CONFIRMADA y RETENIDA
        const conflicto = await tx.reserva.findFirst({
          where: {
            recursoId,
            estado: { in: ["CONFIRMADA", "RETENIDA"] },
            inicio: { lt: fin },
            fin: { gt: inicio },
          },
        });

        if (conflicto) {
          return {
            error:
              "El bloque solicitado ya no está disponible (ha sido reservado o retenido).",
            status: 409 as const,
          };
        }

        // expiraEn = min(ahora + HOLD_MINUTOS, inicio del bloque)
        const maxHoldTime = new Date(
          ahora.getTime() + HOLD_MINUTOS * 60 * 1000
        ).getTime();
        const expiraEn = new Date(Math.min(maxHoldTime, inicio.getTime()));

        const reservaCreada = await tx.reserva.create({
          data: {
            recursoId,
            usuarioId: auth.user.id,
            inicio,
            fin,
            tipo: tipo as TipoUso,
            estado: "RETENIDA",
            expiraEn,
          },
          include: {
            recurso: {
              select: { id: true, nombre: true },
            },
          },
        });

        return { reserva: reservaCreada, status: 201 as const };
      },
      { maxWait: 15000, timeout: 15000 }
    );

    if ("error" in resultado) {
      return NextResponse.json(
        { success: false, message: resultado.error },
        { status: resultado.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        reserva: resultado.reserva,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear retención de reserva:", error);
    return NextResponse.json(
      { success: false, message: "Error interno al procesar la reserva" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reservas
 * Listado de reservas.
 * Query params:
 * - alcance: "mias" (defecto) | "todas" (solo Coordinador/Administrador)
 * - desde: ISO string o "ahora" (filtra inicio >= desde)
 * - estado: string ("CONFIRMADA", "CANCELADA", etc.)
 * - limite: número de resultados
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const alcance = searchParams.get("alcance") ?? "mias";
  const desdeRaw = searchParams.get("desde");
  const estadoRaw = searchParams.get("estado");
  const limiteRaw = searchParams.get("limite");

  // Validación de permisos por rol para alcance=todas
  if (alcance === "todas") {
    if (auth.user.rol === "Docente") {
      return NextResponse.json(
        {
          success: false,
          message:
            "No tienes permisos para ver las reservas de todos los usuarios",
        },
        { status: 403 }
      );
    }
  }

  // Filtros
  const where: Record<string, unknown> = {};

  if (alcance === "mias") {
    where.usuarioId = auth.user.id;
  }

  // Por defecto lista CONFIRMADA y CANCELADA (RETENIDA y EXPIRADA son internas del flujo)
  if (estadoRaw && ESTADOS_RESERVA.includes(estadoRaw as EstadoReserva)) {
    where.estado = estadoRaw;
  } else if (!estadoRaw) {
    where.estado = { in: ["CONFIRMADA", "CANCELADA"] };
  }

  if (desdeRaw) {
    const ahora = new Date();
    const fechaDesde = desdeRaw === "ahora" ? ahora : new Date(desdeRaw);
    if (!isNaN(fechaDesde.getTime())) {
      where.inicio = { gte: fechaDesde };
    }
  }

  const take = limiteRaw ? parseInt(limiteRaw, 10) : undefined;

  try {
    const reservas = await prisma.reserva.findMany({
      where,
      take: isNaN(take as number) ? undefined : take,
      orderBy: { inicio: "asc" },
      include: {
        recurso: {
          select: { id: true, nombre: true, descripcion: true },
        },
        ...(alcance === "todas"
          ? {
              usuario: {
                select: {
                  id: true,
                  nombre: true,
                  email: true,
                  rol: true,
                },
              },
            }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      reservas,
    });
  } catch (error) {
    console.error("Error al consultar reservas:", error);
    return NextResponse.json(
      { success: false, message: "Error interno al consultar las reservas" },
      { status: 500 }
    );
  }
}
