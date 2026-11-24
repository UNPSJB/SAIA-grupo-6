import { describe, expect, it } from "vitest";
import { evaluarNutricion } from "./utils/nutricionRotulo";

const tabla = (cambios: object = {}) => JSON.stringify({
  version_id: 8, estado: "completa", problemas: [],
  filas: [{ nombre: "Sodio", faltan_datos: false }, { nombre: "Fibra alimentaria", faltan_datos: false }],
  ...cambios,
});

describe("evaluarNutricion", () => {
  it("completa solo con todos los datos y la versión del borrador", () => {
    expect(evaluarNutricion(tabla(), 8)).toEqual({ estado: "completo" });
  });
  it("sin tabla guardada", () => {
    expect(evaluarNutricion(null, 8).estado).toBe("sin_datos_origen");
    expect(evaluarNutricion("  ", 8).estado).toBe("sin_datos_origen");
  });
  it.each([
    ["{", 8, /no se pudo leer/],
    ["null", 8, /no se pudo leer/],
    [tabla({ version_id: 9 }), 8, /otra versión/],
    [tabla({ version_id: null }), 8, /no registra/],
    [tabla(), null, /verificable/],
    [tabla({ filas: [] }), 8, /incompleta/],
    [tabla({ estado: "incompleta", problemas: ["Falta declarar la porción."] }), 8, /porción/],
    [tabla({ estado: "incompleta", filas: [{ nombre: "Sodio", faltan_datos: false }, { nombre: "Fibra alimentaria", faltan_datos: true }] }), 8, /Faltan datos de: Fibra alimentaria/],
    [tabla({ estado: "incompleta", filas: [{ nombre: "Sodio", faltan_datos: true }] }), 8, /incompleta/],
  ])("pendiente con su motivo: %s", (json, version, motivo) => {
    const r = evaluarNutricion(json, version);
    expect(r.estado).toBe("pendiente");
    expect(r.motivo).toMatch(motivo);
  });
});
