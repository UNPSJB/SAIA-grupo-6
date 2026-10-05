export type TipoPlanCalibracionMantenimiento =
  | "calibracion"
  | "mantenimiento";

export interface PlanCalibracionMantenimiento {
  id: number;
  equipo_id: number;
  autor_id: number;
  tipo: TipoPlanCalibracionMantenimiento;
  fecha_ultima_intervencion: string;
  periodicidad_dias: number;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  proxima_fecha_vencimiento: string;
  dias_restantes: number;
}

export interface PlanCalibracionMantenimientoFormValues {
  equipo_id: number;
  tipo: TipoPlanCalibracionMantenimiento;
  fecha_ultima_intervencion: string;
  periodicidad_dias: number;
}

export interface PlanCalibracionMantenimientoCreate
  extends PlanCalibracionMantenimientoFormValues {
  autor_id: number;
}

export type PlanCalibracionMantenimientoUpdate =
  Partial<PlanCalibracionMantenimientoFormValues>;
