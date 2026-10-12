"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Clock,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { UserPayload } from "@/lib/types";

interface DashboardSidebarProps {
  user: UserPayload;
}

function getIniciales(nombre: string): string {
  const limpio = nombre.replace(/^(Prof\.|Dra\.|Dr\.|Ing\.|Lic\.)\s+/i, "");
  const partes = limpio.trim().split(/\s+/);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
  return (partes[0]?.[0] || "U").toUpperCase();
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      label: "Inicio",
      href: "/dashboard",
      icon: Home,
      isActive: pathname === "/dashboard",
    },
    {
      label: "Disponibilidad",
      href: "/dashboard/reservas",
      icon: Calendar,
      isActive:
        pathname.startsWith("/dashboard/reservas") &&
        !pathname.startsWith("/dashboard/reservas/mis-reservas"),
    },
    {
      label: "Mis reservas",
      href: "/dashboard/reservas/mis-reservas",
      icon: Clock,
      isActive: pathname.startsWith("/dashboard/reservas/mis-reservas"),
    },
  ];

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  const iniciales = getIniciales(user.nombre);

  return (
    <>
      {/* Barra superior móvil para alternar el menú en pantallas < 768px */}
      <div className="md:hidden w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <span className="text-sm font-bold text-gray-800">Menú AMGO</span>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú de navegación"}
          className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amigo-blue"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Desktop y Drawer Móvil */}
      <aside
        className={`
          ${mobileOpen ? "block" : "hidden"} md:block
          w-full md:w-64 bg-white border-r border-gray-200 shrink-0 flex flex-col justify-between
          md:min-h-[calc(100vh-45px)] p-4
        `}
      >
        <div className="space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-3 block mb-2">
              Navegación
            </span>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={item.isActive ? "page" : undefined}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-amigo-blue
                      ${
                        item.isActive
                          ? "bg-orange-100 text-orange-950 font-bold border-l-4 border-orange-500 shadow-2xs"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium"
                      }
                    `}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        item.isActive ? "text-orange-600" : "text-gray-400"
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tarjeta de usuario en la parte inferior */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-700 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
              {iniciales}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate" title={user.nombre}>
                {user.nombre}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">{user.rol}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-rose-700 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
