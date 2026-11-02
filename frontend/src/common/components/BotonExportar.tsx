import { useState } from "react";
import { Button, Menu, Portal, Text } from "@chakra-ui/react";
import { LuDownload, LuFileSpreadsheet, LuFileText } from "react-icons/lu";
import {
  exportarExcel,
  exportarPdf,
  type ColumnaExport,
  type OpcionesExport,
} from "../export/exportar";

interface BotonExportarProps<T> {
  columnas: ColumnaExport<T>[];
  opciones: OpcionesExport;
  /**
   * Devuelve TODAS las filas a exportar, no solo la página que se ve. En una
   * tabla con paginación del servidor, es la llamada que trae la lista
   * completa.
   */
  obtenerFilas: () => Promise<T[]> | T[];
}

type Formato = "pdf" | "excel";

export function BotonExportar<T>({
  columnas,
  opciones,
  obtenerFilas,
}: BotonExportarProps<T>) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportar = async (formato: Formato) => {
    setError(null);
    setExportando(true);

    try {
      const filas = await obtenerFilas();

      if (filas.length === 0) {
        setError("No hay datos para exportar.");
        return;
      }

      if (formato === "pdf") {
        await exportarPdf(filas, columnas, opciones);
      } else {
        await exportarExcel(filas, columnas, opciones);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el archivo.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <Menu.Root
        positioning={{ placement: "bottom-end" }}
        onSelect={(detalle) => void exportar(detalle.value as Formato)}
      >
        <Menu.Trigger asChild>
          <Button variant="outline" colorPalette="brand" loading={exportando}>
            <LuDownload aria-hidden />
            Exportar
          </Button>
        </Menu.Trigger>

        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="160px">
              <Menu.Item value="pdf">
                <LuFileText size={16} aria-hidden />
                PDF
              </Menu.Item>
              <Menu.Item value="excel">
                <LuFileSpreadsheet size={16} aria-hidden />
                Excel
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {error && (
        <Text role="alert" fontSize="xs" color="fg.error">
          {error}
        </Text>
      )}
    </>
  );
}