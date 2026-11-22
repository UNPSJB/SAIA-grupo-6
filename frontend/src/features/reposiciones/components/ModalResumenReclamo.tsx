import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, Flex, HStack, Spinner, Text, VStack } from "@chakra-ui/react";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BotonCancelar,
  MensajeError,
} from "../../../components/ui/patrones";
import { formatoFecha } from "../../../common/utils/fechas";
import * as incidenteService from "../../incidente/services/incidenteService";
import type { Incidente } from "../../incidente/types/incidente";
import { tipoLabel } from "../../incidente/types/incidente";

export interface ModalResumenReclamoProps {
  incidenteId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalResumenReclamo({
  incidenteId,
  isOpen,
  onClose,
}: ModalResumenReclamoProps) {
  const navigate = useNavigate();
  const [incidente, setIncidente] = useState<Incidente | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !incidenteId) {
      setIncidente(null);
      setError(null);
      return;
    }

    let vigente = true;
    setCargando(true);
    setError(null);

    void incidenteService
      .obtenerIncidente(incidenteId)
      .then((datos) => {
        if (vigente) setIncidente(datos);
      })
      .catch((err) => {
        if (vigente) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el contexto del reclamo."
          );
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, incidenteId]);

  if (!isOpen || !incidenteId) return null;

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape
      closeOnInteractOutside
    >
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="480px"
        maxWidth="92vw"
        maxHeight="85vh"
        overflowY="auto"
        textAlign="left"
      >
        <Flex justify="space-between" align="center" mb="1">
          <DialogTitle
            as="h3"
            mt={0}
            fontSize="lg"
            fontWeight="bold"
            color="brand.fg"
          >
            Contexto del Reclamo #{incidenteId}
          </DialogTitle>
          {incidente && (
            <Badge
              colorPalette={incidente.estado === "cerrado" ? "green" : "blue"}
              variant="subtle"
              size="sm"
            >
              {incidente.estado === "cerrado" ? "Cerrado" : "Abierto"}
            </Badge>
          )}
        </Flex>
        <Text fontSize="xs" color="fg.muted" mb="4">
          Vista rápida del reclamo que originó esta reposición pendiente.
        </Text>

        {cargando && (
          <Flex py="8" justify="center" align="center" gap="3">
            <Spinner size="md" color="brand.500" />
            <Text fontSize="sm" color="fg.muted">
              Cargando información del reclamo...
            </Text>
          </Flex>
        )}

        {!cargando && error && <MensajeError>{error}</MensajeError>}

        {!cargando && !error && incidente && (
          <Box
            p="4"
            bg="bg.muted"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="md"
            mb="4"
          >
            <VStack align="stretch" gap="3">
              <Box>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  Motivo del reclamo
                </Text>
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  {incidente.descripcion}
                </Text>
              </Box>

              <HStack justify="space-between" flexWrap="wrap" gap="4">
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Fecha del reclamo
                  </Text>
                  <Text fontSize="sm" color="fg">
                    {formatoFecha(incidente.fecha_reporte)}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Estado
                  </Text>
                  <Text fontSize="sm" color="fg">
                    {incidente.estado === "cerrado" ? "Cerrado" : "Abierto"}
                  </Text>
                </Box>
              </HStack>

              {incidente.tipo && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Tipo
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" color="fg">
                    {tipoLabel(incidente.tipo as any)}
                  </Text>
                </Box>
              )}

              {incidente.observacion_cierre && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Resolución
                  </Text>
                  <Text fontSize="xs" color="fg" mt="0.5">
                    {incidente.observacion_cierre}
                  </Text>
                </Box>
              )}
            </VStack>
          </Box>
        )}

        <AccionesFormulario>
          {incidente && (
            <Button
              type="button"
              colorPalette="teal"
              variant="solid"
              onClick={() => {
                onClose();
                navigate(`/incidentes/${incidenteId}`);
              }}
            >
              Ver detalle completo
            </Button>
          )}
          <BotonCancelar onClick={onClose}>Cerrar</BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}
