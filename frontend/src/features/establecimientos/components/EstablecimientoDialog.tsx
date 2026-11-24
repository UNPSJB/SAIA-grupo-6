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
import type { Establecimiento, EstablecimientoInput } from "../types/establecimiento";

interface EstablecimientoDialogProps {
  establecimiento?: Establecimiento;
  onGuardar: (datos: EstablecimientoInput) => Promise<void>;
  onCancel: () => void;
}

export function EstablecimientoDialog({ establecimiento, onGuardar, onCancel }: EstablecimientoDialogProps) {
  const [nombre, setNombre] = useState(establecimiento?.nombre ?? "");
  const [direccion, setDireccion] = useState(establecimiento?.direccion ?? "");
  const [razonSocial, setRazonSocial] = useState(establecimiento?.razon_social ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nombre.trim()) return setError("Indicá el nombre del establecimiento.");
    setLoading(true);
    setError(null);
    try {
      await onGuardar({ nombre: nombre.trim(), direccion: direccion.trim() || null, razon_social: razonSocial.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el establecimiento.");
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
            {establecimiento ? "Modificar establecimiento" : "Nuevo establecimiento"}
          </DialogTitle>

          {error ? <BannerError mb="4">{error}</BannerError> : null}

          <FormField label="Nombre" required>
            <FormInput
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              placeholder="Ej: Planta Córdoba"
              autoFocus
            />
          </FormField>

          <FormField label="Razón social" opcional helper="Nombre legal del elaborador. Los rótulos de esta sede la toman al autocompletar.">
            <FormInput
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              maxLength={200}
              placeholder="Ej: Alimentos del Sur S.A."
            />
          </FormField>

          <FormField label="Dirección" opcional helper="Va como domicilio del establecimiento en los rótulos.">
            <FormInput
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              maxLength={200}
              placeholder="Ej: Av. Siempre Viva 742"
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
