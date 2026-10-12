import React from "react";
import { redirect } from "next/navigation";
import { AmigoLogo } from "@/components/AmigoLogo";
import { User, ShieldCheck, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/session";

const roleColors: Record<string, string> = {
  Docente: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Coordinador: "bg-indigo-100 text-indigo-800 border-indigo-300",
  Administrador: "bg-amber-100 text-amber-800 border-amber-300",
};

export default function DashboardPage() {
  // El layout ya valido la sesion, pero no se re-ejecuta en navegacion suave: se verifica de nuevo
  const user = getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6 flex items-center gap-4">
        <AmigoLogo className="w-16" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              Panel Principal de Laboratorios
            </h1>
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sesión iniciada
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Laboratorio de Analítica e Inteligencia Artificial (AMGO)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-blue-600">
            <User className="w-5 h-5" />
            <h2 className="font-semibold text-gray-800">Usuario Autenticado</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400 block text-xs">Nombre:</span>
              <span className="font-medium text-gray-800">{user.nombre}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-xs">Correo institucional:</span>
              <span className="text-gray-800">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="font-semibold text-gray-800">Rol Institucional</h2>
          </div>
          <div className="space-y-2 text-sm">
            <span className="text-gray-400 block text-xs">Rol asignado automáticamente:</span>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                roleColors[user.rol] || "bg-gray-100 text-gray-800"
              }`}
            >
              {user.rol}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              Permisos asignados según la cuenta institucional universitaria.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
