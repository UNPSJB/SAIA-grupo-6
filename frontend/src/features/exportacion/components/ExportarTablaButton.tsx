/** Botón simple de exportación para cualquier listado de tabla.

Se coloca en el `actions` del `PageHeader` de cada página, igual que lo hace
la página de Auditoría. Descarga la tabla completa en CSV usando el endpoint
genérico del backend `GET /exportacion/{tabla}?formato=csv`.

Ejemplo de uso:
    <ExportarTablaButton nombreTabla="personal" />
    <ExportarTablaButton nombreTabla="equipos" />
*/

import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { LuDownload } from "react-icons/lu";
import { exportarTabla } from "../services/exportacionService";
import type { FormatoExport, FiltrosExport } from "../types/exportacion";

interface ExportarTablaButtonProps {
  /** __tablename__ de la tabla a exportar (ej. "personal", "equipos"). */
  nombreTabla: string;
  /** Etiqueta del botón (por defecto "Exportar CSV"). */
  label?: string;
  /** Formato de descarga: "csv" | "pdf". */
  formato?: FormatoExport;
  /** Filtros que se aplican al exportar (ej. { activo: "true" }). */
  filtros?: FiltrosExport;
  /** Tamaño del botón (sm | md | lg). */
  size?: "sm" | "md" | "lg";
}

export function ExportarTablaButton({
  nombreTabla,
  label = "Exportar CSV",
  formato = "csv",
  filtros = {},
  size = "sm",
}: ExportarTablaButtonProps) {
  const [cargando, setCargando] = useState(false);

  const handleExportar = async () => {
    setCargando(true);
    try {
      await exportarTabla(nombreTabla, formato, filtros);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error al exportar ${nombreTabla}:`, error);
      alert(`No se pudo exportar ${nombreTabla}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button
      size={size}
      leftIcon={<LuDownload size={14} />}
      isLoading={cargando}
      onClick={handleExportar}
    >
      {label}
    </Button>
  );
}
