// Tipos compartidos entre cliente y servidor. Solo tipos: sin dependencias de Node.

export type RoleType = "Docente" | "Coordinador" | "Administrador";

// Datos publicos del usuario autenticado (nunca incluye el hash de la contrasena).
export interface UserData {
  id: string;
  email: string;
  nombre: string;
  rol: RoleType;
}

// Claims que viajan firmados dentro del JWT.
export type UserPayload = UserData;
