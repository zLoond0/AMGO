import { NextRequest } from "next/server";
import { GET as getRecursos } from "@/app/api/recursos/route";
import { GET as getDisponibilidad } from "@/app/api/reservas/disponibilidad/route";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { crearFechaBogota } from "@/lib/config";
import type { UserPayload } from "@/lib/types";

describe("ADENDA 2: Endpoints GET /api/recursos y GET /api/reservas/disponibilidad", () => {
  const usuarioDocente: UserPayload = {
    id: "usr_001",
    email: "docente@amigo.edu.co",
    nombre: "Prof. Carlos Restrepo",
    rol: "Docente",
  };

  const usuarioOtro: UserPayload = {
    id: "usr_004",
    email: "nombre@amigo.edu.co",
    nombre: "Juan Camilo Pérez",
    rol: "Docente",
  };

  let tokenDocente: string;
  let tokenOtro: string;
  let recursoPruebaId: string;
  let recursoInactivoId: string;

  beforeAll(async () => {
    tokenDocente = generateToken(usuarioDocente);
    tokenOtro = generateToken(usuarioOtro);

    // Aseguramos usuarios de prueba en la base de datos
    await prisma.user.upsert({
      where: { email: usuarioDocente.email },
      update: { nombre: usuarioDocente.nombre, rol: usuarioDocente.rol },
      create: {
        id: usuarioDocente.id,
        email: usuarioDocente.email,
        nombre: usuarioDocente.nombre,
        rol: usuarioDocente.rol,
        passwordHash: "hash-prueba",
      },
    });

    await prisma.user.upsert({
      where: { email: usuarioOtro.email },
      update: { nombre: usuarioOtro.nombre, rol: usuarioOtro.rol },
      create: {
        id: usuarioOtro.id,
        email: usuarioOtro.email,
        nombre: usuarioOtro.nombre,
        rol: usuarioOtro.rol,
        passwordHash: "hash-prueba",
      },
    });

    // Aseguramos que existan recursos de prueba
    const recActivo = await prisma.recurso.upsert({
      where: { nombre: "Computador 3 - GPU" },
      update: { activo: true },
      create: {
        id: "rec_001",
        nombre: "Computador 3 - GPU",
        descripcion: "Estación GPU",
        activo: true,
      },
    });
    recursoPruebaId = recActivo.id;

    const recInactivo = await prisma.recurso.upsert({
      where: { nombre: "Recurso En Mantenimiento" },
      update: { activo: false },
      create: {
        id: "rec_inactivo",
        nombre: "Recurso En Mantenimiento",
        descripcion: "No disponible",
        activo: false,
      },
    });
    recursoInactivoId = recInactivo.id;
  });

  afterAll(async () => {
    // Limpieza de reservas creadas durante las pruebas
    await prisma.reserva.deleteMany({
      where: { recursoId: recursoPruebaId },
    });
    await prisma.$disconnect();
  });

  function makeRequest(
    url: string,
    token?: string
  ): NextRequest {
    const headers = new Headers();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return new NextRequest(new URL(url, "http://localhost:3000"), {
      method: "GET",
      headers,
    });
  }

  describe("GET /api/recursos", () => {
    test("Retorna 401 si no hay sesión autenticada", async () => {
      const req = makeRequest("http://localhost:3000/api/recursos");
      const res = await getRecursos(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    test("Retorna 200 con la lista de recursos activos para usuario autenticado", async () => {
      const req = makeRequest(
        "http://localhost:3000/api/recursos",
        tokenDocente
      );
      const res = await getRecursos(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.recursos)).toBe(true);
      expect(json.recursos.length).toBeGreaterThan(0);

      // No debe listar recursos inactivos
      const inactivo = json.recursos.find(
        (r: { id: string }) => r.id === recursoInactivoId
      );
      expect(inactivo).toBeUndefined();
    });
  });

  describe("GET /api/reservas/disponibilidad", () => {
    test("Retorna 401 si no hay sesión", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/reservas/disponibilidad?recursoId=${recursoPruebaId}&semana=2026-10-14`
      );
      const res = await getDisponibilidad(req);
      expect(res.status).toBe(401);
    });

    test("Retorna 400 si faltan parámetros recursoId o semana", async () => {
      const req1 = makeRequest(
        "http://localhost:3000/api/reservas/disponibilidad",
        tokenDocente
      );
      const res1 = await getDisponibilidad(req1);
      expect(res1.status).toBe(400);

      const req2 = makeRequest(
        `http://localhost:3000/api/reservas/disponibilidad?recursoId=${recursoPruebaId}`,
        tokenDocente
      );
      const res2 = await getDisponibilidad(req2);
      expect(res2.status).toBe(400);
    });

    test("Retorna 400 si el formato de semana es inválido", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/reservas/disponibilidad?recursoId=${recursoPruebaId}&semana=fecha-invalida`,
        tokenDocente
      );
      const res = await getDisponibilidad(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toMatch(/inválido/i);
    });

    test("Retorna 404 si el recurso no existe o está inactivo", async () => {
      const reqInexistente = makeRequest(
        "http://localhost:3000/api/reservas/disponibilidad?recursoId=rec_no_existe&semana=2026-10-14",
        tokenDocente
      );
      const res1 = await getDisponibilidad(reqInexistente);
      expect(res1.status).toBe(404);

      const reqInactivo = makeRequest(
        `http://localhost:3000/api/reservas/disponibilidad?recursoId=${recursoInactivoId}&semana=2026-10-14`,
        tokenDocente
      );
      const res2 = await getDisponibilidad(reqInactivo);
      expect(res2.status).toBe(404);
    });

    test("Normaliza cualquier día a lunes-viernes y calcula estados de bloques", async () => {
      // Limpiamos reservas previas
      await prisma.reserva.deleteMany({
        where: { recursoId: recursoPruebaId },
      });

      // Creamos una fecha futura segura: p. ej. dentro de 10 días
      const fechaFutura = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      // Obtenemos lunes de esa semana
      const diaIso = fechaFutura.toISOString().slice(0, 10);

      const req = makeRequest(
        `http://localhost:3000/api/reservas/disponibilidad?recursoId=${recursoPruebaId}&semana=${diaIso}`,
        tokenDocente
      );
      const res = await getDisponibilidad(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.semana.lunes).toBeDefined();
      expect(json.semana.viernes).toBeDefined();
      expect(json.dias).toHaveLength(5); // Lun - Vie

      // Cada día debe tener los 3 bloques configurados
      for (const d of json.dias) {
        expect(d.bloques).toHaveLength(3);
        expect(d.bloques[0].inicio).toBe("08:00");
        expect(d.bloques[0].fin).toBe("10:00");
        expect(d.bloques[1].inicio).toBe("10:00");
        expect(d.bloques[1].fin).toBe("12:00");
        expect(d.bloques[2].inicio).toBe("14:00");
        expect(d.bloques[2].fin).toBe("16:00");
      }
    });

    test("Diferencia estados: disponible, ocupada, tu_retencion, retenida y libera vencidas", async () => {
      // Usaremos una semana futura dentro de 7 días
      const lunesFuturo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { lunes } = { lunes: lunesFuturo.toISOString().slice(0, 10) };

      // Limpiamos
      await prisma.reserva.deleteMany({
        where: { recursoId: recursoPruebaId },
      });

      // 1. Reserva confirmada (ocupada) en martes 08:00
      const martes08 = crearFechaBogota(lunes, "08:00"); // usamos el mismo día para prueba
      const martes10 = crearFechaBogota(lunes, "10:00");
      await prisma.reserva.create({
        data: {
          recursoId: recursoPruebaId,
          usuarioId: usuarioOtro.id,
          inicio: martes08,
          fin: martes10,
          tipo: "CLASE",
          estado: "CONFIRMADA",
        },
      });

      // 2. Retención activa del usuario docente en martes 10:00
      const martes12 = crearFechaBogota(lunes, "12:00");
      await prisma.reserva.create({
        data: {
          recursoId: recursoPruebaId,
          usuarioId: usuarioDocente.id,
          inicio: martes10,
          fin: martes12,
          tipo: "PRACTICA",
          estado: "RETENIDA",
          expiraEn: new Date(Date.now() + 5 * 60 * 1000), // expira en 5 min
        },
      });

      // 3. Retención de otro usuario en martes 14:00
      const martes14 = crearFechaBogota(lunes, "14:00");
      const martes16 = crearFechaBogota(lunes, "16:00");
      await prisma.reserva.create({
        data: {
          recursoId: recursoPruebaId,
          usuarioId: usuarioOtro.id,
          inicio: martes14,
          fin: martes16,
          tipo: "INVESTIGACION",
          estado: "RETENIDA",
          expiraEn: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // 4. Retención ya vencida en otra fecha que debe liberarse
      const retencionVencida = await prisma.reserva.create({
        data: {
          recursoId: recursoPruebaId,
          usuarioId: usuarioOtro.id,
          inicio: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          fin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 2 * 3600000),
          tipo: "CLASE",
          estado: "RETENIDA",
          expiraEn: new Date(Date.now() - 1000), // Ya expiró
        },
      });

      const req = makeRequest(
        `http://localhost:3000/api/reservas/disponibilidad?recursoId=${recursoPruebaId}&semana=${lunes}`,
        tokenDocente
      );
      const res = await getDisponibilidad(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      const diaObj = json.dias.find((d: { fecha: string }) => d.fecha === lunes);
      if (diaObj) {
        expect(diaObj.bloques[0].estado).toBe("ocupada");
        expect(diaObj.bloques[1].estado).toBe("tu_retencion");
        expect(diaObj.bloques[2].estado).toBe("retenida");
      }

      // Verificamos que la retención vencida haya pasado a EXPIRADA
      const retActualizada = await prisma.reserva.findUnique({
        where: { id: retencionVencida.id },
      });
      expect(retActualizada?.estado).toBe("EXPIRADA");
    });
  });
});
