"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

export function Breadcrumb() {
  const pathname = usePathname();

  const getBreadcrumbs = () => {
    if (pathname === "/dashboard") {
      return [{ label: "Inicio", href: "/dashboard", isCurrent: true }];
    }
    if (pathname === "/dashboard/reservas") {
      return [
        { label: "Inicio", href: "/dashboard", isCurrent: false },
        { label: "Disponibilidad", href: "/dashboard/reservas", isCurrent: true },
      ];
    }
    if (pathname.startsWith("/dashboard/reservas/confirmar")) {
      return [
        { label: "Inicio", href: "/dashboard", isCurrent: false },
        { label: "Disponibilidad", href: "/dashboard/reservas", isCurrent: false },
        { label: "Confirmación", href: pathname, isCurrent: true },
      ];
    }
    if (pathname.startsWith("/dashboard/reservas/mis-reservas")) {
      return [
        { label: "Inicio", href: "/dashboard", isCurrent: false },
        { label: "Mis reservas", href: "/dashboard/reservas/mis-reservas", isCurrent: true },
      ];
    }
    return [{ label: "Inicio", href: "/dashboard", isCurrent: true }];
  };

  const items = getBreadcrumbs();

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center">
              {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400 mx-1.5 shrink-0" />}
              {isLast ? (
                <span className="font-semibold text-gray-800" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-amigo-blue hover:underline transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
