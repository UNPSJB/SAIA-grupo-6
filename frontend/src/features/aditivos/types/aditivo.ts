export interface ClaseFuncional {
  id: number;
  nombre: string;
  /** Las clases que se declaran solo por su función (aromatizantes). */
  ins_opcional: boolean;
  activo: boolean;
}

export interface Aditivo {
  id: number;
  nombre: string;
  numero_ins: string | null;
  activo: boolean;
  clase_funcional: ClaseFuncional;
}

/** Lo que muestran el insumo y la receta de un aditivo. */
export interface AditivoResumen {
  id: number;
  nombre: string;
  numero_ins: string | null;
  clase_funcional: string;
}

export interface AditivoInput {
  clase_funcional_id: number;
  nombre: string;
  numero_ins: string | null;
}

export interface ClaseFuncionalInput {
  nombre: string;
  ins_opcional: boolean;
}

/** "Conservante: Sorbato de potasio (INS 202)". */
export function etiquetaAditivo(aditivo: AditivoResumen | null | undefined): string {
  if (!aditivo) return "-";
  const ins = aditivo.numero_ins ? ` (INS ${aditivo.numero_ins})` : "";
  return `${aditivo.clase_funcional}: ${aditivo.nombre}${ins}`;
}
