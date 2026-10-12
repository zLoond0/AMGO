// Configuración centralizada de reglas de negocio para reservas (ADENDA 2)
// Todo en UN solo archivo para ajuste directo por el equipo del laboratorio.

export const TIMEZONE = "America/Bogota";
export const HOLD_MINUTOS = 5;
export const ANTICIPACION_MAXIMA_DIAS = 30;

// Días de operación: 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes
export const DIAS_OPERACION = [1, 2, 3, 4, 5] as const;

export interface BloqueConfig {
  readonly inicio: string; // Formato "HH:mm" (24 horas)
  readonly fin: string; // Formato "HH:mm" (24 horas)
}

// Bloques fijos de 2 horas (hora de Bogotá)
export const BLOQUES: readonly BloqueConfig[] = [
  { inicio: "08:00", fin: "10:00" },
  { inicio: "10:00", fin: "12:00" },
  { inicio: "14:00", fin: "16:00" },
] as const;

export interface BogotaDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  dateString: string; // "YYYY-MM-DD"
  timeString: string; // "HH:mm"
}

/**
 * Descompone una fecha en sus componentes de calendario y reloj en hora de Bogotá (America/Bogota, UTC-5).
 */
export function obtenerComponentesBogota(date: Date): BogotaDateParts {
  // Bogotá siempre está en UTC-5 sin horario de verano
  // Usamos Intl con en-CA ("YYYY-MM-DD") y hour12: false para máxima compatibilidad
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const formatted = formatter.format(date); // Formato típico: "YYYY-MM-DD, HH:mm:ss"
  const [datePart, timePart] = formatted.split(", ");
  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const [hourStr, minStr, secStr] = timePart.split(":");

  // Para el día de la semana (0 = Domingo .. 6 = Sábado)
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  });
  const wdShort = weekdayFormatter.format(date);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const hour = parseInt(hourStr, 10) === 24 ? 0 : parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = parseInt(secStr, 10);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
    hour,
    minute,
    second,
    dayOfWeek: weekdayMap[wdShort] ?? 0,
    dateString: `${yearStr}-${monthStr}-${dayStr}`,
    timeString: `${pad(hour)}:${pad(minute)}`,
  };
}

/**
 * Crea un objeto Date correspondiente a una fecha y hora local de Bogotá.
 * @param fechaYMD Formato "YYYY-MM-DD"
 * @param horaHM Formato "HH:mm"
 */
export function crearFechaBogota(fechaYMD: string, horaHMS: string): Date {
  const parts = horaHMS.split(":");
  const h = (parts[0] || "00").padStart(2, "0");
  const m = (parts[1] || "00").padStart(2, "0");
  const s = (parts[2] || "00").padStart(2, "0");
  return new Date(`${fechaYMD}T${h}:${m}:${s}.000-05:00`);
}

export type ValidacionInicioResultado =
  | {
      valido: true;
      inicio: Date;
      fin: Date;
      bloque: BloqueConfig;
    }
  | {
      valido: false;
      error: string;
    };

/**
 * Valida que una fecha y hora de inicio cumpla con las reglas de negocio de la HU4:
 * 1. Fecha parseable.
 * 2. Día de operación: lunes a viernes en hora de Bogotá.
 * 3. Minutos en 00 y coincidencia EXACTA con el inicio de un bloque configurado en BLOQUES.
 * 4. No estar en el pasado ni en un bloque que ya haya empezado.
 * 5. No superar los 30 días de anticipación máxima.
 *
 * El servidor deriva automáticamente la fecha de fin del bloque; el cliente no la envía.
 */
export function validarInicioReserva(
  inicioInput: Date | string,
  ahoraInput?: Date
): ValidacionInicioResultado {
  const inicio =
    inicioInput instanceof Date ? inicioInput : new Date(inicioInput);

  if (isNaN(inicio.getTime())) {
    return { valido: false, error: "Fecha de inicio inválida" };
  }

  const parts = obtenerComponentesBogota(inicio);

  // 1. Día de la semana (1 = Lunes .. 5 = Viernes)
  if (parts.dayOfWeek === 0 || parts.dayOfWeek === 6) {
    return {
      valido: false,
      error: "Solo se puede reservar de lunes a viernes",
    };
  }

  // 2. Coincidencia de bloque exacto (0 segundos y hora en BLOQUES)
  if (parts.second !== 0) {
    return {
      valido: false,
      error: "La hora de inicio no coincide con ningún bloque configurado",
    };
  }

  const bloque = BLOQUES.find((b) => b.inicio === parts.timeString);
  if (!bloque) {
    return {
      valido: false,
      error:
        "La hora de inicio debe coincidir con un bloque configurado (08:00, 10:00 o 14:00)",
    };
  }

  // 3. Derivar la fecha de fin a partir del bloque configurado
  const fin = crearFechaBogota(parts.dateString, bloque.fin);

  // 4. Verificación de tiempo: no estar en el pasado o que ya haya comenzado
  const ahora = ahoraInput ?? new Date();
  if (inicio.getTime() <= ahora.getTime()) {
    return {
      valido: false,
      error:
        "No se puede reservar un bloque en el pasado o que ya haya comenzado",
    };
  }

  // 5. Anticipación máxima: máximo 30 días desde ahora
  const maximoFuturoMs =
    ahora.getTime() + ANTICIPACION_MAXIMA_DIAS * 24 * 60 * 60 * 1000;
  if (inicio.getTime() > maximoFuturoMs) {
    return {
      valido: false,
      error: `No se puede reservar con más de ${ANTICIPACION_MAXIMA_DIAS} días de anticipación`,
    };
  }

  return {
    valido: true,
    inicio,
    fin,
    bloque,
  };
}

/**
 * Normaliza cualquier fecha a la semana correspondiente (lunes a viernes) en el calendario de Bogotá.
 * Retorna los strings YYYY-MM-DD del lunes y viernes de esa semana.
 */
export function normalizarSemanaBogota(fechaReferencia: Date | string): {
  lunes: string;
  viernes: string;
  dias: string[]; // 5 elementos: [lunes, martes, miercoles, jueves, viernes] en formato "YYYY-MM-DD"
} {
  const d =
    fechaReferencia instanceof Date
      ? fechaReferencia
      : new Date(
          fechaReferencia.includes("T")
            ? fechaReferencia
            : `${fechaReferencia}T12:00:00-05:00`
        );

  if (isNaN(d.getTime())) {
    throw new Error("Fecha de referencia inválida");
  }

  const parts = obtenerComponentesBogota(d);
  // En JS: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  // Cuántos días restar para llegar al lunes:
  // Si es Sunday (0), la semana laboral de ese domingo suele considerarse el lunes siguiente o anterior;
  // siguiendo estándar ISO-8601 lunes es día 1, domingo día 7 -> diff = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
  const diffToMonday = parts.dayOfWeek === 0 ? -6 : 1 - parts.dayOfWeek;

  // Creamos la fecha del lunes al mediodía Bogotá para evitar problemas de límites
  const refTime = crearFechaBogota(parts.dateString, "12:00").getTime();
  const lunesTime = refTime + diffToMonday * 24 * 60 * 60 * 1000;

  const dias: string[] = [];
  for (let i = 0; i < 5; i++) {
    const diaTime = new Date(lunesTime + i * 24 * 60 * 60 * 1000);
    const p = obtenerComponentesBogota(diaTime);
    dias.push(p.dateString);
  }

  return {
    lunes: dias[0],
    viernes: dias[4],
    dias,
  };
}

/**
 * Formatea una fecha y hora en español amigable para la interfaz de usuario en hora de Bogotá.
 * Ejemplo: "Miércoles 3 de sep · 10:00 - 12:00"
 */
export function formatearRangoBogota(inicio: Date, fin: Date): string {
  const formatterFecha = new Intl.DateTimeFormat("es-CO", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const fechaTexto = formatterFecha.format(inicio);
  // Capitaliza la primera letra: "miércoles, 3 de sep." -> "Miércoles 3 de sep"
  const fechaLimpia = fechaTexto
    .replace(".", "")
    .replace(",", "")
    .replace(/^./, (c) => c.toUpperCase());

  const pInicio = obtenerComponentesBogota(inicio);
  const pFin = obtenerComponentesBogota(fin);

  return `${fechaLimpia} · ${pInicio.timeString} - ${pFin.timeString}`;
}
