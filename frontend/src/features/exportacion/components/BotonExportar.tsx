/** Botón "Exportar" de las tablas: un solo botón que abre un menú con CSV y PDF.

Antes eran dos botones sueltos ("Exportar CSV" y "Exportar PDF") que ocupaban
el doble de lugar en la barra de filtros. Va en `herramientas` de
`BarraFiltros`, junto a "Actualizar", no en las acciones de la página.

Tres formas de decirle qué exportar (se usa una sola):

  * `nombreTabla` (+ `vista`) + `filtros`: el backend arma las filas, de una
    tabla cruda (`GET /exportacion/{tabla}`) o de una vista calculada
    (`GET /exportacion/vistas/{vista}`), con los mismos filtros que la tabla.
  * `datos`: para tablas sin vista en el backend. Es una función que devuelve
    las filas filtradas tal como se ven (todas las páginas, no solo la
    visible); el backend solo les da formato (`POST /exportacion/filas`). Se
    llama recién al elegir el formato, así no se arma nada en cada render.
  * `exportar`: una descarga propia de la pantalla (la de Auditoría).

Ejemplos:
    <BotonExportar nombreTabla="personal" filtros={{ activo: "true" }} />
    <BotonExportar nombreTabla="reclamos" datos={() => ({ titulo, nombre, encabezados, filas })} />
*/

import { useState } from "react";
import { Box, Button, Menu, Portal, Text } from "@chakra-ui/react";
import { LuChevronDown, LuDownload, LuFileSpreadsheet, LuFileText } from "react-icons/lu";
import { toaster } from "../../../components/ui/toaster";
import { exportarFilas, exportarTabla, exportarVista } from "../services/exportacionService";
import type { DatosExport, FiltrosExport, FormatoExport } from "../types/exportacion";

interface BotonExportarProps {
  /** Qué se exporta, para el mensaje de error (y el nombre de la tabla cruda). */
  nombreTabla: string;
  /** Vista calculada del backend (ej. "vencimientos") en vez de la tabla cruda. */
  vista?: string;
  /** Filtros actuales, tal como los espera el backend. */
  filtros?: FiltrosExport;
  /** Filas armadas en el frontend (tablas sin vista en el backend). */
  datos?: () => DatosExport;
  /** Descarga propia de la pantalla. */
  exportar?: (formato: FormatoExport) => Promise<void>;
  /** Deshabilita el botón (por ejemplo, sin filas que exportar). */
  disabled?: boolean;
}

const FORMATOS: { valor: FormatoExport; etiqueta: string; ayuda: string; icono: typeof LuFileText }[] = [
  { valor: "csv", etiqueta: "CSV", ayuda: "Para abrir en Excel", icono: LuFileSpreadsheet },
  { valor: "pdf", etiqueta: "PDF", ayuda: "Para imprimir o compartir", icono: LuFileText },
];

export function BotonExportar({
  nombreTabla,
  vista,
  filtros = {},
  datos,
  exportar,
  disabled,
}: BotonExportarProps) {
  const [exportando, setExportando] = useState<FormatoExport | null>(null);

  const descargar = async (formato: FormatoExport) => {
    setExportando(formato);
    try {
      if (exportar) await exportar(formato);
      else if (datos) await exportarFilas(datos(), formato);
      else if (vista) await exportarVista(vista, formato, filtros);
      else await exportarTabla(nombreTabla, formato, filtros);
    } catch (e) {
      toaster.create({
        type: "error",
        title: `No se pudo exportar ${nombreTabla}`,
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setExportando(null);
    }
  };

  return (
    <Menu.Root
      positioning={{ placement: "bottom-end" }}
      onSelect={(detalle) => void descargar(detalle.value as FormatoExport)}
    >
      <Menu.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          loading={exportando !== null}
          loadingText="Exportando..."
          disabled={disabled}
        >
          <LuDownload aria-hidden />
          Exportar
          <LuChevronDown aria-hidden />
        </Button>
      </Menu.Trigger>
      {/* Portal: el menú se dibuja fuera de la tarjeta, sin que nada lo recorte. */}
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="220px">
            {FORMATOS.map(({ valor, etiqueta, ayuda, icono: Icono }) => (
              <Menu.Item key={valor} value={valor} py="2">
                <Icono size={16} aria-hidden />
                <Box>
                  <Text fontWeight="medium">{etiqueta}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {ayuda}
                  </Text>
                </Box>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
