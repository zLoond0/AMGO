import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DashboardNav } from "@/components/DashboardNav";
import { LogoutButton } from "@/components/LogoutButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Proteccion en el servidor: sin cookie valida no se renderiza nada del panel
  const user = getCurrentUser();
  if (!user) {
    redirect("/login");
  }

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

      <div className="w-full bg-white border-b border-gray-200">
        <div className="max-w-5xl w-full mx-auto px-6 sm:px-8 py-2 flex items-center justify-between gap-4">
          <DashboardNav />
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray-600">{user.nombre}</span>
            <LogoutButton />
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-8">{children}</main>
    </div>
  );
}
