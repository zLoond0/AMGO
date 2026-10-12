import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Breadcrumb } from "@/components/Breadcrumb";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Proteccion en el servidor: sin cookie valida no se renderiza nada del panel
  const user = getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-amigo-bg">
      <AppHeader />

      <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto">
        <DashboardSidebar user={user} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          <Breadcrumb />
          {children}
        </main>
      </div>
    </div>
  );
}
