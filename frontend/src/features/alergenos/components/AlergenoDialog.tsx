import { useState, type FormEvent } from "react";
import { DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import { DialogForm } from "../../../common/components/DialogForm";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
} from "../../../components/ui/patrones";
import type { Alergeno } from "../types/alergeno";

interface AlergenoDialogProps {
  alergeno?: Alergeno;
  /** Debe lanzar si falla: el diálogo muestra el mensaje y sigue abierto. */
  onGuardar: (nombre: string) => Promise<void>;
  onCancel: () => void;
}

/** Alta o edición de un alérgeno del catálogo. */
export function AlergenoDialog({ alergeno, onGuardar, onCancel }: AlergenoDialogProps) {
  const [nombre, setNombre] = useState(alergeno?.nombre ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nombre.trim()) return setError("Indicá el nombre del alérgeno.");
    setLoading(true);
    setError(null);
    try {
      await onGuardar(nombre.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el alérgeno.");
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
          <DialogTitle as="h3" mt={0} mb="5" fontSize="lg" fontWeight="bold" color="fg">
            {alergeno ? "Modificar alérgeno" : "Nuevo alérgeno"}
          </DialogTitle>

          {error ? <BannerError mb="4">{error}</BannerError> : null}

          <FormField label="Nombre" required mb="0" helper="Como se declara en el rótulo.">
            <FormInput
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Ej: Sésamo"
            />
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={loading}>Guardar</BotonGuardar>
            <BotonCancelar onClick={onCancel} disabled={loading}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
