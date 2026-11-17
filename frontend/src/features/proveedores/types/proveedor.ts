export interface CertificacionProveedor {
  id: number;
  proveedor_id: number;
  tipo: string;
  numero: string;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  archivo_url: string;
  fecha_carga: string;
  estado: "vigente" | "vencida";
}

export interface Proveedor {
  id: number;
  nombre: string;
  matricula: string;
  cuit: string | null;
  contacto: string | null;
  domicilio: string | null;
  rubro: string | null;
  es_certificado: boolean;
  activo: boolean;
  estado_certificacion: "vigente" | "vencida" | null;
  certificacion_vigente: CertificacionProveedor | null;
  certificaciones: CertificacionProveedor[];
  insumos: { id: number; nombre: string }[];
}

export type ProveedorFormValues = {
  nombre: string;
  cuit: string;
  contacto: string;
  domicilio: string;
  rubro: string;
  es_certificado: boolean;
};
