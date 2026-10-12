"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Laptop,
  User,
  Shield,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { formatearRangoBogota } from "@/lib/config";

interface ReservaDetalle {
  id: string;
  recursoId: string;
  usuarioId: string;
  inicio: string;
  fin: string;
  tipo: string;
  estado: string;
  expiraEn: string | null;
  recurso: {
    id: string;
    nombre: string;
    descripcion?: string | null;
  };
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
  };
}

export default function ConfirmarReservaPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { id } = params;

  const [reserva, setReserva] = useState<ReservaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmadaExito, setConfirmadaExito] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);

  // 1. Cargar detalle de la retención
  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const res = await fetch(`/api/reservas/${id}`);
        if (!res.ok) {
          if (activo) {
            router.push("/dashboard/reservas?alerta=no_encontrada");
          }
          return;
        }

        const json = await res.json();
        if (activo && json.success) {
          const r: ReservaDetalle = json.reserva;

          // Si ya no está RETENIDA o ya expiró
          if (r.estado !== "RETENIDA") {
            router.push("/dashboard/reservas?alerta=no_retenida");
            return;
          }

          if (r.expiraEn && new Date(r.expiraEn).getTime() <= Date.now()) {
            router.push("/dashboard/reservas?alerta=expirada");
            return;
          }

          setReserva(r);

          if (r.expiraEn) {
            const dif = Math.max(
              0,
              Math.floor((new Date(r.expiraEn).getTime() - Date.now()) / 1000)
            );
            setSegundosRestantes(dif);
          }
        }
      } catch {
        if (activo) setErrorMensaje("Error al cargar los datos de la reserva.");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [id, router]);

  // 2. Cuenta regresiva de retención
  useEffect(() => {
    if (segundosRestantes === null || confirmadaExito) return;

    if (segundosRestantes <= 0) {
      router.push("/dashboard/reservas?alerta=expirada");
      return;
    }

    const interval = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          router.push("/dashboard/reservas?alerta=expirada");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [segundosRestantes, confirmadaExito, router]);

  const formatearTiempo = (seg: number | null) => {
    if (seg === null) return "--:--";
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 3. Confirmar la reserva
  const handleConfirmar = async () => {
    setErrorMensaje(null);
    setConfirmando(true);
    try {
      const res = await fetch(`/api/reservas/${id}/confirmar`, {
        method: "PATCH",
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setConfirmadaExito(true);
      } else {
        setErrorMensaje(
          json.message || "No fue posible confirmar la reserva. El tiempo pudo haber expirado."
        );
      }
    } catch {
      setErrorMensaje("Error de conexión al confirmar la reserva.");
    } finally {
      setConfirmando(false);
    }
  };

  // 4. Cancelar / liberar la retención
  const handleCancelar = async () => {
    setCancelando(true);
    try {
      await fetch(`/api/reservas/${id}/cancelar`, { method: "PATCH" });
    } finally {
      router.push("/dashboard/reservas");
    }
  };

  if (cargando) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-sm text-gray-500">
        Cargando detalles de la reserva...
      </div>
    );
  }

  if (!reserva) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-sm text-gray-500">
        Reserva no encontrada.
      </div>
    );
  }

  // Pantalla de Éxito tras confirmar
  if (confirmadaExito) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            ¡Reserva confirmada con éxito!
          </h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            El bloque ha quedado asignado a tu nombre. Puedes revisar los detalles en la
            sección de tus reservas.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-sm space-y-2 mt-4">
            <p>
              <strong className="text-gray-700">Recurso:</strong> {reserva.recurso.nombre}
            </p>
            <p>
              <strong className="text-gray-700">Horario:</strong>{" "}
              {formatearRangoBogota(new Date(reserva.inicio), new Date(reserva.fin))}
            </p>
            <p>
              <strong className="text-gray-700">Tipo:</strong> {reserva.tipo}
            </p>
            <p className="text-emerald-700 font-semibold">
              Costo: Sin costo (uso institucional)
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard/reservas"
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Hacer otra reserva
            </Link>
            <Link
              href="/dashboard/reservas/mis-reservas"
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Ver mis reservas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inicioDate = new Date(reserva.inicio);
  const finDate = new Date(reserva.fin);
  const horarioTexto = formatearRangoBogota(inicioDate, finDate);

  const tipoTexto =
    reserva.tipo === "CLASE"
      ? "Clase"
      : reserva.tipo === "PRACTICA"
      ? "Práctica"
      : "Investigación";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Botón Volver */}
      <Link
        href="/dashboard/reservas"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a la selección
      </Link>

      {/* Alertas */}
      {errorMensaje && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{errorMensaje}</div>
        </div>
      )}

      {/* Tarjeta de Cuenta Regresiva de Retención */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-amber-600 animate-pulse shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-900">
              Bloque retenido temporalmente
            </p>
            <p className="text-xs text-amber-700">
              Confirma tu reserva antes de que expire el tiempo límite.
            </p>
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-mono font-bold text-amber-900 bg-white border border-amber-200 px-3 py-1 rounded-lg shrink-0">
          {formatearTiempo(segundosRestantes)}
        </div>
      </div>

      {/* Tarjeta de Detalles de la Solicitud */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-5">
        <h1 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          Detalles de la reserva
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Recurso solicitado</span>
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Laptop className="w-4 h-4 text-amigo-blue shrink-0" />
              <span>{reserva.recurso.nombre}</span>
            </div>
            {reserva.recurso.descripcion && (
              <p className="text-xs text-gray-500 mt-1 pl-6">
                {reserva.recurso.descripcion}
              </p>
            )}
          </div>

          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Fecha y horario</span>
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Calendar className="w-4 h-4 text-amigo-blue shrink-0" />
              <span>{horarioTexto}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Duración</span>
            <span className="font-medium text-gray-800">2 horas</span>
          </div>

          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Tipo de uso</span>
            <span className="font-medium text-gray-800">{tipoTexto}</span>
          </div>

          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Solicitante</span>
            <div className="flex items-center gap-1.5 font-medium text-gray-800">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span>{reserva.usuario.nombre}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Rol institucional</span>
            <div className="flex items-center gap-1.5 font-medium text-gray-800">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <span>{reserva.usuario.rol}</span>
            </div>
          </div>
        </div>

        {/* Línea explícita de costo según ADENDA 2 */}
        <div className="pt-4 border-t border-gray-100 bg-blue-50/50 -mx-6 -mb-6 p-6 rounded-b-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Costo del servicio:</span>
            <span className="text-sm font-bold text-blue-900">
              Sin costo (uso institucional)
            </span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleCancelar}
          disabled={confirmando || cancelando}
          className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300 disabled:opacity-50"
        >
          {cancelando ? "Cancelando..." : "Cancelar"}
        </button>

        <button
          type="button"
          onClick={handleConfirmar}
          disabled={confirmando || cancelando}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-xs transition-colors disabled:bg-gray-400 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          {confirmando ? "Confirmando..." : "Confirmar reserva"}
        </button>
      </div>
    </div>
  );
}
