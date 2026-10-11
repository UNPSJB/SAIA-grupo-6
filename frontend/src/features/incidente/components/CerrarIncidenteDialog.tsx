import { useState } from "react";
import { Textarea } from "@chakra-ui/react";
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
} from "../../../components/ui/patrones";
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
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="400px"
        maxWidth="90vw"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="4" fontSize="lg" fontWeight="bold" color="fg">
          Cerrar incidente <strong>#{incidente.id}</strong>
        </DialogTitle>

        <DialogDescription color="fg.muted" mb="4">
          Se deja asentada la acción correctiva, la fecha de cierre y vos
          como responsable de la resolución.
        </DialogDescription>

        <FormField label="Acción correctiva (opcional)" mb="6">
          <Textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={4}
            placeholder="Ej: Se lavó y desinfectó el equipo y se cambió el termostato."
            resize="vertical"
          />
        </FormField>

        <AccionesFormulario>
          <BotonGuardar
            type="button"
            onClick={() => onConfirm(observacion)}
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