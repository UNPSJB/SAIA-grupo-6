import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  HStack,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuTriangleAlert } from "react-icons/lu";
import { formatoFecha } from "../../../common/utils/fechas";
import { formatoCantidad } from "../../../common/utils/numeros";
import {
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  TarjetaTabla,
} from "../../../components/ui/patrones";
import type { Reposicion } from "../types/reposicion";
import { ModalResumenRetiro } from "./ModalResumenRetiro";
import { ModalResumenSalida } from "./ModalResumenSalida";
import { ModalResumenReclamo } from "./ModalResumenReclamo";

interface ReposicionesTableProps {
  reposiciones: Reposicion[];
  pie?: ReactNode;
  onReponer: (reposicion: Reposicion) => void;
}

/**
 * Link subrayado de la columna Origen. Abre la vista rápida del registro que
 * originó la deuda (retiro, salida o reclamo) desde donde se puede saltar al
 * detalle completo.
 */
function EnlaceOrigen({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

export function ReposicionesTable({
  reposiciones,
  pie,
  onReponer,
}: ReposicionesTableProps) {
  const [retiroResumenId, setRetiroResumenId] = useState<number | null>(null);
  const [selectedSalidaId, setSelectedSalidaId] = useState<number | null>(null);
  const [selectedIncidenteId, setSelectedIncidenteId] = useState<
    number | null
  >(null);

  return (
    <>
      <TarjetaTabla pie={pie}>
        <Table.Root variant="outline" w="100%" minW="940px">
          <Table.Header>
            <FilaEncabezado>
              <EncabezadoOscuro width="11%">Prioridad</EncabezadoOscuro>
              <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
              <EncabezadoOscuro width="22%">Cliente</EncabezadoOscuro>
              <EncabezadoOscuro width="20%">Producto</EncabezadoOscuro>
              <EncabezadoOscuro numero textAlign="right" width="15%">
                Cantidad Pendiente
              </EncabezadoOscuro>
              <EncabezadoOscuro width="14%">Origen</EncabezadoOscuro>
              <EncabezadoOscuro center width="12%">Acciones</EncabezadoOscuro>
            </FilaEncabezado>
          </Table.Header>
          <Table.Body>
            {reposiciones.map((repo) => {
              const esAlta = repo.prioridad === "ALTA";
              const esRetiro = repo.origen === "RETIRO_LOTE";
              const esReclamo = repo.origen === "POR_RECLAMO";
              const esParcial = repo.estado === "PARCIAL";
              const productoConUnidad = repo.producto as {
                id: number;
                nombre: string;
                unidad_medida?: string | { simbolo?: string } | null;
              } | undefined;
              const unidadRaw = productoConUnidad?.unidad_medida;
              const unidad =
                typeof unidadRaw === "string" && unidadRaw.trim()
                  ? unidadRaw.trim()
                  : typeof unidadRaw === "object" &&
                    unidadRaw !== null &&
                    unidadRaw.simbolo
                  ? unidadRaw.simbolo
                  : "u";

              return (
                <Table.Row key={repo.id}>
                  <Celda verticalAlign="middle" whiteSpace="nowrap">
                    {esAlta ? (
                      <Badge colorPalette="red" variant="solid" size="sm">
                        <HStack gap="1" as="span">
                          <LuTriangleAlert size={12} />
                          <span>ALTA</span>
                        </HStack>
                      </Badge>
                    ) : (
                      <Badge colorPalette="blue" variant="subtle" size="sm">
                        NORMAL
                      </Badge>
                    )}
                  </Celda>

                  <Celda verticalAlign="middle" whiteSpace="nowrap">
                    {formatoFecha(repo.fecha_registro)}
                  </Celda>

                  <Celda verticalAlign="middle">
                    <Text fontWeight="semibold" color="fg">
                      {repo.cliente?.nombre ?? `Cliente #${repo.cliente_id}`}
                    </Text>
                  </Celda>

                  <Celda verticalAlign="middle">
                    <Text fontWeight="medium" color="fg">
                      {repo.producto?.nombre ?? `Producto #${repo.producto_id}`}
                    </Text>
                  </Celda>

                  <Celda
                    verticalAlign="middle"
                    numero
                    textAlign="right"
                    whiteSpace="nowrap"
                  >
                    <VStack align="end" justifyContent="flex-end" gap={0}>
                      <Text
                        fontWeight="bold"
                        textAlign="right"
                        color={esAlta ? "red.fg" : "fg"}
                      >
                        {formatoCantidad(repo.cantidad_pendiente)} {unidad}
                      </Text>
                      {esParcial && (
                        <Text fontSize="xs" textAlign="right" color="fg.muted">
                          de {formatoCantidad(repo.cantidad_original)} {unidad} orig.
                        </Text>
                      )}
                    </VStack>
                  </Celda>

                  <Celda verticalAlign="middle" whiteSpace="nowrap">
                    {esRetiro ? (
                      <VStack align="start" gap={0.5}>
                        <Badge colorPalette="orange" variant="subtle" size="sm">
                          Por Retiro
                        </Badge>
                        {repo.retiro_origen_id && (
                          <EnlaceOrigen
                            onClick={() =>
                              setRetiroResumenId(repo.retiro_origen_id)
                            }
                          >
                            Retiro #{repo.retiro_origen_id}
                          </EnlaceOrigen>
                        )}
                      </VStack>
                    ) : esReclamo ? (
                      <VStack align="start" gap={0.5}>
                        <Badge colorPalette="blue" variant="subtle" size="sm">
                          Por Reclamo
                        </Badge>
                        {repo.incidente_origen_id && (
                          <EnlaceOrigen
                            onClick={() =>
                              setSelectedIncidenteId(repo.incidente_origen_id)
                            }
                          >
                            Reclamo #{repo.incidente_origen_id}
                          </EnlaceOrigen>
                        )}
                      </VStack>
                    ) : (
                      <VStack align="start" gap={0.5}>
                        <Badge colorPalette="purple" variant="subtle" size="sm">
                          Rechazo entrega
                        </Badge>
                        {repo.salida_origen_id && (
                          <EnlaceOrigen
                            onClick={() =>
                              setSelectedSalidaId(repo.salida_origen_id)
                            }
                          >
                            Salida #{repo.salida_origen_id}
                          </EnlaceOrigen>
                        )}
                      </VStack>
                    )}
                  </Celda>

                  <Celda verticalAlign="middle" center whiteSpace="nowrap">
                      <BotonAccion
                        accion="reponer"
                        label="Iniciar reposición"
                        tooltip="Iniciar reposición de stock"
                        onClick={() => onReponer(repo)}
                      />
                    </Celda>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </TarjetaTabla>

      <ModalResumenRetiro
        retiroId={retiroResumenId}
        isOpen={retiroResumenId !== null}
        onClose={() => setRetiroResumenId(null)}
      />

      <ModalResumenSalida
        salidaId={selectedSalidaId}
        isOpen={selectedSalidaId !== null}
        onClose={() => setSelectedSalidaId(null)}
      />

      <ModalResumenReclamo
        incidenteId={selectedIncidenteId}
        isOpen={selectedIncidenteId !== null}
        onClose={() => setSelectedIncidenteId(null)}
      />
    </>
  );
}
