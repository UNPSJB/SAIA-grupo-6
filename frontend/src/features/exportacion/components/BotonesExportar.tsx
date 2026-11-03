/** Botones de exportación y limpieza, igual que la página de Auditoría.

Se coloca debajo de los filtros (dentro de la Tarjeta de filtros), no en el
PageHeader.actions. Renderiza: Limpiar, Exportar CSV y Exportar PDF.

Ejemplo de uso:
    <BotonesExportar
      nombreTabla="personal"
      filtros={filtrosActuales}
      onLimpiar={limpiarTodo}
      hayFiltros={hayFiltros}
    />
*/

import { useState } from "react";
import { Button, Flex } from "@chakra-ui/react";
import { exportarTabla } from "../services/exportacionService";
import type { FormatoExport, FiltrosExport } from "../types/exportacion";

interface BotonesExportarProps {
  /** __tablename__ de la tabla a exportar (ej. "personal", "equipos"). */
  nombreTabla: string;
  /** Filtros actuales que se enviaron al backend. */
  filtros: FiltrosExport;
  /** Función para limpiar los filtros (ya existe en cada página). */
  onLimpiar: () => void;
  /** Si hay filtros aplicados, para habilitar/deshabilitar "Limpiar". */
  hayFiltros?: boolean;
}

export function BotonesExportar({
  nombreTabla,
  filtros,
  onLimpiar,
  hayFiltros = false,
}: BotonesExportarProps) {
  const [exportando, setExportando] = useState<FormatoExport | null>(null);

  const exportar = async (formato: FormatoExport) => {
    setExportando(formato);
    try {
      await exportarTabla(nombreTabla, formato, filtros);
    } catch {
      // eslint-disable-next-line no-alert
      alert(`No se pudo exportar ${nombreTabla}`);
    } finally {
      setExportando(null);
    }
  };

  return (
    <Flex gap="2" flexWrap="wrap">
      <Button type="button" variant="outline" onClick={onLimpiar} disabled={!hayFiltros}>
        Limpiar
      </Button>
      {["csv", "pdf"].map((f) => (
        <Button
          key={f}
          type="button"
          variant="outline"
          onClick={() => exportar(f as FormatoExport)}
          loading={exportando === f}
          disabled={exportando !== null}
        >
          Exportar {f === "csv" ? "CSV" : "PDF"}
        </Button>
      ))}
    </Flex>
  );
}
