import React from "react";

// Barra institucional superior compartida por login, recuperacion de contrasena y dashboard.
export function AppHeader() {
  return (
    <header className="w-full bg-amigo-blue text-white px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm select-none shadow-sm">
      <span className="font-normal tracking-wide">
        Instituto - Sistema de gestión de laboratorios
      </span>
      <span className="font-normal tracking-wide">
        Facultad de Ingeniería
      </span>
    </header>
  );
}
