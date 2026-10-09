"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { AmigoLogo } from "@/components/AmigoLogo";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Redirige automaticamente si ya existe una sesion activa en el navegador
    const savedToken = localStorage.getItem("amgo_token") || sessionStorage.getItem("amgo_token");
    if (savedToken) {
      router.push("/dashboard");
    }
  }, [router]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = "El correo institucional es obligatorio";
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = "Ingresa un formato de correo válido (ej. usuario@amigo.edu.co)";
      }
    }

    if (!password) {
      newErrors.password = "La contraseña es obligatoria";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGeneralError(data.message || "Credenciales incorrectas");
        setIsLoading(false);
        return;
      }

      // Almacena de forma persistente o temporal segun la preferencia del usuario
      if (rememberMe) {
        localStorage.setItem("amgo_token", data.token);
        localStorage.setItem("amgo_user", JSON.stringify(data.user));
        sessionStorage.removeItem("amgo_token");
        sessionStorage.removeItem("amgo_user");
      } else {
        sessionStorage.setItem("amgo_token", data.token);
        sessionStorage.setItem("amgo_user", JSON.stringify(data.user));
        localStorage.removeItem("amgo_token");
        localStorage.removeItem("amgo_user");
      }

      router.push("/dashboard");
    } catch {
      setGeneralError("Error de conexión con el servidor. Intente más tarde.");
      setIsLoading(false);
    }
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

          <p className="text-sm text-gray-500 font-normal mt-2 mb-7 text-center">
            Laboratorio de analítica e IA
          </p>

          {generalError && (
            <div
              role="alert"
              className="w-full mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5"
              >
                Correo institucional
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  if (generalError) setGeneralError(null);
                }}
                placeholder="nombre@amigo.edu.co"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-800 placeholder:text-gray-400 bg-white transition-all outline-none ${
                  errors.email
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                }`}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    if (generalError) setGeneralError(null);
                  }}
                  placeholder="Contraseña"
                  className={`w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm text-gray-800 placeholder:text-gray-400 bg-white transition-all outline-none ${
                    errors.password
                      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs sm:text-[13px] pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer"
                />
                <span>Recordarme</span>
              </label>

              <Link
                href="/recuperar-contrasena"
                className="text-[#3B82F6] hover:text-blue-700 hover:underline transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#85B4F2] hover:bg-[#6FA2EA] active:bg-[#5C94E5] text-white font-medium text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando credenciales...</span>
                </>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>

          <p className="text-[11px] text-gray-400 text-center mt-6 leading-relaxed max-w-[340px]">
            El rol (Docente, Coordinador o Administrador) se asigna automáticamente según tu cuenta institucional
          </p>

          <div className="mt-6 pt-4 border-t border-gray-100 w-full text-center">
            <details className="text-[11px] text-gray-400 cursor-pointer">
              <summary className="hover:text-gray-600 transition-colors">
                Ver cuentas institucionales de prueba
              </summary>
              <div className="mt-2 text-left bg-gray-50 p-2.5 rounded text-[11px] text-gray-600 space-y-1">
                <p><strong>Contraseña común:</strong> <code className="bg-gray-200 px-1 py-0.5 rounded">Password123!</code></p>
                <p>- <strong>Docente:</strong> <code className="text-blue-600">docente@amigo.edu.co</code></p>
                <p>- <strong>Coordinador:</strong> <code className="text-blue-600">coordinador@amigo.edu.co</code></p>
                <p>- <strong>Administrador:</strong> <code className="text-blue-600">admin@amigo.edu.co</code></p>
              </div>
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}
