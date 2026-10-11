import { useState } from "react";
import { Button, Textarea } from "@chakra-ui/react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BotonCancelar,
  FormField,
} from "../../../components/ui/patrones";
import type { Incidente } from "../types/incidente";

interface ReabrirIncidenteDialogProps {
  isOpen: boolean;
  incidente: Incidente | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

/**
 * Confirmación de reapertura de un incidente.
 *
 * El incidente vuelve a estado abierto y se guarda el motivo (opcional)
 * en el historial.
 */
export function ReabrirIncidenteDialog({
  isOpen,
  incidente,
  isLoading,
  onClose,
  onConfirm,
}: ReabrirIncidenteDialogProps) {
  const [motivo, setMotivo] = useState("");

  // Cada vez que se abre el diálogo arranca vacío
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) setMotivo("");
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
        width="400px"
        maxWidth="90vw"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="4" fontSize="lg" fontWeight="bold" color="fg">
          Reabrir incidente <strong>#{incidente.id}</strong>
        </DialogTitle>

        <DialogDescription color="fg.muted" mb="4">
          El incidente vuelve a estado abierto. Podés dejar un motivo
          (opcional) para dejar registro del cambio.
        </DialogDescription>

        <FormField label="Motivo de reapertura (opcional)" mb="6">
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ej: La solución no funcionó, el equipo sigue fallando."
            resize="vertical"
          />
        </FormField>

        <AccionesFormulario>
          {/* Reabrir no es la acción principal de la app: por eso no usa
              `BotonGuardar` (teal) sino el ámbar de "reabrir". */}
          <Button
            type="button"
            onClick={() => onConfirm(motivo)}
            loading={isLoading}
            colorPalette="orange"
            size="md"
          >
            Reabrir incidente
          </Button>
          <BotonCancelar onClick={onClose} disabled={isLoading}>
            Cancelar
          </BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}