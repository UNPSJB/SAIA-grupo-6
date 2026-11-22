import type {
  FilaIngredienteForm,
  FilaTareaForm,
  FilaUsoForm,
  IngredienteOpcion,
  VersionDetalle,
  VersionFormState,
  VersionInput,
} from "../types/receta";

let contador = 0;
export const nuevaClave = () => `fila-${++contador}`;

export const nuevaFilaIngrediente = (): FilaIngredienteForm => ({
  clave: nuevaClave(),
  ingrediente_id: 0,
  cantidad: "",
});

export const nuevaFilaUso = (): FilaUsoForm => ({
  clave: nuevaClave(),
  ingrediente_id: 0,
  cantidad: "",
});

export const nuevaFilaTarea = (): FilaTareaForm => ({
  clave: nuevaClave(),
  descripcion: "",
  procedimiento: "",
  usos: [],
});

export const estadoInicial = (): VersionFormState => ({
  rendimiento: "",
  unidad_medida_id: 0,
  porcion_descripcion: "",
  porcion_cantidad: "",
  porcion_unidad_medida_id: 0,
  vida_util_dias: "",
  ingredientes: [nuevaFilaIngrediente()],
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
    vida_util_dias:
      version.vida_util_dias !== null && version.vida_util_dias !== undefined
        ? String(version.vida_util_dias)
        : "",
    ingredientes: version.ingredientes.map((i) => ({
      clave: nuevaClave(),
      ingrediente_id: i.ingrediente.id,
      cantidad: String(Number(i.cantidad)),
    })),
    tareas: version.tareas.map((t) => ({
      clave: nuevaClave(),
      descripcion: t.descripcion,
      procedimiento: t.procedimiento ?? "",
      usos: t.ingredientes.map((u) => ({
        clave: nuevaClave(),
        ingrediente_id: u.ingrediente.id,
        cantidad: String(Number(u.cantidad)),
      })),
    })),
  };
}

/**
 * Opciones del formulario de una versión nueva: los ingredientes activos más
 * los que usa la versión de partida y ya fueron dados de baja. Sin ellos, el
 * selector no encuentra el valor precargado y muestra otro ingrediente.
 */
export function opcionesConInactivos(
  activos: IngredienteOpcion[],
  version: VersionDetalle,
): IngredienteOpcion[] {
  const ids = new Set(activos.map((i) => i.id));
  const inactivos: IngredienteOpcion[] = version.ingredientes
    .filter((i) => !ids.has(i.ingrediente.id))
    .map((i) => ({
      id: i.ingrediente.id,
      nombre: i.ingrediente.nombre,
      unidad_medida_id: i.unidad_medida.id,
      unidad_medida: i.unidad_medida,
      es_aditivo: i.es_aditivo,
      aditivo: i.aditivo,
      inactivo: true,
    }));
  return inactivos.length ? [...activos, ...inactivos] : activos;
}

const redondear = (valor: number) => Math.round(valor * 1000) / 1000;
const numero = (texto: string) => {
  const valor = Number(texto.replace(",", "."));
  return Number.isFinite(valor) ? valor : 0;
};

export interface RepartoIngrediente {
  ingrediente_id: number;
  total: number;
  repartido: number;
  completo: boolean;
}

/** Por cada ingrediente de la receta: total declarado vs. lo repartido entre las tareas. */
export function calcularReparto(estado: VersionFormState): RepartoIngrediente[] {
  return estado.ingredientes
    .filter((fila) => fila.ingrediente_id > 0)
    .map((fila) => {
      const total = redondear(numero(fila.cantidad));
      const repartido = redondear(
        estado.tareas
          .flatMap((t) => t.usos)
          .filter((u) => u.ingrediente_id === fila.ingrediente_id)
          .reduce((suma, u) => suma + numero(u.cantidad), 0),
      );
      return {
        ingrediente_id: fila.ingrediente_id,
        total,
        repartido,
        completo: total > 0 && total === repartido,
      };
    });
}

/** Devuelve el primer problema del formulario, o `null` si está listo para enviar. */
export function validar(estado: VersionFormState, ingredientes: IngredienteOpcion[] = []): string | null {
  if (numero(estado.rendimiento) <= 0) return "Indicá el rendimiento de la receta.";
  if (!estado.unidad_medida_id) return "Elegí la unidad del rendimiento.";
  const porcion = estado.porcion_cantidad.trim();
  if (porcion && numero(porcion) <= 0) return "La cantidad de la porción debe ser mayor a cero.";
  if (porcion && !estado.porcion_unidad_medida_id) return "Elegí la unidad de la porción.";
  if (!porcion && estado.porcion_unidad_medida_id) return "Indicá la cantidad de la porción.";
  const vidaUtil = estado.vida_util_dias.trim();
  if (vidaUtil && (numero(vidaUtil) <= 0 || !Number.isInteger(numero(vidaUtil)))) {
    return "La vida útil debe ser un número entero mayor a cero.";
  }
  if (estado.ingredientes.length === 0) return "Agregá al menos un ingrediente.";
  if (estado.ingredientes.some((i) => !i.ingrediente_id || numero(i.cantidad) <= 0)) {
    return "Completá el ingrediente y una cantidad mayor a cero en cada fila.";
  }
  const ids = estado.ingredientes.map((i) => i.ingrediente_id);
  if (new Set(ids).size !== ids.length) return "Un ingrediente no puede repetirse en la receta.";
  const dadoDeBaja = ingredientes.find((i) => i.inactivo && ids.includes(i.id));
  if (dadoDeBaja) {
    return `${dadoDeBaja.nombre} está dado de baja en el maestro de ingredientes: reemplazalo o quitalo de la receta.`;
  }
  const esAditivo = (id: number) => ingredientes.find((i) => i.id === id)?.es_aditivo;
  if (ingredientes.length > 0 && ids.every((id) => esAditivo(id))) {
    return "La receta necesita al menos un ingrediente: no puede tener solo aditivos.";
  }
  const aditivoSinClase = estado.ingredientes.find((i) => {
    const ingrediente = ingredientes.find((x) => x.id === i.ingrediente_id);
    return ingrediente?.es_aditivo && !ingrediente.aditivo;
  });
  if (aditivoSinClase) {
    return "Hay un aditivo sin clase funcional: completalo en el maestro de ingredientes.";
  }
  if (estado.tareas.length === 0) return "Agregá al menos una tarea.";
  if (estado.tareas.some((t) => !t.descripcion.trim())) {
    return "Cada tarea necesita una descripción.";
  }
  for (const tarea of estado.tareas) {
    if (tarea.usos.some((u) => !u.ingrediente_id || numero(u.cantidad) <= 0)) {
      return "Completá el ingrediente y la cantidad en cada ingrediente de las tareas.";
    }
    const usados = tarea.usos.map((u) => u.ingrediente_id);
    if (new Set(usados).size !== usados.length) {
      return "Una tarea no puede repetir el mismo ingrediente.";
    }
  }
  if (calcularReparto(estado).some((r) => !r.completo)) {
    return "La cantidad repartida entre las tareas debe sumar el total de cada ingrediente.";
  }
  return null;
}

export function aInput(estado: VersionFormState, ingredientes: IngredienteOpcion[]): VersionInput {
  const unidadDe = (id: number) => ingredientes.find((i) => i.id === id)?.unidad_medida_id ?? 0;
  return {
    rendimiento: String(numero(estado.rendimiento)),
    unidad_medida_id: estado.unidad_medida_id,
    porcion_descripcion: estado.porcion_descripcion.trim() || null,
    porcion_cantidad: estado.porcion_cantidad.trim() ? String(numero(estado.porcion_cantidad)) : null,
    porcion_unidad_medida_id: estado.porcion_unidad_medida_id || null,
    vida_util_dias: estado.vida_util_dias.trim() ? Math.floor(numero(estado.vida_util_dias)) : null,
    ingredientes: estado.ingredientes.map((i) => ({
      ingrediente_id: i.ingrediente_id,
      cantidad: String(numero(i.cantidad)),
      unidad_medida_id: unidadDe(i.ingrediente_id),
    })),
    tareas: estado.tareas.map((t) => ({
      descripcion: t.descripcion.trim(),
      procedimiento: t.procedimiento.trim() || null,
      ingredientes: t.usos.map((u) => ({
        ingrediente_id: u.ingrediente_id,
        cantidad: String(numero(u.cantidad)),
      })),
    })),
  };
}
