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
import * as retiroService from "../../retiros/services/retiroService";
import type { RetiroDetalle } from "../../retiros/types/retiro";

export interface ModalResumenRetiroProps {
  retiroId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalResumenRetiro({
  retiroId,
  isOpen,
  onClose,
}: ModalResumenRetiroProps) {
  const navigate = useNavigate();
  const [retiro, setRetiro] = useState<RetiroDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !retiroId) {
      setRetiro(null);
      setError(null);
      return;
    }

    let vigente = true;
    setCargando(true);
    setError(null);

    void retiroService
      .obtenerRetiro(retiroId)
      .then((datos) => {
        if (vigente) setRetiro(datos);
      })
      .catch((err) => {
        if (vigente) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el contexto del retiro."
          );
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, retiroId]);

  if (!isOpen || !retiroId) return null;

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
            Contexto del Retiro #{retiroId}
          </DialogTitle>
          {retiro && (
            <Badge
              colorPalette={retiro.estado === "CERRADO" ? "green" : "orange"}
              variant="subtle"
              size="sm"
            >
              {retiro.estado === "CERRADO" ? "Cerrado" : "En curso"}
            </Badge>
          )}
        </Flex>
        <Text fontSize="xs" color="fg.muted" mb="4">
          Vista rápida del retiro de lote que originó esta reposición pendiente.
        </Text>

        {cargando && (
          <Flex py="8" justify="center" align="center" gap="3">
            <Spinner size="md" color="brand.500" />
            <Text fontSize="sm" color="fg.muted">
              Cargando información del retiro...
            </Text>
          </Flex>
        )}

        {!cargando && error && <MensajeError>{error}</MensajeError>}

        {!cargando && !error && retiro && (
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
                  Motivo del retiro
                </Text>
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  {retiro.motivo}
                </Text>
              </Box>

              <Box>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  Producto / Lote Afectado
                </Text>
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  {retiro.lote_producto_nombre} -{" "}
                  <Text as="span" fontFamily="mono">
                    {retiro.lote_codigo}
                  </Text>
                </Text>
              </Box>

              <HStack justify="space-between" flexWrap="wrap" gap="4">
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Fecha del retiro
                  </Text>
                  <Text fontSize="sm" color="fg">
                    {formatoFecha(retiro.fecha_retiro)}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Iniciado por
                  </Text>
                  <Text fontSize="sm" color="fg">
                    {retiro.iniciado_por_nombre}
                  </Text>
                </Box>
              </HStack>

              {retiro.detalle && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Observaciones
                  </Text>
                  <Text fontSize="xs" color="fg" mt="0.5">
                    {retiro.detalle}
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
              navigate(`/retiros/${retiroId}`);
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
