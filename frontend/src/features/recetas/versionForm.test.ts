import { describe, expect, it } from "vitest";
import type { IngredienteOpcion, VersionDetalle } from "./types/receta";
import { desdeDetalle, opcionesConInactivos, validar } from "./utils/versionForm";

const kg = { id: 1, nombre: "Kilogramo", simbolo: "kg" };

const harina: IngredienteOpcion = {
  id: 1,
  nombre: "Harina 000",
  unidad_medida_id: 1,
  unidad_medida: kg,
  es_aditivo: false,
  aditivo: null,
};

/** Versión con Harina (activa) y Coco rallado (id 22, dado de baja). */
const version = {
  id: 11,
  numero: 1,
  rendimiento: "60",
  unidad_medida: kg,
  porcion_descripcion: null,
  porcion_cantidad: null,
  porcion_unidad_medida: null,
  vida_util_dias: null,
  ingredientes: [
    { ingrediente: { id: 1, nombre: "Harina 000" }, cantidad: "1", unidad_medida: kg, es_aditivo: false, aditivo: null },
    { ingrediente: { id: 22, nombre: "Coco rallado" }, cantidad: "0.2", unidad_medida: kg, es_aditivo: false, aditivo: null },
  ],
  tareas: [
    {
      descripcion: "Mezclar",
      procedimiento: null,
      ingredientes: [
        { ingrediente: { id: 1, nombre: "Harina 000" }, cantidad: "1" },
        { ingrediente: { id: 22, nombre: "Coco rallado" }, cantidad: "0.2" },
      ],
    },
  ],
} as unknown as VersionDetalle;

describe("opcionesConInactivos", () => {
  it("agrega, marcados, los ingredientes de la versión que ya no están activos", () => {
    const opciones = opcionesConInactivos([harina], version);

    expect(opciones.map((o) => o.id)).toEqual([1, 22]);
    expect(opciones[1]).toMatchObject({ nombre: "Coco rallado", inactivo: true });
  });

  it("no cambia la lista si todos siguen activos", () => {
    const activos = [harina, { ...harina, id: 22, nombre: "Coco rallado" }];

    expect(opcionesConInactivos(activos, version)).toBe(activos);
  });
});

describe("validar con ingredientes dados de baja", () => {
  it("pide reemplazar el ingrediente dado de baja antes de guardar", () => {
    const opciones = opcionesConInactivos([harina], version);

    expect(validar(desdeDetalle(version), opciones)).toMatch(/Coco rallado está dado de baja/);
  });
});
