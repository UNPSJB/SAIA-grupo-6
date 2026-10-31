export interface Proveedor {
  id: number;
  nombre: string;
  matricula: string;
  activo: boolean;
}

export type ProveedorFormValues = Omit<Proveedor, "id" | "activo">;
