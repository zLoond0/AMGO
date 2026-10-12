import bcrypt from "bcryptjs";
import type { RoleType } from "@/lib/types";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  nombre: string;
  rol: RoleType;
}

// Hash precalculado con salt de bcrypt para la contrasena comun de pruebas 'Password123!'
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("Password123!", 10);

export const usersDatabase: User[] = [
  {
    id: "usr_001",
    email: "docente@amigo.edu.co",
    passwordHash: DEFAULT_PASSWORD_HASH,
    nombre: "Prof. Carlos Restrepo",
    rol: "Docente",
  },
  {
    id: "usr_002",
    email: "coordinador@amigo.edu.co",
    passwordHash: DEFAULT_PASSWORD_HASH,
    nombre: "Dra. María Elena Gómez",
    rol: "Coordinador",
  },
  {
    id: "usr_003",
    email: "admin@amigo.edu.co",
    passwordHash: DEFAULT_PASSWORD_HASH,
    nombre: "Ing. Sofía Ramírez",
    rol: "Administrador",
  },
  {
    id: "usr_004",
    email: "nombre@amigo.edu.co",
    passwordHash: DEFAULT_PASSWORD_HASH,
    nombre: "Juan Camilo Pérez",
    rol: "Docente",
  },
];

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return usersDatabase.find((u) => u.email.toLowerCase() === normalized);
}
