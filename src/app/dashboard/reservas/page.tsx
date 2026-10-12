"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertCircle,
  CheckCircle2,
  Clock,
  Laptop,
} from "lucide-react";
import { EstadoBadge } from "@/components/EstadoBadge";
import {
  BLOQUES,
  ANTICIPACION_MAXIMA_DIAS,
  normalizarSemanaBogota,
  crearFechaBogota,
  formatearRangoBogota,
} from "@/lib/config";
import type { EstadoBloqueDisponibilidad } from "@/lib/types";

interface RecursoItem {
  id: string;
  nombre: string;
  descripcion?: string | null;
}

interface BloqueApi {
  inicio: string;
  fin: string;
  inicioIso: string;
  finIso: string;
  estado: EstadoBloqueDisponibilidad;
}

interface DiaApi {
  fecha: string;
  bloques: BloqueApi[];
}

interface SemanaResponse {
  semana: {
    lunes: string;
    viernes: string;
  };
  dias: DiaApi[];
}

interface ProximaReserva {
  id: string;
  inicio: string;
  fin: string;
  tipo: string;
  estado: string;
  recurso: {
    id: string;
    nombre: string;
  };
}

export default function ReservasPage() {
  const router = useRouter();

  // Estados principales
  const [recursos, setRecursos] = useState<RecursoItem[]>([]);
  const [recursoId, setRecursoId] = useState<string>("");
  const [semanaRef, setSemanaRef] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [disponibilidad, setDisponibilidad] = useState<SemanaResponse | null>(null);
  const [proximasReservas, setProximasReservas] = useState<ProximaReserva[]>([]);

  // Selección compartida entre grilla y formulario
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>("");
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<string>("");
  const [tipoUso, setTipoUso] = useState<string>("CLASE");

  // Estados de interfaz y feedback
  const [cargandoRecursos, setCargandoRecursos] = useState(true);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeAlerta, setMensajeAlerta] = useState<string | null>(null);

  // Límites para navegación de fechas
  const hoyStr = new Date().toISOString().slice(0, 10);
  const maxFuturoDate = new Date(Date.now() + ANTICIPACION_MAXIMA_DIAS * 24 * 60 * 60 * 1000);
  const maxFuturoStr = maxFuturoDate.toISOString().slice(0, 10);

  // 1. Cargar lista de recursos
  useEffect(() => {
    let activo = true;
    async function cargarRecursos() {
      try {
        setCargandoRecursos(true);
        const res = await fetch("/api/recursos");
        if (!res.ok) throw new Error("Error al obtener recursos");
        const json = await res.json();
        if (activo && json.success && json.recursos.length > 0) {
          setRecursos(json.recursos);
          setRecursoId(json.recursos[0].id);
        }
      } catch (err) {
        if (activo) setMensajeError("No fue posible cargar los recursos disponibles.");
      } finally {
        if (activo) setCargandoRecursos(false);
      }
    }
    cargarRecursos();
    return () => {
      activo = false;
    };
  }, []);

  // 2. Función para consultar disponibilidad
  const consultarDisponibilidad = useCallback(
    async (signal?: AbortSignal) => {
      if (!recursoId || !semanaRef) return;
      try {
        const url = `/api/reservas/disponibilidad?recursoId=${encodeURIComponent(
          recursoId
        )}&semana=${encodeURIComponent(semanaRef)}`;
        const res = await fetch(url, { signal });
        if (!res.ok) return;
        const data: { success: boolean } & SemanaResponse = await res.json();

        if (data.success) {
          setDisponibilidad(data);

          // Verificar si el bloque seleccionado sigue disponible
          if (fechaSeleccionada && bloqueSeleccionado) {
            const diaMatch = data.dias.find((d) => d.fecha === fechaSeleccionada);
            const bloqueMatch = diaMatch?.bloques.find((b) => b.inicio === bloqueSeleccionado);

            if (
              bloqueMatch &&
              bloqueMatch.estado !== "disponible" &&
              bloqueMatch.estado !== "tu_retencion"
            ) {
              setFechaSeleccionada("");
              setBloqueSeleccionado("");
              setMensajeAlerta(
                "El bloque que habías seleccionado ya no está disponible (ha sido reservado o retenido)."
              );
            }
          }
        }
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") {
          console.error("Error al refrescar disponibilidad:", e);
        }
      }
    },
    [recursoId, semanaRef, fechaSeleccionada, bloqueSeleccionado]
  );

  // 3. Cargar disponibilidad al cambiar recurso o semana
  useEffect(() => {
    if (!recursoId) return;
    setCargandoDisponibilidad(true);
    const controller = new AbortController();
    consultarDisponibilidad(controller.signal).finally(() => {
      setCargandoDisponibilidad(false);
    });
    return () => controller.abort();
  }, [recursoId, semanaRef, consultarDisponibilidad]);

  // 4. Casi tiempo real (CA5): Polling cada 10 s mientras la pestaña esté visible
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let abortCtrl: AbortController | null = null;

    function ejecutarPolling() {
      if (document.visibilityState === "visible") {
        abortCtrl = new AbortController();
        consultarDisponibilidad(abortCtrl.signal);
      }
    }

    // Inicia intervalo de 10 segundos
    timer = setInterval(ejecutarPolling, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ejecutarPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      if (abortCtrl) abortCtrl.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [consultarDisponibilidad]);

  // 5. Cargar "Mis próximas reservas"
  const cargarProximasReservas = useCallback(async () => {
    try {
      const res = await fetch("/api/reservas?alcance=mias&desde=ahora&limite=6");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setProximasReservas(json.reservas);
        }
      }
    } catch {
      // Silencioso en fondo
    }
  }, []);

  useEffect(() => {
    cargarProximasReservas();
  }, [cargarProximasReservas]);

  // Navegación de semanas
  const handleSemanaAnterior = () => {
    const curLunes = disponibilidad?.semana.lunes ?? semanaRef;
    const curDate = new Date(`${curLunes}T12:00:00-05:00`);
    const nuevaDate = new Date(curDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    setSemanaRef(nuevaDate.toISOString().slice(0, 10));
  };

  const handleSemanaSiguiente = () => {
    const curLunes = disponibilidad?.semana.lunes ?? semanaRef;
    const curDate = new Date(`${curLunes}T12:00:00-05:00`);
    const nuevaDate = new Date(curDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    setSemanaRef(nuevaDate.toISOString().slice(0, 10));
  };

  // Deshabilitar flechas de semana si se salen de los rangos
  const semLunes = disponibilidad?.semana.lunes;
  const semViernes = disponibilidad?.semana.viernes;

  const esSemanaActualOAnterior = semLunes ? semLunes <= hoyStr : false;
  const esSemanaMaximaFutura = semViernes ? semViernes >= maxFuturoStr : false;

  // Manejo de clic en celda de la grilla
  const handleSeleccionarCelda = (fecha: string, inicio: string, estado: EstadoBloqueDisponibilidad) => {
    setMensajeError(null);
    setMensajeAlerta(null);

    if (estado !== "disponible" && estado !== "tu_retencion") {
      return;
    }

    if (fechaSeleccionada === fecha && bloqueSeleccionado === inicio) {
      // Deseleccionar
      setFechaSeleccionada("");
      setBloqueSeleccionado("");
    } else {
      setFechaSeleccionada(fecha);
      setBloqueSeleccionado(inicio);
    }
  };

  // Manejo de cambio de fecha en el formulario
  const handleCambioFechaForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFecha = e.target.value;
    setMensajeError(null);
    if (!nuevaFecha) {
      setFechaSeleccionada("");
      return;
    }

    // Validar fin de semana (Bogotá)
    const fechaObj = new Date(`${nuevaFecha}T12:00:00-05:00`);
    const diaSemana = fechaObj.getDay(); // 0 = Dom, 6 = Sab
    if (diaSemana === 0 || diaSemana === 6) {
      setMensajeError("Solo se puede reservar de lunes a viernes.");
      return;
    }

    setFechaSeleccionada(nuevaFecha);
    // Si la fecha elegida está fuera de la semana visible, mover la grilla a esa semana
    if (
      !disponibilidad ||
      nuevaFecha < disponibilidad.semana.lunes ||
      nuevaFecha > disponibilidad.semana.viernes
    ) {
      setSemanaRef(nuevaFecha);
    }
  };

  // Enviar formulario (crear retención)
  const handleSubmitSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeAlerta(null);

    if (!recursoId) {
      setMensajeError("Por favor selecciona un recurso.");
      return;
    }
    if (!fechaSeleccionada) {
      setMensajeError("Por favor selecciona una fecha.");
      return;
    }
    if (!bloqueSeleccionado) {
      setMensajeError("Por favor selecciona un horario disponible.");
      return;
    }

    const inicioIso = crearFechaBogota(fechaSeleccionada, bloqueSeleccionado).toISOString();

    setEnviandoSolicitud(true);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recursoId,
          inicio: inicioIso,
          tipo: tipoUso,
        }),
      });

      const json = await res.json();

      if (res.status === 201 && json.success) {
        // Retención creada con éxito -> Navegar a confirmación
        router.push(`/dashboard/reservas/confirmar/${json.reserva.id}`);
      } else if (res.status === 409) {
        // Conflicto de retención o bloque ocupado
        setMensajeAlerta(
          json.message ||
            "El bloque ya no se encuentra disponible. Por favor elige otro horario."
        );
        consultarDisponibilidad();
      } else {
        setMensajeError(json.message || "No se pudo procesar la solicitud de reserva.");
      }
    } catch {
      setMensajeError("Error de conexión al solicitar la reserva.");
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Formato para encabezado de columnas (p. ej. "Lun 5")
  const formatearEncabezadoDia = (fechaStr: string) => {
    const d = new Date(`${fechaStr}T12:00:00-05:00`);
    const diaNum = d.getDate();
    const nombresDias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return `${nombresDias[d.getDay()]} ${diaNum}`;
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Disponibilidad esta semana
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecciona un bloque para solicitar una reserva
        </p>
      </div>

      {/* Alertas y Banners */}
      {mensajeError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{mensajeError}</div>
        </div>
      )}

      {mensajeAlerta && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 shadow-xs"
        >
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{mensajeAlerta}</div>
        </div>
      )}

      {/* Grid Principal: Grilla Semanal (izquierda) y Formulario (derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda / Central: Grilla Semanal */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amigo-blue" />
              <span className="font-semibold text-gray-800 text-sm sm:text-base">
                {disponibilidad
                  ? `Semana del ${disponibilidad.semana.lunes} al ${disponibilidad.semana.viernes}`
                  : "Cargando semana..."}
              </span>
            </div>

            {/* Navegación entre semanas */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSemanaAnterior}
                disabled={esSemanaActualOAnterior}
                aria-label="Semana anterior"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSemanaSiguiente}
                disabled={esSemanaMaximaFutura}
                aria-label="Semana siguiente"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabla de la Grilla Semanal (scroll horizontal en pantallas estrechas) */}
          <div className="overflow-x-auto pb-2">
            <table className="w-full border-collapse min-w-[500px]">
              <thead>
                <tr>
                  <th className="py-2.5 px-2 text-left text-xs font-semibold text-gray-500 w-24">
                    Horario
                  </th>
                  {disponibilidad?.dias.map((d) => (
                    <th
                      key={d.fecha}
                      className="py-2.5 px-2 text-center text-xs font-semibold text-gray-700 border-b border-gray-200"
                    >
                      {formatearEncabezadoDia(d.fecha)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BLOQUES.map((bloque) => (
                  <tr key={bloque.inicio} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 px-2 text-xs font-medium text-gray-600 whitespace-nowrap align-middle">
                      {bloque.inicio} - {bloque.fin}
                    </td>

                    {disponibilidad?.dias.map((dia) => {
                      const bloqueApi = dia.bloques.find((b) => b.inicio === bloque.inicio);
                      const estado: EstadoBloqueDisponibilidad = bloqueApi?.estado ?? "disponible";
                      const esSeleccionado =
                        fechaSeleccionada === dia.fecha &&
                        bloqueSeleccionado === bloque.inicio;

                      // Definición exacta de estilos según ADENDA 2:
                      // Disponible: azul claro
                      // Ocupado: rojo suave
                      // Seleccionado: naranja suave con borde azul
                      // En proceso: rojo más claro con borde punteado
                      // Pasado: gris deshabilitado
                      let btnClasses = "";
                      let textoEstado = "";

                      if (esSeleccionado) {
                        btnClasses =
                          "bg-orange-100 text-orange-900 border-2 border-blue-600 ring-2 ring-blue-300 font-bold shadow-xs";
                        textoEstado = "Seleccionado";
                      } else {
                        switch (estado) {
                          case "disponible":
                            btnClasses =
                              "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer";
                            textoEstado = "Disponible";
                            break;
                          case "ocupada":
                            btnClasses =
                              "bg-red-50 text-red-700 border border-red-200 cursor-not-allowed opacity-90";
                            textoEstado = "Ocupado";
                            break;
                          case "tu_retencion":
                            btnClasses =
                              "bg-blue-100 text-blue-900 border border-blue-300 font-semibold cursor-pointer";
                            textoEstado = "Tu reserva";
                            break;
                          case "retenida":
                            btnClasses =
                              "bg-red-50/70 text-red-600 border border-dashed border-red-300 cursor-not-allowed";
                            textoEstado = "En proceso";
                            break;
                          case "pasada":
                          case "fuera_de_rango":
                            btnClasses =
                              "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed";
                            textoEstado = "Pasado";
                            break;
                        }
                      }

                      return (
                        <td key={dia.fecha} className="p-1.5 text-center align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              handleSeleccionarCelda(dia.fecha, bloque.inicio, estado)
                            }
                            disabled={
                              estado === "ocupada" ||
                              estado === "retenida" ||
                              estado === "pasada" ||
                              estado === "fuera_de_rango"
                            }
                            aria-pressed={esSeleccionado}
                            className={`
                              w-full py-2.5 px-2 rounded-lg text-xs font-medium transition-all text-center
                              focus:outline-none focus-visible:ring-2 focus-visible:ring-amigo-blue
                              ${btnClasses}
                            `}
                          >
                            {textoEstado}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Leyenda con los MISMOS colores reales de la grilla */}
          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">Leyenda:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-blue-50 border border-blue-200 inline-block" />
              <span>Disponible</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-red-50 border border-red-200 inline-block" />
              <span>Ocupado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-orange-100 border-2 border-blue-600 inline-block" />
              <span>Seleccionado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-red-50/70 border border-dashed border-red-300 inline-block" />
              <span>En proceso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-gray-100 border border-gray-200 inline-block" />
              <span>Pasado</span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Formulario "Solicitar reserva" */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          <h2 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Solicitar reserva
          </h2>

          <form onSubmit={handleSubmitSolicitud} className="space-y-4">
            {/* Selector de Recurso */}
            <div>
              <label
                htmlFor="recurso-select"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Recurso
              </label>
              <select
                id="recurso-select"
                value={recursoId}
                onChange={(e) => {
                  setRecursoId(e.target.value);
                  setFechaSeleccionada("");
                  setBloqueSeleccionado("");
                }}
                disabled={cargandoRecursos}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amigo-blue"
              >
                {recursos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Input nativo de Fecha */}
            <div>
              <label
                htmlFor="fecha-input"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Fecha
              </label>
              <input
                id="fecha-input"
                type="date"
                min={hoyStr}
                max={maxFuturoStr}
                value={fechaSeleccionada}
                onChange={handleCambioFechaForm}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amigo-blue"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Lunes a viernes (máx. 30 días)
              </span>
            </div>

            {/* Selector de Horario */}
            <div>
              <label
                htmlFor="horario-select"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Horario
              </label>
              <select
                id="horario-select"
                value={bloqueSeleccionado}
                onChange={(e) => setBloqueSeleccionado(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amigo-blue"
              >
                <option value="">-- Selecciona un bloque --</option>
                {BLOQUES.map((b) => {
                  // Determinar estado de este bloque en la fecha seleccionada
                  let motivoDeshabilitado = "";
                  let deshabilitado = false;

                  if (fechaSeleccionada && disponibilidad) {
                    const diaEncontrado = disponibilidad.dias.find(
                      (d) => d.fecha === fechaSeleccionada
                    );
                    const bApi = diaEncontrado?.bloques.find((bl) => bl.inicio === b.inicio);
                    if (bApi) {
                      if (bApi.estado === "ocupada") {
                        deshabilitado = true;
                        motivoDeshabilitado = " (Ocupado)";
                      } else if (bApi.estado === "retenida") {
                        deshabilitado = true;
                        motivoDeshabilitado = " (En proceso)";
                      } else if (
                        bApi.estado === "pasada" ||
                        bApi.estado === "fuera_de_rango"
                      ) {
                        deshabilitado = true;
                        motivoDeshabilitado = " (No disponible)";
                      }
                    }
                  }

                  return (
                    <option
                      key={b.inicio}
                      value={b.inicio}
                      disabled={deshabilitado}
                    >
                      {b.inicio} - {b.fin}
                      {motivoDeshabilitado}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selector de Tipo de Uso (por defecto Clase) */}
            <div>
              <label
                htmlFor="tipo-select"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Tipo de uso
              </label>
              <select
                id="tipo-select"
                value={tipoUso}
                onChange={(e) => setTipoUso(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amigo-blue"
              >
                <option value="CLASE">Clase</option>
                <option value="PRACTICA">Práctica</option>
                <option value="INVESTIGACION">Investigación</option>
              </select>
            </div>

            {/* Botón oscuro "Enviar solicitud" */}
            <button
              type="submit"
              disabled={enviandoSolicitud || !fechaSeleccionada || !bloqueSeleccionado}
              className="w-full py-2.5 px-4 bg-gray-900 text-white font-semibold text-sm rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-xs flex items-center justify-center gap-2 mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {enviandoSolicitud ? "Enviando..." : "Enviar solicitud"}
            </button>
          </form>
        </div>
      </div>

      {/* Sección "Mis próximas reservas" */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Mis próximas reservas</h2>

        {proximasReservas.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500 shadow-2xs">
            Aún no tienes reservas próximas
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proximasReservas.map((reserva) => {
              const inicioDate = new Date(reserva.inicio);
              const finDate = new Date(reserva.fin);
              const rangoLegible = formatearRangoBogota(inicioDate, finDate);

              const tipoTexto =
                reserva.tipo === "CLASE"
                  ? "Clase"
                  : reserva.tipo === "PRACTICA"
                  ? "Práctica"
                  : "Investigación";

              return (
                <div
                  key={reserva.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-amigo-blue">
                      <Laptop className="w-4 h-4 shrink-0" />
                      <h3 className="font-semibold text-sm text-gray-800 line-clamp-1">
                        {reserva.recurso.nombre}
                      </h3>
                    </div>
                    <EstadoBadge estado={reserva.estado} />
                  </div>

                  <div className="text-xs text-gray-600 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium text-gray-800">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {rangoLegible}
                    </p>
                    <p className="text-gray-500 pl-5">Tipo: {tipoTexto}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
