import type { ReactNode } from "react";
import { Badge, Button, Flex, HStack, Table, Text, VStack } from "@chakra-ui/react";
import { LuTriangleAlert } from "react-icons/lu";
import { formatoFecha } from "../../../common/utils/fechas";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EtiquetaEstado,
  FilaClickeable,
  FilaEncabezado,
  ProgresoTareas,
  TarjetaTabla,
  TextoTruncado,
} from "../../../components/ui/patrones";
import type { RetiroResumen } from "../types/retiro";

interface RetirosTableProps {
  retiros: RetiroResumen[];
  /** Pie de la tarjeta (resumen y paginación, `PieTabla`). */
  pie?: ReactNode;
  onVerDetalle: (retiroId: number) => void;
  onSearchChange?: (text: string) => void;
}

/** Toda la fila abre el detalle; el botón "Ver detalle" queda para teclado y lectores. */
export function RetirosTable({
  retiros,
  pie,
  onVerDetalle,
  onSearchChange,
}: RetirosTableProps) {
  return (
    <TarjetaTabla pie={pie}>
      <Table.Root variant="outline" w="100%" minW="980px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
            <EncabezadoOscuro width="22%">Producto / Lote</EncabezadoOscuro>
            <EncabezadoOscuro width="16%">Origen</EncabezadoOscuro>
            <EncabezadoOscuro width="24%">Motivo</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="amplia">Notificados</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="media">Estado</EncabezadoOscuro>
            <EncabezadoOscuro center width="10%">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {retiros.map((retiro) => {
            const detalleTexto = retiro.detalle || "";
            const motivoTexto = retiro.motivo || "";
            const esInsumo =
              retiro.origen === "INSUMO" ||
              motivoTexto.toLowerCase().includes("insumo") ||
              detalleTexto.includes("[Insumo:") ||
              motivoTexto.includes("[Insumo:");

            const esReclamo =
              !esInsumo &&
              (retiro.origen === "RECLAMO" ||
                motivoTexto.toLowerCase().includes("reclamo") ||
                motivoTexto === "Reclamos de clientes");

            // Extraer el texto de insumo si está en formato "[Insumo: ...]"
            const matchInsumo = retiro.detalle
              ? retiro.detalle.match(/\[Insumo:\s*(.*?)\]/)
              : retiro.motivo
              ? retiro.motivo.match(/\[Insumo:\s*(.*?)\]/)
              : null;
            const textoInsumo = matchInsumo ? matchInsumo[1] : null;

            return (
              <FilaClickeable key={retiro.id} onAbrir={() => onVerDetalle(retiro.id)}>
                <Celda verticalAlign="top" whiteSpace="nowrap">
                  {formatoFecha(retiro.fecha_retiro)}
                </Celda>
                <Celda verticalAlign="top">
                  <DatoPrincipal titulo={retiro.lote_producto_nombre} codigo={retiro.lote_codigo} />
                </Celda>
                <Celda verticalAlign="top" whiteSpace="nowrap">
                  {esInsumo ? (
                    <VStack align="start" gap={0}>
                      <Badge colorPalette="orange" variant="subtle" size="sm">
                        <HStack gap="1" as="span">
                          <LuTriangleAlert size={12} />
                          <span>Por Insumo</span>
                        </HStack>
                      </Badge>
                      {textoInsumo && (
                        <Button
                          type="button"
                          variant="plain"
                          colorPalette="teal"
                          color="teal.600"
                          size="xs"
                          p={0}
                          h="auto"
                          minW={0}
                          fontWeight="medium"
                          textDecoration="underline"
                          textUnderlineOffset="2px"
                          _hover={{ color: "teal.800" }}
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            if (onSearchChange) {
                              onSearchChange(textoInsumo);
                            }
                          }}
                        >
                          {textoInsumo}
                        </Button>
                      )}
                    </VStack>
                  ) : esReclamo ? (
                    <Badge colorPalette="purple" variant="subtle" size="sm">
                      Por Reclamo
                    </Badge>
                  ) : (
                    <Badge colorPalette="gray" variant="subtle" size="sm">
                      Manual
                    </Badge>
                  )}
                </Celda>
                <Celda verticalAlign="top">
                  <TextoTruncado texto={retiro.motivo} />
                </Celda>
                <Celda verticalAlign="top" center whiteSpace="nowrap">
                  {retiro.total_afectados === 0 ? (
                    <Text color="gray.500" fontSize="sm">
                      Sin afectados
                    </Text>
                  ) : (
                    <ProgresoTareas hechas={retiro.notificados} total={retiro.total_afectados} />
                  )}
                </Celda>
                <Celda verticalAlign="top" center whiteSpace="nowrap">
                  <BadgeEstadoRetiro estado={retiro.estado} />
                </Celda>
                <Celda verticalAlign="top" center>
                  <Flex justify="center" gap="2" flexWrap="wrap">
                    <BotonAccion
                      accion="ver"
                      label="Ver detalle"
                      onClick={() => onVerDetalle(retiro.id)}
                    />
                  </Flex>
                </Celda>
              </FilaClickeable>
            );
          })}
        </Table.Body>
      </Table.Root>
    </TarjetaTabla>
  );
}

function BadgeEstadoRetiro({
  estado,
}: {
  estado: "EN_CURSO" | "CERRADO";
}) {
  const esCerrado = estado === "CERRADO";
  return (
    <EtiquetaEstado tono={esCerrado ? "ok" : "alerta"}>
      {esCerrado ? "Cerrado" : "En curso"}
    </EtiquetaEstado>
  );
}
