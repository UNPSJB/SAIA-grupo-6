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
  FormNativeSelect,
  SelectPlaceholder,
} from "../../../components/ui/patrones";
import type { Aditivo, AditivoInput, ClaseFuncional } from "../types/aditivo";

interface AditivoDialogProps {
  aditivo?: Aditivo;
  clases: ClaseFuncional[];
  /** Debe lanzar si falla: el diálogo muestra el mensaje y sigue abierto. */
  onGuardar: (datos: AditivoInput) => Promise<void>;
  onCancel: () => void;
}

/** Alta o edición de un aditivo de la lista de referencia. */
export function AditivoDialog({ aditivo, clases, onGuardar, onCancel }: AditivoDialogProps) {
  const [claseId, setClaseId] = useState(aditivo?.clase_funcional.id ?? 0);
  const [nombre, setNombre] = useState(aditivo?.nombre ?? "");
  const [ins, setIns] = useState(aditivo?.numero_ins ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clase = clases.find((c) => c.id === claseId);
  const insOpcional = clase?.ins_opcional ?? false;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!claseId) return setError("Elegí la clase funcional.");
    if (!nombre.trim()) return setError("Indicá el nombre completo del aditivo.");
    if (!ins.trim() && !insOpcional) {
      return setError("El número INS es obligatorio (solo es opcional para los aromatizantes).");
    }
    setLoading(true);
    setError(null);
    try {
      await onGuardar({
        clase_funcional_id: claseId,
        nombre: nombre.trim(),
        numero_ins: ins.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el aditivo.");
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
      <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="480px" maxW="calc(100vw - 32px)">
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle as="h3" mt={0} mb="5" fontSize="lg" fontWeight="bold" color="fg">
            {aditivo ? "Modificar aditivo" : "Nuevo aditivo"}
          </DialogTitle>

          {error ? <BannerError mb="4">{error}</BannerError> : null}

          <FormField label="Clase funcional" required>
            <FormNativeSelect value={claseId} onChange={(e) => setClaseId(Number(e.target.value))}>
              <SelectPlaceholder>Seleccioná una clase</SelectPlaceholder>
              {clases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField label="Nombre completo" required>
            <FormInput
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={150}
              placeholder="Ej: Sorbato de potasio"
            />
          </FormField>

          <FormField
            label="Número INS"
            required={!insOpcional}
            mb="0"
            helper={
              insOpcional
                ? "Opcional: esta clase se declara solo por su función."
                : "Formato del Codex, por ejemplo 202, 160a o 500(ii)."
            }
          >
            <FormInput
              value={ins}
              onChange={(e) => setIns(e.target.value)}
              maxLength={20}
              placeholder="Ej: 202"
              maxW="200px"
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
