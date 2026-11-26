import { describe, expect, it } from "vitest";
import {
  alertaEnCelda,
  calcularMatrizRiesgo,
  celdaDeParametros,
  columnaDeProbabilidad,
  contarPorNivel,
  rutaDeCelda,
} from "./matrizRiesgo";

const alerta = (
  impacto: number,
  probabilidad: number,
  puntaje = impacto * probabilidad,
  plan_tratamiento_id: number | null = null,
) => ({
  impacto,
  probabilidad,
  puntaje,
  plan_tratamiento_id,
});

const celda = (m: ReturnType<typeof calcularMatrizRiesgo>, impacto: number, probabilidad: number) =>
  m.filas.flatMap((f) => f.celdas).find((c) => c.impacto === impacto && c.probabilidad === probabilidad)!;

describe("columnaDeProbabilidad", () => {
  it("1,0 es baja; hasta 2,0 media; más de 2,0 alta", () => {
    expect(columnaDeProbabilidad(1)).toBe(1);
    expect(columnaDeProbabilidad(1.01)).toBe(2);
    expect(columnaDeProbabilidad(2)).toBe(2);
    expect(columnaDeProbabilidad(2.4)).toBe(3);
    expect(columnaDeProbabilidad(3)).toBe(3);
  });

  it("no se sale de la escala", () => {
    expect(columnaDeProbabilidad(0.4)).toBe(1);
    expect(columnaDeProbabilidad(5)).toBe(3);
  });
});

describe("calcularMatrizRiesgo", () => {
  it("la fila de arriba es la de mayor impacto", () => {
    const m = calcularMatrizRiesgo([]);
    expect(m.filas.map((f) => f.impacto)).toEqual([3, 2, 1]);
  });

  it("cuenta cada situación en su celda", () => {
    const m = calcularMatrizRiesgo([alerta(3, 3), alerta(3, 2.4), alerta(3, 1.2), alerta(1, 1)]);
    expect(celda(m, 3, 3).cantidad).toBe(2);
    expect(celda(m, 3, 2).cantidad).toBe(1);
    expect(celda(m, 1, 1).cantidad).toBe(1);
    expect(m.total).toBe(4);
  });

  it("las situaciones sin puntaje no entran en la matriz", () => {
    const m = calcularMatrizRiesgo([alerta(0, 0, 0), alerta(2, 2)]);
    expect(m.total).toBe(1);
    expect(m.sinPuntaje).toBe(1);
  });

  it("las situaciones bajo control de un plan no suman a la grilla y se cuentan aparte", () => {
    const m = calcularMatrizRiesgo([alerta(3, 3, 9, 12), alerta(3, 3)]);
    expect(celda(m, 3, 3).cantidad).toBe(1);
    expect(m.total).toBe(1);
    expect(m.controladas).toBe(1);
  });

  it("con incluirControladas la matriz es el riesgo real", () => {
    const alertas = [alerta(3, 3, 9, 12), alerta(3, 3)];
    const real = calcularMatrizRiesgo(alertas, { incluirControladas: true });
    expect(celda(real, 3, 3).cantidad).toBe(2);
    expect(real.total).toBe(2);
    expect(real.controladas).toBe(1);
  });

  it("contarPorNivel cuenta por el puntaje real, como el motor", () => {
    const m = calcularMatrizRiesgo([alerta(3, 3), alerta(3, 3), alerta(3, 2), alerta(1, 1)]);
    expect(contarPorNivel(m)).toEqual({ alto: 2, medio: 1, bajo: 1 });
    // Impacto medio con probabilidad 1,3 da 2,6: es bajo aunque su celda sea
    // la de "medio × media".
    const mezcla = calcularMatrizRiesgo([alerta(2, 1.3, 2.6), alerta(2, 1.6, 3.2)]);
    expect(contarPorNivel(mezcla)).toEqual({ alto: 0, medio: 1, bajo: 1 });
  });

  it("una celda con situaciones toma el nivel de la más grave", () => {
    expect(celda(calcularMatrizRiesgo([alerta(2, 1.3, 2.6)]), 2, 2).nivel).toBe("bajo");
    expect(
      celda(calcularMatrizRiesgo([alerta(2, 1.3, 2.6), alerta(2, 1.6, 3.2)]), 2, 2).nivel,
    ).toBe("medio");
  });

  it("el nivel de cada celda vacía es el de impacto × probabilidad", () => {
    const m = calcularMatrizRiesgo([]);
    expect(celda(m, 3, 3).nivel).toBe("alto");
    expect(celda(m, 3, 2).nivel).toBe("medio");
    expect(celda(m, 3, 1).nivel).toBe("bajo");
    expect(celda(m, 2, 2).nivel).toBe("medio");
    expect(celda(m, 1, 3).nivel).toBe("bajo");
  });
});

describe("celdas como filtro de Notificaciones", () => {
  it("la ruta lleva la celda y se lee de vuelta", () => {
    const ruta = rutaDeCelda({ impacto: 3, probabilidad: 2 });
    expect(ruta).toBe("/notificaciones?impacto=3&probabilidad=2");
    const parametros = new URLSearchParams(ruta.split("?")[1]);
    expect(celdaDeParametros(parametros)).toEqual({ impacto: 3, probabilidad: 2 });
  });

  it("una celda incompleta o fuera de escala no filtra", () => {
    expect(celdaDeParametros(new URLSearchParams("impacto=3"))).toBeNull();
    expect(celdaDeParametros(new URLSearchParams("impacto=4&probabilidad=1"))).toBeNull();
    expect(celdaDeParametros(new URLSearchParams(""))).toBeNull();
  });

  it("lista lo mismo que cuenta la celda de la matriz tratada", () => {
    const alertas = [alerta(3, 1.6), alerta(3, 1.6, 4.8, 7), alerta(3, 2.4), alerta(0, 0, 0)];
    const matriz = calcularMatrizRiesgo(alertas);
    const enCelda = alertas.filter((a) => alertaEnCelda(a, { impacto: 3, probabilidad: 2 }));
    expect(enCelda).toHaveLength(celda(matriz, 3, 2).cantidad);
    expect(enCelda).toHaveLength(1);
  });
});

describe("matriz proyectada (si los planes son eficaces)", () => {
  const conPlan = (impacto: number, probabilidad: number, plan_activo_id: number | null, controlada: number | null = null) => ({
    impacto,
    probabilidad,
    puntaje: impacto * probabilidad,
    plan_tratamiento_id: controlada,
    plan_activo_id,
  });

  it("saca lo que está en un plan activo y lo verificado; el real lo cuenta todo", () => {
    const alertas = [conPlan(3, 3, 5), conPlan(3, 3, null), conPlan(2, 2, null, 9), conPlan(1, 1, null)];
    const real = calcularMatrizRiesgo(alertas, { incluirControladas: true });
    const proyectado = calcularMatrizRiesgo(alertas, { excluirEnPlanActivo: true });
    expect(real.total).toBe(4);
    expect(real.enPlanActivo).toBe(1);
    expect(real.controladas).toBe(1);
    expect(proyectado.total).toBe(2);
    expect(celda(proyectado, 3, 3).cantidad).toBe(1);
  });

  it("sin la opción, lo que está en un plan activo sigue en la matriz (Inicio)", () => {
    const tratado = calcularMatrizRiesgo([conPlan(3, 3, 5)]);
    expect(tratado.total).toBe(1);
  });
});
