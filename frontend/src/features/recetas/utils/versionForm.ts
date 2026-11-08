import type {
  FilaInsumoForm,
  FilaTareaForm,
  FilaUsoForm,
  InsumoOpcion,
  VersionDetalle,
  VersionFormState,
  VersionInput,
} from "../types/receta";

let contador = 0;
export const nuevaClave = () => `fila-${++contador}`;

export const nuevaFilaInsumo = (): FilaInsumoForm => ({
  clave: nuevaClave(),
  insumo_id: 0,
  cantidad: "",
});

export const nuevaFilaUso = (): FilaUsoForm => ({
  clave: nuevaClave(),
  insumo_id: 0,
  cantidad: "",
});

export const nuevaFilaTarea = (): FilaTareaForm => ({
  clave: nuevaClave(),
  descripcion: "",
  usos: [],
});

export const estadoInicial = (): VersionFormState => ({
  rendimiento: "",
  unidad_medida_id: 0,
  porcion_descripcion: "",
  porcion_cantidad: "",
  porcion_unidad_medida_id: 0,
  insumos: [nuevaFilaInsumo()],
  tareas: [nuevaFilaTarea()],
});

/** Precarga el formulario con una versión existente (para crear la siguiente). */
export function desdeDetalle(version: VersionDetalle): VersionFormState {
  return {
    rendimiento: String(Number(version.rendimiento)),
    unidad_medida_id: version.unidad_medida.id,
    porcion_descripcion: version.porcion_descripcion ?? "",
    porcion_cantidad: version.porcion_cantidad ? String(Number(version.porcion_cantidad)) : "",
    porcion_unidad_medida_id: version.porcion_unidad_medida?.id ?? 0,
    insumos: version.insumos.map((i) => ({
      clave: nuevaClave(),
      insumo_id: i.insumo.id,
      cantidad: String(Number(i.cantidad)),
    })),
    tareas: version.tareas.map((t) => ({
      clave: nuevaClave(),
      descripcion: t.descripcion,
      usos: t.insumos.map((u) => ({
        clave: nuevaClave(),
        insumo_id: u.insumo.id,
        cantidad: String(Number(u.cantidad)),
      })),
    })),
  };
}

const redondear = (valor: number) => Math.round(valor * 1000) / 1000;
const numero = (texto: string) => {
  const valor = Number(texto.replace(",", "."));
  return Number.isFinite(valor) ? valor : 0;
};

export interface RepartoInsumo {
  insumo_id: number;
  total: number;
  repartido: number;
  completo: boolean;
}

/** Por cada insumo de la receta: total declarado vs. lo repartido entre las tareas. */
export function calcularReparto(estado: VersionFormState): RepartoInsumo[] {
  return estado.insumos
    .filter((fila) => fila.insumo_id > 0)
    .map((fila) => {
      const total = redondear(numero(fila.cantidad));
      const repartido = redondear(
        estado.tareas
          .flatMap((t) => t.usos)
          .filter((u) => u.insumo_id === fila.insumo_id)
          .reduce((suma, u) => suma + numero(u.cantidad), 0),
      );
      return {
        insumo_id: fila.insumo_id,
        total,
        repartido,
        completo: total > 0 && total === repartido,
      };
    });
}

/** Devuelve el primer problema del formulario, o `null` si está listo para enviar. */
export function validar(estado: VersionFormState, insumos: InsumoOpcion[] = []): string | null {
  if (numero(estado.rendimiento) <= 0) return "Indicá el rendimiento de la receta.";
  if (!estado.unidad_medida_id) return "Elegí la unidad del rendimiento.";
  const porcion = estado.porcion_cantidad.trim();
  if (porcion && numero(porcion) <= 0) return "La cantidad de la porción debe ser mayor a cero.";
  if (porcion && !estado.porcion_unidad_medida_id) return "Elegí la unidad de la porción.";
  if (!porcion && estado.porcion_unidad_medida_id) return "Indicá la cantidad de la porción.";
  if (estado.insumos.length === 0) return "Agregá al menos un insumo.";
  if (estado.insumos.some((i) => !i.insumo_id || numero(i.cantidad) <= 0)) {
    return "Completá el insumo y una cantidad mayor a cero en cada fila.";
  }
  const ids = estado.insumos.map((i) => i.insumo_id);
  if (new Set(ids).size !== ids.length) return "Un insumo no puede repetirse en la receta.";
  const tipoDe = (id: number) => insumos.find((i) => i.id === id)?.tipo;
  if (insumos.length > 0 && !ids.some((id) => tipoDe(id) === "ingrediente")) {
    return "La receta necesita al menos un ingrediente: no puede tener solo aditivos.";
  }
  const aditivoSinClase = estado.insumos.find((i) => {
    const insumo = insumos.find((x) => x.id === i.insumo_id);
    return insumo?.tipo === "aditivo" && !insumo.aditivo;
  });
  if (aditivoSinClase) {
    return "Hay un aditivo sin clase funcional: completalo en el maestro de insumos.";
  }
  if (estado.tareas.length === 0) return "Agregá al menos una tarea.";
  if (estado.tareas.some((t) => !t.descripcion.trim())) {
    return "Cada tarea necesita una descripción.";
  }
  for (const tarea of estado.tareas) {
    if (tarea.usos.some((u) => !u.insumo_id || numero(u.cantidad) <= 0)) {
      return "Completá el insumo y la cantidad en cada insumo de las tareas.";
    }
    const usados = tarea.usos.map((u) => u.insumo_id);
    if (new Set(usados).size !== usados.length) {
      return "Una tarea no puede repetir el mismo insumo.";
    }
  }
  if (calcularReparto(estado).some((r) => !r.completo)) {
    return "La cantidad repartida entre las tareas debe sumar el total de cada insumo.";
  }
  return null;
}

export function aInput(estado: VersionFormState, insumos: InsumoOpcion[]): VersionInput {
  const unidadDe = (id: number) => insumos.find((i) => i.id === id)?.unidad_medida_id ?? 0;
  return {
    rendimiento: String(numero(estado.rendimiento)),
    unidad_medida_id: estado.unidad_medida_id,
    porcion_descripcion: estado.porcion_descripcion.trim() || null,
    porcion_cantidad: estado.porcion_cantidad.trim() ? String(numero(estado.porcion_cantidad)) : null,
    porcion_unidad_medida_id: estado.porcion_unidad_medida_id || null,
    insumos: estado.insumos.map((i) => ({
      insumo_id: i.insumo_id,
      cantidad: String(numero(i.cantidad)),
      unidad_medida_id: unidadDe(i.insumo_id),
    })),
    tareas: estado.tareas.map((t) => ({
      descripcion: t.descripcion.trim(),
      insumos: t.usos.map((u) => ({
        insumo_id: u.insumo_id,
        cantidad: String(numero(u.cantidad)),
      })),
    })),
  };
}
