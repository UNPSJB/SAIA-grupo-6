import { apiFetchImagen } from "../../../common/api/apiClient";
import { obtenerConfiguracionPyme } from "../../configuracion/services/configuracionService";

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
 * Lee los datos de identidad de la Pyme y los usa como cabecera. Si todavía no
 * se cargaron (o la consulta falla), cae en la cabecera del sistema para que la
 * descarga nunca se rompa.
 */
export async function obtenerCabecera(): Promise<CabeceraExportacion> {
  try {
    const pyme = await obtenerConfiguracionPyme();
    const lineas = [
      pyme.domicilio,
      pyme.telefono,
      pyme.email,
      pyme.web,
      pyme.rnpa_rppa ? `RNPA/RPPA: ${pyme.rnpa_rppa}` : null,
    ]
      .map((linea) => linea?.trim() ?? "")
      .filter((linea) => linea !== "");

    if (!pyme.razon_social?.trim() && lineas.length === 0) {
      return { ...CABECERA_DEL_SISTEMA, lineas: [...CABECERA_DEL_SISTEMA.lineas] };
    }

    let logo: string | undefined;
    if (pyme.logo_url) {
      // El endpoint de uploads exige sesión: se baja con el token y se usa como blob.
      logo = await apiFetchImagen(pyme.logo_url).catch(() => undefined);
    }

    return {
      nombre: pyme.razon_social?.trim() || CABECERA_DEL_SISTEMA.nombre,
      lineas,
      logo,
    };
  } catch {
    return { ...CABECERA_DEL_SISTEMA, lineas: [...CABECERA_DEL_SISTEMA.lineas] };
  }
}

/** Los renglones de texto de la cabecera, del nombre hacia abajo y sin renglones vacíos. */
export function textoCabecera(cabecera: CabeceraExportacion): string[] {
  return [cabecera.nombre, ...cabecera.lineas]
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");
}
