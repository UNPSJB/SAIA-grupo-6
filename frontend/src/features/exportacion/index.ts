export { BotonesExportar } from "./components/BotonesExportar";
export { exportarTabla } from "./services/exportacionService";
export type { TablaExport, FormatoExport, FiltrosExport } from "./types/exportacion";


export { nombreArchivoGrafico, slugDeTitulo } from "./services/nombreArchivoGrafico";
export type { FormatoDescarga, RangoGrafico } from "./services/nombreArchivoGrafico";
export { obtenerCabecera, textoCabecera } from "./services/cabeceraExportacion";
export type { CabeceraExportacion } from "./services/cabeceraExportacion";


export { descargarGrafico, ATRIBUTO_NO_EXPORTAR } from "./services/descargaGrafico";
export type { OpcionesDescarga } from "./services/descargaGrafico";

export { BotonDescargaGrafico } from "./components/BotonDescargaGrafico";