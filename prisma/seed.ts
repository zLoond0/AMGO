import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed de la base de datos...");

  // 1. Usuarios institucionales de prueba (Password123!)
  const passwordHash = bcrypt.hashSync("Password123!", 10);

  const usuarios = [
    {
      id: "usr_001",
      email: "docente@amigo.edu.co",
      passwordHash,
      nombre: "Prof. Carlos Restrepo",
      rol: "Docente",
    },
    {
      id: "usr_002",
      email: "coordinador@amigo.edu.co",
      passwordHash,
      nombre: "Dra. María Elena Gómez",
      rol: "Coordinador",
    },
    {
      id: "usr_003",
      email: "admin@amigo.edu.co",
      passwordHash,
      nombre: "Ing. Sofía Ramírez",
      rol: "Administrador",
    },
    {
      id: "usr_004",
      email: "nombre@amigo.edu.co",
      passwordHash,
      nombre: "Juan Camilo Pérez",
      rol: "Docente",
    },
  ];

  for (const u of usuarios) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        nombre: u.nombre,
        rol: u.rol,
        passwordHash: u.passwordHash,
      },
      create: u,
    });
  }
  console.log(`Usuarios sembrados: ${usuarios.length}`);

  // 2. Recursos del laboratorio
  // TODO: Reemplazar estos recursos placeholders con el inventario real del laboratorio AMGO
  const recursos = [
    {
      id: "rec_001",
      nombre: "Computador 3 - GPU",
      descripcion: "Estación de cómputo de alto rendimiento con GPU NVIDIA para entrenamiento de modelos IA.",
      activo: true,
    },
    {
      id: "rec_002",
      nombre: "Laboratorio Redes 2",
      descripcion: "Espacio especializado para pruebas de infraestructura y protocolos de red.",
      activo: true,
    },
    {
      id: "rec_003",
      nombre: "Sala IA - Workstation 1",
      descripcion: "Workstation dedicada a investigación y prototipado rápido en analítica avanzada.",
      activo: true,
    },
  ];

  for (const r of recursos) {
    await prisma.recurso.upsert({
      where: { nombre: r.nombre },
      update: {
        descripcion: r.descripcion,
        activo: r.activo,
      },
      create: r,
    });
  }
  console.log(`Recursos sembrados: ${recursos.length}`);
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
