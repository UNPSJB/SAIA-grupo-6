import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
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
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { obtenerSalida } from "../../salidas/services/salidaService";
import { ESTADOS_SALIDA, type Salida } from "../../salidas/types/salida";

export interface ModalResumenSalidaProps {
  salidaId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalResumenSalida({
  salidaId,
  isOpen,
  onClose,
}: ModalResumenSalidaProps) {
  const navigate = useNavigate();
  const [salida, setSalida] = useState<Salida | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !salidaId) {
      setSalida(null);
      setError(null);
      return;
    }

    let vigente = true;
    setCargando(true);
    setError(null);

    void obtenerSalida(salidaId)
      .then((datos) => {
        if (vigente) setSalida(datos);
      })
      .catch((err) => {
        if (vigente) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el contexto de la salida."
          );
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, salidaId]);

  if (!isOpen || !salidaId) return null;

  const estadoEtiqueta =
    ESTADOS_SALIDA.find((e) => e.valor === salida?.estado)?.etiqueta ??
    salida?.estado ??
    "—";

  const colorEstado =
    salida?.estado === "ENTREGADO" || salida?.estado === "DESPACHADO"
      ? "green"
      : salida?.estado === "RECHAZADA" || salida?.estado === "CANCELADO"
      ? "red"
      : "blue";

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
            Contexto de la Salida #{salidaId}
          </DialogTitle>
          {salida && (
            <Badge colorPalette={colorEstado} variant="subtle" size="sm">
              {estadoEtiqueta}
            </Badge>
          )}
        </Flex>
        <Text fontSize="xs" color="fg.muted" mb="4">
          Vista rápida de la entrega / salida asociada a esta reposición pendiente.
        </Text>

        {cargando && (
          <Flex py="8" justify="center" align="center" gap="3">
            <Spinner size="md" color="brand.500" />
            <Text fontSize="sm" color="fg.muted">
              Cargando información de la salida...
            </Text>
          </Flex>
        )}

        {!cargando && error && <MensajeError>{error}</MensajeError>}

        {!cargando && !error && salida && (
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
                  Cliente
                </Text>
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  {salida.cliente_nombre}
                </Text>
              </Box>

              <Box>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  Producto / Lote
                </Text>
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  {salida.producto_nombre} -{" "}
                  <Text as="span" fontFamily="mono">
                    {salida.lote_numero}
                  </Text>{" "}
                  ({cantidadConUnidad(salida.cantidad, salida.unidad_medida)})
                </Text>
              </Box>

              <HStack justify="space-between" flexWrap="wrap" gap="4">
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Fecha de entrega
                  </Text>
                  <Text fontSize="sm" color="fg">
                    {formatoFecha(
                      salida.fecha_entrega ??
                        salida.fecha_despacho ??
                        salida.fecha_reserva
                    )}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Estado de la salida
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" color="fg">
                    {estadoEtiqueta}
                  </Text>
                </Box>
              </HStack>

              {salida.observacion_entrega && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Observación de entrega
                  </Text>
                  <Text fontSize="xs" color="fg" mt="0.5">
                    {salida.observacion_entrega}
                  </Text>
                </Box>
              )}

              {salida.motivo_rechazo_label && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Motivo del rechazo
                  </Text>
                  <Text fontSize="xs" color="fg" mt="0.5">
                    {salida.motivo_rechazo_label}
                    {salida.detalle_rechazo ? ` · ${salida.detalle_rechazo}` : ""}
                  </Text>
                </Box>
              )}
            </VStack>
          </Box>
        )}

        <AccionesFormulario>
          <Button
            type="button"
            colorPalette="teal"
            variant="solid"
            onClick={() => {
              onClose();
              navigate(`/salidas/${salidaId}/detalle`);
            }}
          >
            Ver detalle completo
          </Button>
          <BotonCancelar onClick={onClose}>Cerrar</BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}
