import React from "react";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

export type BadgeEstado = "CONFIRMADA" | "PENDIENTE" | "CANCELADA" | "RETENIDA" | "EXPIRADA";

interface EstadoBadgeProps {
  estado: BadgeEstado | string;
  className?: string;
}

/**
 * Componente visual para los badges de estado según el prototipo de la HU4:
 * - Confirmada: verde
 * - Pendiente: amarillo (listo para usarse cuando se integre el flujo de aprobación)
 * - Cancelada: rojo
 * - Retenida / En proceso: ámbar / azul informativo
 */
export function EstadoBadge({ estado, className = "" }: EstadoBadgeProps) {
  const norm = estado.toUpperCase();

  switch (norm) {
    case "CONFIRMADA":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Confirmada
        </span>
      );

    case "PENDIENTE":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${className}`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Pendiente
        </span>
      );

    case "CANCELADA":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 ${className}`}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          Cancelada
        </span>
      );

    case "RETENIDA":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          En proceso
        </span>
      );

    case "EXPIRADA":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 ${className}`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-gray-500" />
          Expirada
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 ${className}`}
        >
          {estado}
        </span>
      );
  }
}
