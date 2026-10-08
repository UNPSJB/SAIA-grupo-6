import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { LuLock, LuLockOpen } from "react-icons/lu";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BotonCancelar,
  EstadoCargando,
} from "../../../components/ui/patrones";
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
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="400px"
        maxWidth="90vw"
        maxHeight="80vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="4" fontSize="lg" fontWeight="bold" color="brand.fg">
          Historial del incidente
        </DialogTitle>

        {loading && <EstadoCargando>Cargando historial...</EstadoCargando>}

        {!loading && historial && historial.length === 0 && (
          <Text color="fg.muted">
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
                <HStack gap="2" fontSize="sm" fontWeight="bold" color="fg">
                  <Box as="span" display="inline-flex" aria-hidden>
                    {evento.estado_nuevo === "abierto" ? (
                      <LuLockOpen size={16} />
                    ) : (
                      <LuLock size={16} />
                    )}
                  </Box>
                  <Text as="span">
                    {evento.estado_nuevo === "abierto" ? "Reapertura" : "Cierre"}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="fg.muted">
                  {formatoFecha(evento.fecha_evento)} — {evento.usuario_nombre ?? `Usuario #${evento.usuario_id}`}
                </Text>
                {evento.observacion && (
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    {evento.observacion}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        )}

        <AccionesFormulario>
          <BotonCancelar onClick={onClose}>Cerrar</BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}