"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  Laptop,
  AlertCircle,
  Calendar,
  XCircle,
  Plus,
} from "lucide-react";
import { EstadoBadge } from "@/components/EstadoBadge";
import { formatearRangoBogota } from "@/lib/config";

interface ReservaItem {
  id: string;
  inicio: string;
  fin: string;
  tipo: string;
  estado: string;
  recurso: {
    id: string;
    nombre: string;
    descripcion?: string | null;
  };
}

export default function MisReservasPage() {
  const [reservas, setReservas] = useState<ReservaItem[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>("TODAS");
  const [cargando, setCargando] = useState(true);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const cargarReservas = useCallback(async () => {
    try {
      setCargando(true);
      const url =
        filtroEstado === "TODAS"
          ? "/api/reservas?alcance=mias"
          : `/api/reservas?alcance=mias&estado=${filtroEstado}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al consultar reservas");
      const json = await res.json();
      if (json.success) {
        setReservas(json.reservas);
      }
    } catch {
      setMensajeError("No se pudieron cargar tus reservas.");
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  const handleCancelarReserva = async (id: string) => {
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas cancelar esta reserva? Esta acción no se puede deshacer."
    );
    if (!confirmar) return;

    setCancelandoId(id);
    try {
      const res = await fetch(`/api/reservas/${id}/cancelar`, {
        method: "PATCH",
      });
      if (res.ok) {
        // Refrescar lista
        cargarReservas();
      } else {
        const json = await res.json();
        alert(json.message || "No se pudo cancelar la reserva.");
      }
    } catch {
      alert("Error de conexión al cancelar.");
    } finally {
      setCancelandoId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Mis reservas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Historial y gestión de tus bloques reservados en los laboratorios
          </p>
        </div>

        <Link
          href="/dashboard/reservas"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva reserva</span>
        </Link>
      </div>

      {mensajeError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{mensajeError}</div>
        </div>
      )}

      {/* Filtros por estado */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto text-sm">
        {["TODAS", "CONFIRMADA", "CANCELADA"].map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => setFiltroEstado(estado)}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${
                filtroEstado === estado
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }
            `}
          >
            {estado === "TODAS"
              ? "Todas"
              : estado === "CONFIRMADA"
              ? "Confirmadas"
              : "Canceladas"}
          </button>
        ))}
      </div>

      {/* Listado */}
      {cargando ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
          Cargando reservas...
        </div>
      ) : reservas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-3 shadow-2xs">
          <Calendar className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500">
            No tienes reservas registradas en este estado.
          </p>
          <Link
            href="/dashboard/reservas"
            className="inline-block text-xs font-semibold text-amigo-blue hover:underline"
          >
            Consultar disponibilidad para reservar
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reservas.map((r) => {
            const inicioDate = new Date(r.inicio);
            const finDate = new Date(r.fin);
            const rangoTexto = formatearRangoBogota(inicioDate, finDate);
            const esFutura = inicioDate.getTime() > Date.now();
            const puedeCancelar = r.estado === "CONFIRMADA" && esFutura;

            const tipoTexto =
              r.tipo === "CLASE"
                ? "Clase"
                : r.tipo === "PRACTICA"
                ? "Práctica"
                : "Investigación";

            return (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-amigo-blue shrink-0" />
                    <span className="font-bold text-gray-900 text-sm">
                      {r.recurso.nombre}
                    </span>
                    <EstadoBadge estado={r.estado} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1 text-gray-700 font-medium">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {rangoTexto}
                    </span>
                    <span>•</span>
                    <span>Tipo: {tipoTexto}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">Sin costo</span>
                  </div>
                </div>

                {puedeCancelar && (
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCancelarReserva(r.id)}
                      disabled={cancelandoId === r.id}
                      className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{cancelandoId === r.id ? "Cancelando..." : "Cancelar"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
