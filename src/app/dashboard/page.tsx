"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AmigoLogo } from "@/components/AmigoLogo";
import { LogOut, User, ShieldCheck, CheckCircle2 } from "lucide-react";

import type { UserData } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<string>("");

  useEffect(() => {
    // Recupera la sesion desde el almacenamiento persistente o de sesion
    const localToken = localStorage.getItem("amgo_token");
    const localUser = localStorage.getItem("amgo_user");
    const sessionToken = sessionStorage.getItem("amgo_token");
    const sessionUser = sessionStorage.getItem("amgo_user");

    if (localToken && localUser) {
      setToken(localToken);
      setUser(JSON.parse(localUser));
      setStorageType("localStorage (Recordarme activado - sesión persistente)");
    } else if (sessionToken && sessionUser) {
      setToken(sessionToken);
      setUser(JSON.parse(sessionUser));
      setStorageType("sessionStorage (Sesión temporal)");
    } else {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    // Limpia ambos almacenamientos y revoca la cookie de sesion
    localStorage.removeItem("amgo_token");
    localStorage.removeItem("amgo_user");
    sessionStorage.removeItem("amgo_token");
    sessionStorage.removeItem("amgo_user");
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBFA]">
        <div className="text-gray-500 text-sm">Verificando sesión...</div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    Docente: "bg-emerald-100 text-emerald-800 border-emerald-300",
    Coordinador: "bg-indigo-100 text-indigo-800 border-indigo-300",
    Administrador: "bg-amber-100 text-amber-800 border-amber-300",
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBFBFA]">
      <header className="w-full bg-[#4A85F6] text-white px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm select-none shadow-sm">
        <span className="font-normal tracking-wide">
          Instituto - Sistema de gestión de laboratorios
        </span>
        <span className="font-normal tracking-wide">
          Facultad de Ingeniería
        </span>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AmigoLogo className="w-16" />
            <div>
              <div className="flex items-center gap-2">
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

          <button
            onClick={handleLogout}
            className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-purple-600">
              <CheckCircle2 className="w-5 h-5" />
              <h2 className="font-semibold text-gray-800">Estado del Token JWT</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400 block text-xs">Modo de almacenamiento:</span>
                <span className="text-xs font-medium text-gray-700 block">{storageType}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs mt-2">Token JWT (Sesión activa):</span>
                <div className="mt-1 bg-gray-50 p-2 rounded text-[11px] font-mono text-gray-600 truncate">
                  {token}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
