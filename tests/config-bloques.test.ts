import {
  BLOQUES,
  HOLD_MINUTOS,
  ANTICIPACION_MAXIMA_DIAS,
  DIAS_OPERACION,
  validarInicioReserva,
  obtenerComponentesBogota,
  normalizarSemanaBogota,
  crearFechaBogota,
  formatearRangoBogota,
} from "@/lib/config";

describe("ADENDA 2: Configuración centralizada de bloques y reglas de tiempo", () => {
  test("BLOQUES contiene los tres bloques fijos de 2 horas (08-10, 10-12, 14-16)", () => {
    expect(BLOQUES).toHaveLength(3);
    expect(BLOQUES[0]).toEqual({ inicio: "08:00", fin: "10:00" });
    expect(BLOQUES[1]).toEqual({ inicio: "10:00", fin: "12:00" });
    expect(BLOQUES[2]).toEqual({ inicio: "14:00", fin: "16:00" });
  });

  test("Parámetros generales de configuración: HOLD_MINUTOS y ANTICIPACION_MAXIMA_DIAS", () => {
    expect(HOLD_MINUTOS).toBe(5);
    expect(ANTICIPACION_MAXIMA_DIAS).toBe(30);
    expect(DIAS_OPERACION).toEqual([1, 2, 3, 4, 5]);
  });

  describe("validarInicioReserva: Casos válidos y derivación de fin", () => {
    const ahoraFijo = new Date("2026-10-12T07:00:00-05:00"); // Lunes 12 Oct 07:00 Bogotá

    test("Acepta bloque válido 08:00 - 10:00 y deriva fin correctamente", () => {
      const inicio = new Date("2026-10-12T08:00:00-05:00");
      const res = validarInicioReserva(inicio, ahoraFijo);

      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.bloque).toEqual({ inicio: "08:00", fin: "10:00" });
        expect(res.inicio.toISOString()).toBe(inicio.toISOString());
        // Fin debe ser a las 10:00 Bogotá (15:00 UTC)
        expect(obtenerComponentesBogota(res.fin).timeString).toBe("10:00");
      }
    });

    test("Acepta bloque válido 10:00 - 12:00", () => {
      const inicio = new Date("2026-10-13T10:00:00-05:00"); // Martes
      const res = validarInicioReserva(inicio, ahoraFijo);
      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.bloque).toEqual({ inicio: "10:00", fin: "12:00" });
        expect(obtenerComponentesBogota(res.fin).timeString).toBe("12:00");
      }
    });

    test("Acepta bloque válido 14:00 - 16:00", () => {
      const inicio = new Date("2026-10-14T14:00:00-05:00"); // Miércoles
      const res = validarInicioReserva(inicio, ahoraFijo);
      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.bloque).toEqual({ inicio: "14:00", fin: "16:00" });
        expect(obtenerComponentesBogota(res.fin).timeString).toBe("16:00");
      }
    });
  });

  describe("validarInicioReserva: Casos inválidos según ADENDA 2", () => {
    const ahoraFijo = new Date("2026-10-12T07:00:00-05:00"); // Lunes 12 Oct 07:00 Bogotá

    test("Rechaza el hueco 12:00 - 14:00 (inicio a las 12:00 o 13:00)", () => {
      const inicio12 = new Date("2026-10-12T12:00:00-05:00");
      const res12 = validarInicioReserva(inicio12, ahoraFijo);
      expect(res12.valido).toBe(false);
      if (!res12.valido) {
        expect(res12.error).toMatch(/debe coincidir con un bloque configurado/i);
      }

      const inicio13 = new Date("2026-10-12T13:00:00-05:00");
      const res13 = validarInicioReserva(inicio13, ahoraFijo);
      expect(res13.valido).toBe(false);
    });

    test("Rechaza antes del horario de apertura (07:00)", () => {
      const inicio07 = new Date("2026-10-13T07:00:00-05:00");
      const res = validarInicioReserva(inicio07, ahoraFijo);
      expect(res.valido).toBe(false);
      if (!res.valido) {
        expect(res.error).toMatch(/debe coincidir con un bloque configurado/i);
      }
    });

    test("Rechaza al cierre o después (16:00)", () => {
      const inicio16 = new Date("2026-10-13T16:00:00-05:00");
      const res = validarInicioReserva(inicio16, ahoraFijo);
      expect(res.valido).toBe(false);
      if (!res.valido) {
        expect(res.error).toMatch(/debe coincidir con un bloque configurado/i);
      }
    });

    test("Rechaza fines de semana (sábado y domingo)", () => {
      // Sábado 17 Octubre 2026 a las 08:00
      const sabado = new Date("2026-10-17T08:00:00-05:00");
      const resSabado = validarInicioReserva(sabado, ahoraFijo);
      expect(resSabado.valido).toBe(false);
      if (!resSabado.valido) {
        expect(resSabado.error).toMatch(/lunes a viernes/i);
      }

      // Domingo 18 Octubre 2026 a las 10:00
      const domingo = new Date("2026-10-18T10:00:00-05:00");
      const resDomingo = validarInicioReserva(domingo, ahoraFijo);
      expect(resDomingo.valido).toBe(false);
      if (!resDomingo.valido) {
        expect(resDomingo.error).toMatch(/lunes a viernes/i);
      }
    });

    test("Rechaza minutos distintos de 0 (ej. 08:30 o 14:15)", () => {
      const inicio830 = new Date("2026-10-14T08:30:00-05:00");
      const res = validarInicioReserva(inicio830, ahoraFijo);
      expect(res.valido).toBe(false);
      if (!res.valido) {
        expect(res.error).toMatch(/debe coincidir con un bloque configurado/i);
      }
    });

    test("Rechaza bloques en el pasado y bloques que ya comenzaron", () => {
      // Si son las 08:05 de hoy lunes, el bloque de las 08:00 ya empezó
      const ahoraEnMedioDeBloque = new Date("2026-10-12T08:05:00-05:00");
      const bloque08 = new Date("2026-10-12T08:00:00-05:00");
      const res = validarInicioReserva(bloque08, ahoraEnMedioDeBloque);
      expect(res.valido).toBe(false);
      if (!res.valido) {
        expect(res.error).toMatch(/pasado o que ya haya comenzado/i);
      }

      // Bloque de ayer
      const bloqueAyer = new Date("2026-10-09T14:00:00-05:00");
      const resAyer = validarInicioReserva(bloqueAyer, ahoraEnMedioDeBloque);
      expect(resAyer.valido).toBe(false);
    });

    test("Valida límite de anticipación de 30 días", () => {
      const ahora = new Date("2026-10-12T10:00:00-05:00");

      // Dentro del rango (25 días después: Viernes 6 de Noviembre)
      const dentroDeRango = new Date("2026-11-06T08:00:00-05:00");
      const resDentro = validarInicioReserva(dentroDeRango, ahora);
      expect(resDentro.valido).toBe(true);

      // Fuera de rango (35 días después)
      const fueraDeRango = new Date("2026-11-18T08:00:00-05:00");
      const resFuera = validarInicioReserva(fueraDeRango, ahora);
      expect(resFuera.valido).toBe(false);
      if (!resFuera.valido) {
        expect(resFuera.error).toMatch(/30 días de anticipación/i);
      }
    });

    test("Manejo de zona horaria: medianoche Bogotá vs medianoche UTC", () => {
      // 2026-10-15T00:00:00Z es medianoche en UTC (jueves 15).
      // Pero en Bogotá (UTC-5) son las 19:00 del miércoles 14 de octubre.
      // 19:00 no es un bloque configurado y debe evaluarse en hora de Bogotá.
      const fechaUtcMedianoche = new Date("2026-10-15T00:00:00Z");
      const componentes = obtenerComponentesBogota(fechaUtcMedianoche);
      expect(componentes.dateString).toBe("2026-10-14");
      expect(componentes.timeString).toBe("19:00");

      const res = validarInicioReserva(fechaUtcMedianoche, ahoraFijo);
      expect(res.valido).toBe(false);

      // En cambio, 2026-10-15T13:00:00Z son exactamente las 08:00 en Bogotá (Jueves 15).
      const fechaUtcApertura = new Date("2026-10-15T13:00:00Z");
      const compApertura = obtenerComponentesBogota(fechaUtcApertura);
      expect(compApertura.dateString).toBe("2026-10-15");
      expect(compApertura.timeString).toBe("08:00");

      const resApertura = validarInicioReserva(fechaUtcApertura, ahoraFijo);
      expect(resApertura.valido).toBe(true);
    });
  });

  describe("normalizarSemanaBogota y formatearRangoBogota", () => {
    test("Normaliza cualquier día al lunes y viernes de esa semana (lunes a viernes)", () => {
      // Miércoles 14 de Octubre de 2026
      const semana = normalizarSemanaBogota("2026-10-14");
      expect(semana.lunes).toBe("2026-10-12");
      expect(semana.viernes).toBe("2026-10-16");
      expect(semana.dias).toEqual([
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
        "2026-10-15",
        "2026-10-16",
      ]);
    });

    test("Formatea rango en español amigable para UI en hora de Bogotá", () => {
      const inicio = crearFechaBogota("2026-10-14", "10:00");
      const fin = crearFechaBogota("2026-10-14", "12:00");
      const texto = formatearRangoBogota(inicio, fin);
      // Debe incluir día de la semana, día del mes y rango horario 10:00 - 12:00
      expect(texto).toMatch(/Miércoles|Miercoles/i);
      expect(texto).toContain("14");
      expect(texto).toContain("10:00 - 12:00");
    });
  });
});
