import { useState, type FormEvent } from "react";
import { Checkbox } from "@chakra-ui/react";
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
import type { ClaseFuncional, ClaseFuncionalInput } from "../types/aditivo";

interface ClaseFuncionalDialogProps {
  clase?: ClaseFuncional;
  onGuardar: (datos: ClaseFuncionalInput) => Promise<void>;
  onCancel: () => void;
}

export function ClaseFuncionalDialog({ clase, onGuardar, onCancel }: ClaseFuncionalDialogProps) {
  const [nombre, setNombre] = useState(clase?.nombre ?? "");
  const [insOpcional, setInsOpcional] = useState(clase?.ins_opcional ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nombre.trim()) return setError("Indicá el nombre de la clase funcional.");
    setLoading(true);
    setError(null);
    try {
      await onGuardar({ nombre: nombre.trim(), ins_opcional: insOpcional });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la clase funcional.");
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
            {clase ? "Modificar clase funcional" : "Nueva clase funcional"}
          </DialogTitle>

          {error ? <BannerError mb="4">{error}</BannerError> : null}

          <FormField label="Nombre" required>
            <FormInput
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Ej: Conservante"
              autoFocus
            />
          </FormField>

          <Checkbox.Root
            checked={insOpcional}
            onCheckedChange={(e) => setInsOpcional(e.checked === true)}
            colorPalette="brand"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label fontSize="sm" color="fg">
              Se declara solo por su función (el INS es opcional, como en los aromatizantes)
            </Checkbox.Label>
          </Checkbox.Root>

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
