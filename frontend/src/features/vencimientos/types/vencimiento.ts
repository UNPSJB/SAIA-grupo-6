export type TipoVencimiento = "PERSONAL" | "CALIBRACION" | "MANTENIMIENTO" | "DOCUMENTO";


export type EstadoVencimiento = "VENCIDO" | "PROXIMO" | "VIGENTE";

export const TIPOS_VENCIMIENTO: { value: TipoVencimiento; label: string }[] = [
  { value: "PERSONAL", label: "Personal" },
  { value: "CALIBRACION", label: "Calibración" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "DOCUMENTO", label: "Documento" },
];

/** Estados con los que se puede filtrar el consolidado. */
export const ESTADOS_VENCIMIENTO: { value: EstadoVencimiento; label: string }[] = [
  { value: "VENCIDO", label: "Vencido" },
  { value: "PROXIMO", label: "Próximo a vencer" },
  { value: "VIGENTE", label: "Vigente" },
];


export interface VencimientoConsolidado {
  id_vencimiento: string;
  tipo: TipoVencimiento;
  entidad_id: number;
  sujeto_id: number;
  detalle: string;
  sujeto: string;
  fecha_vencimiento: string;
  dias_restantes: number;
  estado: EstadoVencimiento;
  link_destino: string;
}
