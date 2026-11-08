import { useState, type FormEvent, type ReactNode } from "react";
import { Text } from "@chakra-ui/react";
import { DialogContent, DialogRoot, DialogTitle } from "../../components/ui/dialog";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
} from "../../components/ui/patrones";
import { DialogForm } from "./DialogForm";

interface MotivoDialogProps {
  titulo: ReactNode;
  mensaje?: ReactNode;
  etiquetaMotivo?: string;
  etiquetaConfirmar: string;
  /** Debe lanzar si falla: el diálogo muestra el mensaje y sigue abierto. */
  onConfirm: (motivo: string) => Promise<void>;
  onCancel: () => void;
}

/** Diálogo que pide un motivo obligatorio antes de una acción que no se deshace. */
export function MotivoDialog({
  titulo,
  mensaje,
  etiquetaMotivo = "Motivo",
  etiquetaConfirmar,
  onConfirm,
  onCancel,
}: MotivoDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!motivo.trim()) {
      setError("Indicá el motivo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(motivo.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={!loading}
      closeOnInteractOutside={!loading}
      onOpenChange={(detalle) => {
        if (!detalle.open && !loading) onCancel();
      }}
    >
      <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="440px" maxW="calc(100vw - 32px)">
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle as="h3" mt={0} mb="2" fontSize="lg" fontWeight="bold" color="fg">
            {titulo}
          </DialogTitle>
          {mensaje ? (
            <Text mb="5" fontSize="sm" color="fg.muted">
              {mensaje}
            </Text>
          ) : null}

          {error ? <BannerError mb="4">{error}</BannerError> : null}

          <FormField label={etiquetaMotivo} required mb="0">
            <FormInput
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              autoFocus
            />
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={loading}>{etiquetaConfirmar}</BotonGuardar>
            <BotonCancelar onClick={onCancel} disabled={loading}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
