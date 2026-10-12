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
