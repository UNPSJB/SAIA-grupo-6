/**
 * Tipos del dominio de reclamos de clientes (Historia 20).
 *
 * Un reclamo se registra sobre una entrega (`Salida` en ENTREGADO): el cliente
 * y el lote se heredan de la salida, no se eligen a mano.
 */

export type MotivoReclamo =
  | "sabor_olor_aspecto"
  | "envase_danado"
  | "cuerpo_extrano"
  | "posible_afectacion_salud"
  | "rotulado_etiqueta"
  | "devolucion_recall_retiro"
  | "Devolución de lote por alerta de recall/retiro"
  | "otro";

export const MOTIVOS_RECLAMO: { valor: MotivoReclamo; etiqueta: string }[] = [
  { valor: "sabor_olor_aspecto", etiqueta: "Sabor, olor o aspecto anormal" },
  { valor: "envase_danado", etiqueta: "Envase dañado" },
  { valor: "cuerpo_extrano", etiqueta: "Cuerpo extraño" },
  {
    valor: "posible_afectacion_salud",
    etiqueta: "Posible afectación a la salud",
  },
  { valor: "rotulado_etiqueta", etiqueta: "Rotulado o etiqueta" },
  {
    valor: "Devolución de lote por alerta de recall/retiro",
    etiqueta: "Devolución de lote por alerta de recall/retiro",
  },
  { valor: "otro", etiqueta: "Otro" },
];

/** Motivo que exige detalle libre (el backend también lo valida). */
export const MOTIVO_RECLAMO_OTRO: MotivoReclamo = "otro";

/** Motivo que la UI destaca con el badge rojo "Prioridad". */
export const MOTIVO_AFECTACION_SALUD: MotivoReclamo = "posible_afectacion_salud";

export function etiquetaMotivoReclamo(motivo: string): string {
  if (
    motivo === "devolucion_recall_retiro" ||
    motivo === "Devolución de lote por alerta de recall/retiro"
  ) {
    return "Devolución de lote por alerta de recall/retiro";
  }
  return (
    MOTIVOS_RECLAMO.find((m) => m.valor === motivo)?.etiqueta ?? motivo
  );
}

/** Reclamo resumido tal como lo devuelve `GET /reclamos`. */
export interface ReclamoResumen {
  id: number;
  salida_id: number;
  cliente_id: number;
  cliente_nombre: string;
  lote_id: number;
  lote_numero: string;
  producto_nombre: string;
  fecha_entrega: string;
  fecha_reclamo: string;
  motivo: MotivoReclamo;
  motivo_label: string;
  detalle: string | null;
  dias_desde_entrega: number;
  plazo_referencia_dias: number;
  fuera_de_plazo: boolean;
  incidente_id: number | null;
  incidente_estado: "abierto" | "cerrado" | null;
}

/** Datos de la salida que se muestran en la ficha del reclamo. */
export interface ReclamoSalida {
  id: number;
  fecha_entrega: string;
  fecha_despacho: string | null;
  cantidad: string;
  unidad_medida: string;
  producto_nombre: string;
  lote_numero: string;
}

/** Incidente vinculado, con su resolución si ya se cerró. */
export interface ReclamoIncidente {
  id: number;
  estado: "abierto" | "cerrado";
  foto_url: string | null;
  fecha_cierre: string | null;
  observacion_cierre: string | null;
  responsable_cierre_nombre: string | null;
}

/** Ficha completa tal como la devuelve `GET /reclamos/{id}`. */
export interface ReclamoDetalle extends ReclamoResumen {
  registrado_por_nombre: string | null;
  fecha_registro: string | null;
  salida: ReclamoSalida;
  incidente: ReclamoIncidente | null;
}

export interface ReclamoCreateValues {
  salida_id: number;
  motivo: MotivoReclamo;
  detalle: string;
  fecha_reclamo: string;
}

/** Reclamo incluido en la ficha de una salida (`Salida.reclamos`). */
export interface SalidaReclamoResumen {
  id: number;
  fecha_reclamo: string;
  motivo: MotivoReclamo;
  motivo_label: string | null;
  incidente_estado: "abierto" | "cerrado" | null;
  fuera_de_plazo: boolean;
}
