// Tipos compartidos entre cliente y servidor. Sin dependencias de Node.

// Unica fuente de verdad de los roles: el tipo RoleType se deriva de esta lista.
export const ROLES = ["Docente", "Coordinador", "Administrador"] as const;

export type RoleType = (typeof ROLES)[number];

// Datos publicos del usuario autenticado (nunca incluye el hash de la contrasena).
export interface UserData {
  id: string;
  email: string;
  nombre: string;
  rol: RoleType;
}

// Claims que viajan firmados dentro del JWT.
export type UserPayload = UserData;

// Tipos de uso permitidos para la reserva
export const TIPOS_USO = ["CLASE", "PRACTICA", "INVESTIGACION"] as const;
export type TipoUso = (typeof TIPOS_USO)[number];

// Estados del ciclo de vida de la reserva (ADENDA 2)
export const ESTADOS_RESERVA = [
  "CONFIRMADA",
  "CANCELADA",
  "RETENIDA",
  "EXPIRADA",
] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

// Estados visuales de un bloque en la grilla semanal
export type EstadoBloqueDisponibilidad =
  | "disponible"
  | "ocupada"
  | "retenida"
  | "tu_retencion"
  | "pasada"
  | "fuera_de_rango";
