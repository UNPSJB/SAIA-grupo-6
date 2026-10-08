import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { HistorialIncidenteItem } from "../types/incidente";
import { formatoFecha } from "../types/incidente";

interface HistorialIncidenteModalProps {
  isOpen: boolean;
  historial: HistorialIncidenteItem[] | null;
  loading: boolean;
  onClose: () => void;
}

/**
 * Modal que muestra el historial de cierre/reapertura de un incidente.
 * Similar al historial de checklist: una línea de tiempo con fecha, usuario
 * y observación de cada evento.
 */
export function HistorialIncidenteModal({
  isOpen,
  historial,
  loading,
  onClose,
}: HistorialIncidenteModalProps) {
  if (!isOpen) return null;

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        bg="white"
        p="6"
        rounded="l2"
        boxShadow="dialog"
        width="500px"
        maxWidth="90vw"
        maxHeight="80vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="4" fontWeight="bold" color="brand.500">
          Historial del incidente
        </DialogTitle>

        {loading && <Text color="gray.600">Cargando historial...</Text>}

        {!loading && historial && historial.length === 0 && (
          <Text color="gray.600">
            Este incidente todavía no tiene eventos registrados.
          </Text>
        )}

        {!loading && historial && historial.length > 0 && (
          <VStack align="stretch" gap="4" mt="4">
            {historial.map((evento) => (
              <Box
                key={evento.id}
                borderLeftWidth="3px"
                borderLeftColor="brand.500"
                pl="3"
              >
                <Text fontSize="sm" fontWeight="bold" color="gray.800">
                  {evento.estado_nuevo === "abierto" ? "🔓 Reapertura" : "🔒 Cierre"}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  {formatoFecha(evento.fecha_evento)} — {evento.usuario_nombre ?? `Usuario #${evento.usuario_id}`}
                </Text>
                {evento.observacion && (
                  <Text fontSize="xs" color="gray.600" mt="1">
                    {evento.observacion}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        )}

        <HStack justify="flex-end" mt="5">
          <Button
            type="button"
            onClick={onClose}
            height="auto"
            minW="auto"
            px="4"
            py="2"
            rounded="md"
            bg="gray.200"
            color="gray.800"
            colorPalette="gray"
            fontWeight="bold"
            _hover={{ bg: "gray.300" }}
          >
            Cerrar
          </Button>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}