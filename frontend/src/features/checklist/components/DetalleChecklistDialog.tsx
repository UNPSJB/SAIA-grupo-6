import { useEffect, useState } from "react";
import { Badge, Box, HStack, Image, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import { useImagenAutenticada } from "../../../common/hooks/useImagenAutenticada";
import {
  BannerError,
  BotonCancelar,
  BotonTexto,
  EstadoCargando,
  EstadoVacio,
  Tarjeta,
} from "../../../components/ui/patrones";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import { obtenerDetalleChecklist } from "../services/checklistService";
import type {
  DetalleChecklistResponse,
  HistorialChecklistItem,
} from "../types/checklist";

interface DetalleChecklistDialogProps {
  isOpen: boolean;
  checklist: HistorialChecklistItem | null;
  onClose: () => void;
}

interface CargaDetalle {
  checklistId: number;
  detalle: DetalleChecklistResponse | null;
  error: string | null;
}

interface EvidenciaSeleccionada {
  checklistId: number;
  ruta: string;
}

function valorRegistrado(valor: string | number | null | undefined): string | number {
  return valor ?? "No registrado";
}

function formatoFechaHora(fecha: string | null | undefined): string {
  if (!fecha) return "No registrado";
  return new Date(fecha).toLocaleString();
}

/** Vista de solo lectura para la fotografía histórica de un checklist. */
export function DetalleChecklistDialog({
  isOpen,
  checklist,
  onClose,
}: DetalleChecklistDialogProps) {
  const [carga, setCarga] = useState<CargaDetalle | null>(null);
  const [evidenciaSeleccionada, setEvidenciaSeleccionada] =
    useState<EvidenciaSeleccionada | null>(null);
  const evidenciaActiva =
    isOpen &&
    evidenciaSeleccionada &&
    evidenciaSeleccionada.checklistId === checklist?.checklist_id
      ? evidenciaSeleccionada.ruta
      : null;
  const imagen = useImagenAutenticada(evidenciaActiva);

  useEffect(() => {
    if (!isOpen || !checklist) return;

    let vigente = true;

    obtenerDetalleChecklist(checklist.checklist_id)
      .then((detalle) => {
        if (vigente) {
          setCarga({
            checklistId: checklist.checklist_id,
            detalle,
            error: null,
          });
        }
      })
      .catch((err) => {
        if (!vigente) return;
        setCarga({
          checklistId: checklist.checklist_id,
          detalle: null,
          error:
            err instanceof Error
              ? err.message
              : "No se pudo cargar el detalle del checklist.",
        });
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, checklist]);

  if (!isOpen || !checklist) return null;

  // La respuesta sólo se usa si corresponde al checklist que sigue seleccionado.
  const cargando = !carga || carga.checklistId !== checklist.checklist_id;
  const detalle = cargando ? null : carga.detalle;
  const error = cargando ? null : carga.error;

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="960px"
        maxW="95vw"
        maxH="90vh"
        display="flex"
        flexDirection="column"
      >
        <DialogTitle fontSize="lg" fontWeight="bold" color="fg" mb="4">
          Detalle del checklist
        </DialogTitle>

        <Box overflowY="auto" pr="1">
          {cargando ? (
            <EstadoCargando>Cargando detalle del checklist...</EstadoCargando>
          ) : error ? (
            <BannerError>{error}</BannerError>
          ) : detalle ? (
            <Stack gap="5">
              <Tarjeta p="4">
                <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4">
                  <Box>
                    <Text fontSize="xs" color="fg.muted">Fecha</Text>
                    <Text fontWeight="bold">{detalle.fecha}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted">Equipo</Text>
                    <Text fontWeight="bold">{detalle.equipo_nombre}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted">Estado general</Text>
                    <Badge
                      colorPalette={detalle.estado === "cerrado" ? "green" : "orange"}
                      rounded="md"
                      px="2"
                      py="1"
                      textTransform="capitalize"
                    >
                      {detalle.estado}
                    </Badge>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted">Cumplimiento</Text>
                    <Text fontWeight="bold">
                      {detalle.porcentaje_cumplimiento.toFixed(0)}% ({detalle.tareas_completadas}/
                      {detalle.total_tareas})
                    </Text>
                  </Box>
                </SimpleGrid>
              </Tarjeta>

              {detalle.tareas.length === 0 ? (
                <EstadoVacio>No hay tareas registradas en este checklist.</EstadoVacio>
              ) : (
                detalle.tareas.map((tarea) => {
                  const evidenciaVisible = evidenciaActiva === tarea.evidencia_url;

                  return (
                    <Tarjeta key={tarea.registro_id} p="4">
                      <HStack justify="space-between" align="flex-start" gap="4" mb="3">
                        <Box>
                          <Text fontWeight="bold" color="fg">{tarea.nombre}</Text>
                          <Text mt="1" fontSize="sm" color="fg.muted" whiteSpace="pre-line">
                            {valorRegistrado(tarea.descripcion)}
                          </Text>
                        </Box>
                        <Badge
                          flexShrink={0}
                          colorPalette={tarea.completado ? "green" : "red"}
                          rounded="md"
                          px="2"
                          py="1"
                        >
                          {tarea.completado ? "Completada" : "Incumplida"}
                        </Badge>
                      </HStack>

                      {!tarea.completado &&
                        (tarea.fecha_completado || tarea.usuario_nombre) && (
                          <Text fontSize="xs" color="fg.muted" mb="3">
                            La tarea figura actualmente como incumplida. La fecha y el
                            responsable conservados corresponden a su último registro de
                            realización.
                          </Text>
                        )}

                      <SimpleGrid columns={{ base: 1, md: 2 }} gapX="6" gapY="3" fontSize="sm">
                        <Box>
                          <Text color="fg.muted">Fecha y hora de realización</Text>
                          <Text>{formatoFechaHora(tarea.fecha_completado)}</Text>
                        </Box>
                        <Box>
                          <Text color="fg.muted">Responsable registrado</Text>
                          <Text>{valorRegistrado(tarea.usuario_nombre)}</Text>
                        </Box>
                        <Box>
                          <Text color="fg.muted">Insumo químico</Text>
                          <Text>{valorRegistrado(tarea.insumo_quimico_nombre)}</Text>
                        </Box>
                        <Box>
                          <Text color="fg.muted">Cantidad consumida</Text>
                          <Text>{valorRegistrado(tarea.cantidad_consumida)}</Text>
                        </Box>
                        <Box>
                          <Text color="fg.muted">Unidad de medida</Text>
                          <Text>{valorRegistrado(tarea.unidad_medida_simbolo)}</Text>
                        </Box>
                        <Box>
                          <Text color="fg.muted">Elemento de limpieza</Text>
                          <Text>{valorRegistrado(tarea.elemento_limpieza_nombre)}</Text>
                        </Box>
                      </SimpleGrid>

                      <Box mt="4">
                        <Text fontSize="sm" color="fg.muted" mb="1">Evidencia fotográfica</Text>
                        {tarea.evidencia_url ? (
                          <>
                            <BotonTexto
                              onClick={() => {
                                if (evidenciaVisible) {
                                  setEvidenciaSeleccionada(null);
                                } else if (tarea.evidencia_url) {
                                  setEvidenciaSeleccionada({
                                    checklistId: checklist.checklist_id,
                                    ruta: tarea.evidencia_url,
                                  });
                                }
                              }}
                            >
                              {evidenciaVisible ? "Ocultar evidencia" : "Ver evidencia"}
                            </BotonTexto>
                            {evidenciaVisible && (
                              <Box mt="3">
                                {imagen.loading && (
                                  <EstadoCargando>Cargando imagen...</EstadoCargando>
                                )}
                                {!imagen.loading && imagen.error && (
                                  <Text color="red.fg" fontSize="sm" role="alert">
                                    {imagen.error}
                                  </Text>
                                )}
                                {imagen.src && (
                                  <Image
                                    src={imagen.src}
                                    alt={`Evidencia de la tarea ${tarea.nombre}`}
                                    maxW="100%"
                                    maxH="60vh"
                                    objectFit="contain"
                                    rounded="lg"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                  />
                                )}
                              </Box>
                            )}
                          </>
                        ) : (
                          <Text fontSize="sm">Sin evidencia</Text>
                        )}
                      </Box>
                    </Tarjeta>
                  );
                })
              )}
            </Stack>
          ) : null}
        </Box>

        <HStack justify="flex-end" mt="5">
          <BotonCancelar onClick={onClose}>Cerrar</BotonCancelar>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}
