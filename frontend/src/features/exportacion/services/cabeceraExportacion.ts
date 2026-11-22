/**
 * Lo que encabeza un gráfico descargado, arriba del título y del rango de fechas.
 */
export interface CabeceraExportacion {
  /** Nombre que encabeza el archivo: el de la Pyme cuando exista el dato; hoy, el del sistema. */
  nombre: string;
  /** Renglones chicos debajo del nombre (por ejemplo CUIT o domicilio). Pueden estar vacíos. */
  lineas: string[];
  /** Logo como URL o data URL. Opcional. */
  logo?: string;
}

/** Cabecera que se usa mientras el sistema no tenga los datos de la Pyme. */
export const CABECERA_DEL_SISTEMA: CabeceraExportacion = {
  nombre: "SAIA",
  lineas: ["Sistema de apoyo a la inocuidad alimentaria"],
};

/**
 * ÚNICO lugar del que las descargas toman la cabecera.
 *
 * Hoy devuelve la del sistema, porque todavía no existen datos de la Pyme (nombre, logo,
 * domicilio). Cuando existan, solo hay que cambiar esta función para que los lea, por ejemplo
 * de un endpoint de configuración. Es asíncrona desde ahora para que ese cambio no obligue
 * a tocar a quien la usa.
 */
export async function obtenerCabecera(): Promise<CabeceraExportacion> {
  return { ...CABECERA_DEL_SISTEMA, lineas: [...CABECERA_DEL_SISTEMA.lineas] };
}

/** Los renglones de texto de la cabecera, del nombre hacia abajo y sin renglones vacíos. */
export function textoCabecera(cabecera: CabeceraExportacion): string[] {
  return [cabecera.nombre, ...cabecera.lineas]
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");
}
