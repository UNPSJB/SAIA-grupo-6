import { useState } from "react";
import { Button, Field, HStack, Textarea } from "@chakra-ui/react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { Incidente } from "../types/incidente";

interface CerrarIncidenteDialogProps {
  isOpen: boolean;
  incidente: Incidente | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (observacionCierre: string) => void;
}

/**
 * Confirmación de cierre de un incidente.
 *
 * El incidente no se borra: queda en estado cerrado con la acción correctiva
 * que se realizó, la fecha de cierre y quién lo resolvió.
 */
export function CerrarIncidenteDialog({
  isOpen,
  incidente,
  isLoading,
  onClose,
  onConfirm,
}: CerrarIncidenteDialogProps) {
  const [observacion, setObservacion] = useState("");

  // Cada vez que se abre el diálogo arranca vacío, así el admin no arrastra
  // el texto del cierre anterior. Se ajusta en render en lugar de en un
  // efecto para no disparar un render extra.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) setObservacion("");
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
          Cerrar incidente <strong>#{incidente.id}</strong>
        </DialogTitle>

        <DialogDescription color="gray.600" mb="4">
          Se deja asentada la acción correctiva, la fecha de cierre y vos
          como responsable de la resolución.
        </DialogDescription>

        <Field.Root mb="5">
          <Field.Label fontSize="sm" fontWeight="bold" color="gray.600">
            Acción correctiva (opcional)
          </Field.Label>
          <Textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={4}
            placeholder="Ej: Se lavó y desinfectó el equipo y se cambió el termostato."
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
            onClick={() => onConfirm(observacion)}
            loading={isLoading}
            height="auto"
            minW="auto"
            px="4"
            py="2"
            rounded="md"
            colorPalette="brand"
            fontWeight="bold"
          >
            Cerrar incidente
          </Button>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}