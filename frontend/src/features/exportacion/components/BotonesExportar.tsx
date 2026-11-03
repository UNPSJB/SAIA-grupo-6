/** Botones de exportación, igual que la página de Auditoría.

Se coloca debajo de los filtros (dentro de la Tarjeta de filtros), no en el
PageHeader.actions. Renderiza: Exportar CSV y Exportar PDF.

Ejemplo de uso:
    <BotonesExportar
      nombreTabla="personal"
      filtros={filtrosActuales}
    />
*/

import { useState } from "react";
import { Button, Flex } from "@chakra-ui/react";
import { exportarTabla, exportarVista } from "../services/exportacionService";
import type { FormatoExport, FiltrosExport } from "../types/exportacion";

interface BotonesExportarProps {
  /** __tablename__ de la tabla a exportar (ej. "personal", "equipos"). */
  nombreTabla: string;
  /** Si se indica, exporta esa vista calculada (ej. "vencimientos") en vez de una tabla. */
  vista?: string;
  /** Filtros actuales que se enviaron al backend. */
  filtros: FiltrosExport;
}

export function BotonesExportar({
  nombreTabla,
  vista,
  filtros,
}: BotonesExportarProps) {
  const [exportando, setExportando] = useState<FormatoExport | null>(null);

  const exportar = async (formato: FormatoExport) => {
    setExportando(formato);
    try {
      await (vista
        ? exportarVista(vista, formato, filtros)
        : exportarTabla(nombreTabla, formato, filtros));
    } catch {
      // eslint-disable-next-line no-alert
      alert(`No se pudo exportar ${nombreTabla}`);
    } finally {
      setExportando(null);
    }
  };

  return (
    <Flex gap="2" flexWrap="wrap">
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
