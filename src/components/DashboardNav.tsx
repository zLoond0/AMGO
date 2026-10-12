"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const baseItem =
  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amigo-blue";

export function DashboardNav() {
  const pathname = usePathname();
  const isPanelActive = pathname === "/dashboard";

  return (
    <nav aria-label="Navegación del panel" className="flex items-center gap-1">
      <Link
        href="/dashboard"
        aria-current={isPanelActive ? "page" : undefined}
        className={`${baseItem} ${
          isPanelActive ? "bg-blue-50 text-amigo-blue" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        Panel
      </Link>
      {/* Placeholder: se habilita cuando exista la vista de reservas (HU4) */}
      <span
        aria-disabled="true"
        title="Próximamente"
        className={`${baseItem} text-gray-400 cursor-not-allowed select-none`}
      >
        Reservas
      </span>
    </nav>
  );
}
