import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMGO - Laboratorio de analítica e IA | Sistema de gestión de laboratorios",
  description: "Plataforma de inicio de sesión de laboratorios de la Universidad Católica Luis Amigó",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#FBFBFA] flex flex-col">{children}</body>
    </html>
  );
}
