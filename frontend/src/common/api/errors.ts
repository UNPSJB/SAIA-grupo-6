// Error específico para cuando el backend devuelve 409 porque el dato único
// (dni, email, nombre, número de serie, etc.) ya pertenece a un registro dado
// de baja lógicamente. No es un error de negocio común: el frontend puede
// usar `entidadId` para ofrecerle al usuario reactivar ese registro en vez
// de simplemente mostrar un cartel de error.
//
// Reutilizable por cualquier feature con baja lógica (Personal, Equipo,
// Insumos): solo se necesita que el service de esa entidad detecte el 409
// y lance esta misma clase.
export class ConflictoInactivoError extends Error {
  entidadId: number;
  campo: string;
 
  constructor(message: string, entidadId: number, campo: string) {
    super(message);
    this.name = "ConflictoInactivoError";
    this.entidadId = entidadId;
    this.campo = campo;
  }
}
 