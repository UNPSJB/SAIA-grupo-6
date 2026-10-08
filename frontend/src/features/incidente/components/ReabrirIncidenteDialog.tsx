import { useState } from "react";
import { Button, Field, HStack, Textarea } from "@chakra-ui/react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
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
        bg="white"
        p="6"
        rounded="l2"
        boxShadow="dialog"
        width="450px"
        maxWidth="90vw"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="4" fontWeight="bold" color="gray.800">
          Reabrir incidente <strong>#{incidente.id}</strong>
        </DialogTitle>

        <DialogDescription color="gray.600" mb="4">
          El incidente vuelve a estado abierto. Podés dejar un motivo
          (opcional) para dejar registro del cambio.
        </DialogDescription>

        <Field.Root mb="5">
          <Field.Label fontSize="sm" fontWeight="bold" color="gray.600">
            Motivo de reapertura (opcional)
          </Field.Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ej: La solución no funcionó, el equipo sigue fallando."
            fontSize="sm"
            resize="vertical"
          />
        </Field.Root>

        <HStack justify="flex-end" gap="2.5">
          <Button
            type="button"
            onClick={onClose}
            height="auto"
            minW="auto"
            px="4"
            py="2"
            rounded="md"
            variant="outline"
            borderColor="gray.300"
            colorPalette="gray"
            fontWeight="bold"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(motivo)}
            loading={isLoading}
            height="auto"
            minW="auto"
            px="4"
            py="2"
            rounded="md"
            colorPalette="orange"
            fontWeight="bold"
          >
            Reabrir incidente
          </Button>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}