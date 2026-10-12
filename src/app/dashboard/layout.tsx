import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DashboardNav } from "@/components/DashboardNav";
import { LogoutButton } from "@/components/LogoutButton";
import { AppHeader } from "@/components/AppHeader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Proteccion en el servidor: sin cookie valida no se renderiza nada del panel
  const user = getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-amigo-bg">
      <AppHeader />

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
