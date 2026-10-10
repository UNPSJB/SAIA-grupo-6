export type TipoVencimiento = "PERSONAL" | "CALIBRACION" | "MANTENIMIENTO";

export type EstadoVencimiento = "VENCIDO" | "PROXIMO" | "VIGENTE";

export const TIPOS_VENCIMIENTO: { value: TipoVencimiento; label: string }[] = [
  { value: "PERSONAL", label: "Personal" },
  { value: "CALIBRACION", label: "Calibración" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
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
