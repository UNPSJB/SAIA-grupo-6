import { useState } from "react";
import { Badge, Box, Text, Textarea } from "@chakra-ui/react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  MensajeError,
} from "../../../components/ui/patrones";
import { tipoColor, tipoLabel } from "../types/incidente";
import type { Incidente } from "../types/incidente";

interface CerrarIncidenteDialogProps {
  isOpen: boolean;
  incidente: Incidente | null;
  isLoading?: boolean;
  /** Error del guardado: el diálogo queda abierto y lo muestra. */
  error?: string | null;
  onClose: () => void;
  onConfirm: (accionCorrectiva: string) => void;
}

/**
 * Cierre de un incidente reportado: la acción correctiva. Los reclamos, los
 * rechazos y los retiros no pasan por acá, se resuelven en su circuito.
 */
export function CerrarIncidenteDialog({
  isOpen,
  incidente,
  isLoading,
  error,
  onClose,
  onConfirm,
}: CerrarIncidenteDialogProps) {
  const [observacion, setObservacion] = useState("");
  const [intento, setIntento] = useState(false);

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setObservacion("");
      setIntento(false);
    }
  }

  if (!isOpen || !incidente) return null;

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
        width="480px"
        maxWidth="92vw"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Cerrar incidente <strong>#{incidente.id}</strong>
        </DialogTitle>

        <Box p="3" bg="bg.muted" rounded="md" mb="4">
          <Text fontSize="sm" fontWeight="medium" color="fg">
            {incidente.titulo}
          </Text>
          <Text fontSize="xs" color="fg.muted" mt="1" whiteSpace="pre-line">
            {incidente.descripcion}
          </Text>
          <Badge colorPalette={tipoColor(incidente.tipo)} variant="subtle" size="xs" mt="3">
            {tipoLabel(incidente.tipo)}
          </Badge>
        </Box>

        <DialogDescription color="fg.muted" mb="4">
          Se deja asentada la acción correctiva, la fecha de cierre y vos como
          responsable de la resolución.
        </DialogDescription>

        {intento && error && <MensajeError>{error}</MensajeError>}

        <FormField label="Acción correctiva (opcional)" mb="5">
          <Textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={3}
            placeholder="Ej: Se lavó y desinfectó el equipo y se cambió el termostato."
            resize="vertical"
          />
        </FormField>

        <AccionesFormulario>
          <BotonGuardar
            type="button"
            onClick={() => {
              setIntento(true);
              onConfirm(observacion);
            }}
            loading={isLoading}
          >
            Cerrar incidente
          </BotonGuardar>
          <BotonCancelar onClick={onClose} disabled={isLoading}>
            Cancelar
          </BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}
