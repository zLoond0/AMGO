"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AmigoLogo } from "@/components/AmigoLogo";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { validateEmailFormat } from "@/lib/validation";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Por favor ingresa tu correo institucional");
      return;
    }

    if (!validateEmailFormat(email)) {
      setError("Por favor ingresa un correo con formato válido");
      return;
    }

    setSubmitted(true);
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

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[450px] bg-white border border-[#E5E7EB] rounded-2xl p-8 sm:p-10 shadow-[0_4px_25px_rgba(0,0,0,0.03)] flex flex-col items-center">
          
          <h1 className="text-xl font-bold tracking-wider text-[#1E293B] mb-2">
            AMGO
          </h1>

          <AmigoLogo className="my-1" />

          <p className="text-sm text-gray-500 font-normal mt-2 mb-6 text-center">
            Recuperación de Contraseña
          </p>

          {submitted ? (
            <div className="w-full text-center space-y-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm text-gray-700">
                Se ha enviado un enlace de restablecimiento a:
                <br />
                <span className="font-semibold text-blue-600">{email}</span>
              </p>
              <p className="text-xs text-gray-400">
                Revisa tu bandeja de entrada o spam y sigue las instrucciones para restaurar tu contraseña.
              </p>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-[#3B82F6] hover:underline pt-4 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a Iniciar Sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
              <p className="text-xs text-gray-600 leading-relaxed text-center">
                Ingresa tu correo institucional registrado y te enviaremos las instrucciones para restablecer tu clave.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="recovery-email"
                  className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5"
                >
                  Correo institucional
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="nombre@amigo.edu.co"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-800 placeholder:text-gray-400 bg-white transition-all outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#85B4F2] hover:bg-[#6FA2EA] text-white font-medium text-sm transition-all shadow-sm"
              >
                Enviar enlace de recuperación
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
