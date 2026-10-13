import { NextRequest } from "next/server";
import { POST as postReserva, GET as getReservas } from "@/app/api/reservas/route";
import { GET as getReservaPorId } from "@/app/api/reservas/[id]/route";
import { PATCH as patchConfirmar } from "@/app/api/reservas/[id]/confirmar/route";
import { PATCH as patchCancelar } from "@/app/api/reservas/[id]/cancelar/route";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { crearFechaBogota, normalizarSemanaBogota } from "@/lib/config";
import type { UserPayload } from "@/lib/types";

describe("ADENDA 2: Flujo completo de reservas, concurrencia y permisos", () => {
  const usuarioDocente: UserPayload = {
    id: "usr_001",
    email: "docente@amigo.edu.co",
    nombre: "Prof. Carlos Restrepo",
    rol: "Docente",
  };

  const usuarioCoordinador: UserPayload = {
    id: "usr_002",
    email: "coordinador@amigo.edu.co",
    nombre: "Dra. María Elena Gómez",
    rol: "Coordinador",
  };

  const usuarioOtro: UserPayload = {
    id: "usr_004",
    email: "nombre@amigo.edu.co",
    nombre: "Juan Camilo Pérez",
    rol: "Docente",
  };

  let tokenDocente: string;
  let tokenCoordinador: string;
  let tokenOtro: string;
  let recursoId: string;

  // Calculamos una fecha futura válida (próximo miércoles hábil a las 10:00)
  const fechaFutura = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const semana = normalizarSemanaBogota(fechaFutura);
  // semana.dias[2] es el miércoles
  const fechaMiercoles = semana.dias[2];
  const inicioValido = crearFechaBogota(fechaMiercoles, "10:00").toISOString();

  beforeAll(async () => {
    tokenDocente = generateToken(usuarioDocente);
    tokenCoordinador = generateToken(usuarioCoordinador);
    tokenOtro = generateToken(usuarioOtro);

    // Asegurar usuarios en test.db
    for (const u of [usuarioDocente, usuarioCoordinador, usuarioOtro]) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: { nombre: u.nombre, rol: u.rol },
        create: {
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          rol: u.rol,
          passwordHash: "hash-prueba",
        },
      });
    }

    // Inicializar 10 usuarios y tokens para pruebas de concurrencia
    for (let i = 1; i <= 10; i++) {
      const uId = `usr_concurrencia_${i}`;
      await prisma.user.upsert({
        where: { email: `concurrencia_${i}@amigo.edu.co` },
        update: {},
        create: {
          id: uId,
          email: `concurrencia_${i}@amigo.edu.co`,
          nombre: `Usuario Concurrencia ${i}`,
          rol: "Docente",
          passwordHash: "hash-prueba",
        },
      });
    }

    const recurso = await prisma.recurso.upsert({
      where: { nombre: "Computador 3 - GPU" },
      update: { activo: true },
      create: {
        id: "rec_001",
        nombre: "Computador 3 - GPU",
        descripcion: "Estación GPU",
        activo: true,
      },
    });
    recursoId = recurso.id;
  });

  beforeEach(async () => {
    // Limpiamos reservas antes de cada test para aislamiento
    await prisma.reserva.deleteMany({ where: { recursoId } });
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { recursoId } });
    await prisma.$disconnect();
  });

  function makePostRequest(body: unknown, token?: string): NextRequest {
    const headers = new Headers({ "content-type": "application/json" });
    if (token) headers.set("authorization", `Bearer ${token}`);
    return new NextRequest(new URL("http://localhost:3000/api/reservas"), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  function makePatchRequest(url: string, token?: string): NextRequest {
    const headers = new Headers();
    if (token) headers.set("authorization", `Bearer ${token}`);
    return new NextRequest(new URL(url, "http://localhost:3000"), {
      method: "PATCH",
      headers,
    });
  }

  function makeGetRequest(url: string, token?: string): NextRequest {
    const headers = new Headers();
    if (token) headers.set("authorization", `Bearer ${token}`);
    return new NextRequest(new URL(url, "http://localhost:3000"), {
      method: "GET",
      headers,
    });
  }

  describe("POST /api/reservas: Validaciones de entrada", () => {
    test("Rechaza tipo inválido o ausente con 400", async () => {
      // Tipo ausente
      const reqSinTipo = makePostRequest(
        { recursoId, inicio: inicioValido },
        tokenDocente
      );
      const res1 = await postReserva(reqSinTipo);
      expect(res1.status).toBe(400);
      const json1 = await res1.json();
      expect(json1.message).toMatch(/tipo de uso/i);

      // Tipo inventado
      const reqTipoInvalido = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "FIESTA" },
        tokenDocente
      );
      const res2 = await postReserva(reqTipoInvalido);
      expect(res2.status).toBe(400);
    });

    test("Rechaza bloque inválido (hora incorrecta o fin de semana) con 400", async () => {
      // Hora no configurada: 07:00
      const inicio07 = crearFechaBogota(fechaMiercoles, "07:00").toISOString();
      const reqHora = makePostRequest(
        { recursoId, inicio: inicio07, tipo: "CLASE" },
        tokenDocente
      );
      const res1 = await postReserva(reqHora);
      expect(res1.status).toBe(400);

      // Fin de semana: sábado
      const sabadoIso = crearFechaBogota("2026-10-17", "10:00").toISOString();
      const reqSabado = makePostRequest(
        { recursoId, inicio: sabadoIso, tipo: "CLASE" },
        tokenDocente
      );
      const res2 = await postReserva(reqSabado);
      expect(res2.status).toBe(400);
      const json2 = await res2.json();
      expect(json2.message).toMatch(/lunes a viernes/i);
    });
  });

  describe("Flujo completo: Retención -> Confirmar con tipo", () => {
    test("Crea retención exitosa (201) y confirma pasando a CONFIRMADA (200)", async () => {
      // 1. Crear retención
      const reqCrear = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "PRACTICA" },
        tokenDocente
      );
      const resCrear = await postReserva(reqCrear);
      expect(resCrear.status).toBe(201);
      const jsonCrear = await resCrear.json();
      expect(jsonCrear.success).toBe(true);
      expect(jsonCrear.reserva.estado).toBe("RETENIDA");
      expect(jsonCrear.reserva.tipo).toBe("PRACTICA");
      expect(jsonCrear.reserva.expiraEn).toBeDefined();

      const reservaId = jsonCrear.reserva.id;

      // 2. Consultar detalle antes de confirmar
      const reqDetalle = makeGetRequest(
        `http://localhost:3000/api/reservas/${reservaId}`,
        tokenDocente
      );
      const resDetalle = await getReservaPorId(reqDetalle, {
        params: { id: reservaId },
      });
      expect(resDetalle.status).toBe(200);

      // 3. Confirmar la reserva
      const reqConfirmar = makePatchRequest(
        `http://localhost:3000/api/reservas/${reservaId}/confirmar`,
        tokenDocente
      );
      const resConfirmar = await patchConfirmar(reqConfirmar, {
        params: { id: reservaId },
      });
      expect(resConfirmar.status).toBe(200);
      const jsonConfirmar = await resConfirmar.json();
      expect(jsonConfirmar.success).toBe(true);
      expect(jsonConfirmar.reserva.estado).toBe("CONFIRMADA");
      expect(jsonConfirmar.reserva.expiraEn).toBeNull();
    });

    test("Impide que un usuario tenga más de una retención activa al mismo tiempo (409)", async () => {
      // Primera retención
      const req1 = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const res1 = await postReserva(req1);
      expect(res1.status).toBe(201);

      // Segunda retención para el mismo usuario en otro bloque
      const inicioBloque2 = crearFechaBogota(
        fechaMiercoles,
        "14:00"
      ).toISOString();
      const req2 = makePostRequest(
        { recursoId, inicio: inicioBloque2, tipo: "CLASE" },
        tokenDocente
      );
      const res2 = await postReserva(req2);
      expect(res2.status).toBe(409);
      const json2 = await res2.json();
      expect(json2.message).toMatch(/ya tienes una reserva en proceso/i);
    });
  });

  describe("PATCH /api/reservas/[id]/confirmar: Casos de error", () => {
    test("Retorna 404 si la reserva no pertenece al usuario", async () => {
      // Usuario Docente crea retención
      const reqCrear = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const resCrear = await postReserva(reqCrear);
      const jsonCrear = await resCrear.json();
      const reservaId = jsonCrear.reserva.id;

      // Usuario Otro intenta confirmar la reserva del Docente
      const reqConfirmar = makePatchRequest(
        `http://localhost:3000/api/reservas/${reservaId}/confirmar`,
        tokenOtro
      );
      const resConfirmar = await patchConfirmar(reqConfirmar, {
        params: { id: reservaId },
      });
      expect(resConfirmar.status).toBe(404);
    });

    test("Retorna 409 si la reserva ya no está RETENIDA (ya confirmada)", async () => {
      const reqCrear = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const resCrear = await postReserva(reqCrear);
      const jsonCrear = await resCrear.json();
      const reservaId = jsonCrear.reserva.id;

      // Confirmar una primera vez
      const reqConfirmar1 = makePatchRequest(
        `http://localhost:3000/api/reservas/${reservaId}/confirmar`,
        tokenDocente
      );
      await patchConfirmar(reqConfirmar1, { params: { id: reservaId } });

      // Confirmar una segunda vez
      const reqConfirmar2 = makePatchRequest(
        `http://localhost:3000/api/reservas/${reservaId}/confirmar`,
        tokenDocente
      );
      const res2 = await patchConfirmar(reqConfirmar2, {
        params: { id: reservaId },
      });
      expect(res2.status).toBe(409);
    });

    test("Retorna 410 si la retención ya venció en BD", async () => {
      const reqCrear = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const resCrear = await postReserva(reqCrear);
      const jsonCrear = await resCrear.json();
      const reservaId = jsonCrear.reserva.id;

      // Forzar retención vencida en BD (1 segundo en el pasado)
      await prisma.reserva.update({
        where: { id: reservaId },
        data: { expiraEn: new Date(Date.now() - 1000) },
      });

      const reqConfirmar = makePatchRequest(
        `http://localhost:3000/api/reservas/${reservaId}/confirmar`,
        tokenDocente
      );
      const resConfirmar = await patchConfirmar(reqConfirmar, {
        params: { id: reservaId },
      });
      expect(resConfirmar.status).toBe(410);

      // Verificamos que pasó a EXPIRADA
      const r = await prisma.reserva.findUnique({ where: { id: reservaId } });
      expect(r?.estado).toBe("EXPIRADA");
    });
  });

  describe("PATCH /api/reservas/[id]/cancelar: Permisos de cancelación", () => {
    test("Dueño puede cancelar reserva CONFIRMADA y RETENIDA", async () => {
      // 1. Cancelar en RETENIDA
      const reqCrear1 = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const resCrear1 = await postReserva(reqCrear1);
      const r1 = await resCrear1.json();

      const reqCanc1 = makePatchRequest(
        `http://localhost:3000/api/reservas/${r1.reserva.id}/cancelar`,
        tokenDocente
      );
      const resCanc1 = await patchCancelar(reqCanc1, {
        params: { id: r1.reserva.id },
      });
      expect(resCanc1.status).toBe(200);

      // 2. Cancelar en CONFIRMADA
      const reqCrear2 = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const resCrear2 = await postReserva(reqCrear2);
      const r2 = await resCrear2.json();
      // Confirmamos
      const reqConf = makePatchRequest(
        `http://localhost:3000/api/reservas/${r2.reserva.id}/confirmar`,
        tokenDocente
      );
      await patchConfirmar(reqConf, { params: { id: r2.reserva.id } });

      // Cancelamos
      const reqCanc2 = makePatchRequest(
        `http://localhost:3000/api/reservas/${r2.reserva.id}/cancelar`,
        tokenDocente
      );
      const resCanc2 = await patchCancelar(reqCanc2, {
        params: { id: r2.reserva.id },
      });
      expect(resCanc2.status).toBe(200);
      const r2Db = await prisma.reserva.findUnique({
        where: { id: r2.reserva.id },
      });
      expect(r2Db?.estado).toBe("CANCELADA");
    });

    test("Coordinador puede cancelar reservas CONFIRMADAS de cualquier usuario", async () => {
      // Docente crea y confirma
      const reqCrear = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const resCrear = await postReserva(reqCrear);
      const r = await resCrear.json();
      const reqConf = makePatchRequest(
        `http://localhost:3000/api/reservas/${r.reserva.id}/confirmar`,
        tokenDocente
      );
      await patchConfirmar(reqConf, { params: { id: r.reserva.id } });

      // Coordinador cancela la reserva del docente
      const reqCancCoord = makePatchRequest(
        `http://localhost:3000/api/reservas/${r.reserva.id}/cancelar`,
        tokenCoordinador
      );
      const resCancCoord = await patchCancelar(reqCancCoord, {
        params: { id: r.reserva.id },
      });
      expect(resCancCoord.status).toBe(200);
    });

    test("Docente NO puede cancelar reserva de otro usuario (403)", async () => {
      // Usuario docente 1 crea y confirma
      const reqCrear = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "CLASE" },
        tokenDocente
      );
      const resCrear = await postReserva(reqCrear);
      const r = await resCrear.json();
      const reqConf = makePatchRequest(
        `http://localhost:3000/api/reservas/${r.reserva.id}/confirmar`,
        tokenDocente
      );
      await patchConfirmar(reqConf, { params: { id: r.reserva.id } });

      // Usuario docente 2 intenta cancelar
      const reqCancOtro = makePatchRequest(
        `http://localhost:3000/api/reservas/${r.reserva.id}/cancelar`,
        tokenOtro
      );
      const resCancOtro = await patchCancelar(reqCancOtro, {
        params: { id: r.reserva.id },
      });
      expect(resCancOtro.status).toBe(403);
    });
  });

  describe("GET /api/reservas: Alcance mias/todas por rol", () => {
    test("Docente puede ver alcance=mias pero recibe 403 en alcance=todas", async () => {
      const reqMias = makeGetRequest(
        "http://localhost:3000/api/reservas?alcance=mias",
        tokenDocente
      );
      const resMias = await getReservas(reqMias);
      expect(resMias.status).toBe(200);

      const reqTodas = makeGetRequest(
        "http://localhost:3000/api/reservas?alcance=todas",
        tokenDocente
      );
      const resTodas = await getReservas(reqTodas);
      expect(resTodas.status).toBe(403);
    });

    test("Coordinador puede consultar alcance=todas con datos de usuario", async () => {
      // Creamos una reserva confirmada
      const reqCrear = makePostRequest(
        { recursoId, inicio: inicioValido, tipo: "INVESTIGACION" },
        tokenDocente
      );
      const resCrear = await postReserva(reqCrear);
      const r = await resCrear.json();
      const reqConf = makePatchRequest(
        `http://localhost:3000/api/reservas/${r.reserva.id}/confirmar`,
        tokenDocente
      );
      await patchConfirmar(reqConf, { params: { id: r.reserva.id } });

      const reqTodas = makeGetRequest(
        "http://localhost:3000/api/reservas?alcance=todas",
        tokenCoordinador
      );
      const resTodas = await getReservas(reqTodas);
      expect(resTodas.status).toBe(200);
      const json = await resTodas.json();
      expect(json.success).toBe(true);
      expect(json.reservas.length).toBeGreaterThan(0);
      expect(json.reservas[0].usuario).toBeDefined();
      expect(json.reservas[0].recurso).toBeDefined();
    });
  });

  describe("Prueba de concurrencia: 10 POST simultáneos al mismo recurso y bloque", () => {
    test(
      "Exactamente 1 petición obtiene 201 y las otras 9 obtienen 409",
      async () => {
        const tokens: string[] = [];
        for (let i = 1; i <= 10; i++) {
          tokens.push(
            generateToken({
              id: `usr_concurrencia_${i}`,
              email: `concurrencia_${i}@amigo.edu.co`,
              nombre: `Usuario Concurrencia ${i}`,
              rol: "Docente",
            })
          );
        }

        // Lanzamos 10 POST simultáneos para el mismo recursoId, inicio y tipo
        const promesas = tokens.map((token) => {
          const req = makePostRequest(
            { recursoId, inicio: inicioValido, tipo: "CLASE" },
            token
          );
          return postReserva(req);
        });

        const respuestas = await Promise.all(promesas);
        const estados = respuestas.map((r) => r.status);

        const exitosas201 = estados.filter((s) => s === 201).length;
        const conflicto409 = estados.filter((s) => s === 409).length;

        expect(exitosas201).toBe(1);
        expect(conflicto409).toBe(9);
      },
      20000
    );
  });
});
