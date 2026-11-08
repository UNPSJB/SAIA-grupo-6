import { useState, type FormEvent } from "react";
import { Text } from "@chakra-ui/react";
import { DialogForm } from "../../../common/components/DialogForm";
import { DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
} from "../../../components/ui/patrones";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { cerrarLote } from "../services/loteService";
import type { LoteDetalle } from "../types/lote";

interface CierreLoteDialogProps {
  lote: LoteDetalle;
  onCerrado: () => Promise<void> | void;
  onClose: () => void;
}

export function CierreLoteDialog({ lote, onCerrado, onClose }: CierreLoteDialogProps) {
  const [cantidad, setCantidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!(Number(cantidad) > 0)) {
      setError("La cantidad producida debe ser mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      await cerrarLote(lote.id, cantidad);
      await onCerrado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el lote.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={!guardando}
      closeOnInteractOutside={!guardando}
      onOpenChange={(detalle) => {
        if (!detalle.open && !guardando) onClose();
      }}
    >
      <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="440px" maxW="calc(100vw - 32px)">
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle as="h3" mt={0} mb="2" fontSize="lg" fontWeight="bold" color="fg">
            Cerrar lote {lote.numero_lote}
          </DialogTitle>
          <Text mb="5" fontSize="sm" color="fg.muted">
            Al cerrarlo pasa a «terminado» y queda de solo lectura. Objetivo:{" "}
            {cantidadConUnidad(lote.cantidad_objetivo, lote.unidad)}.
          </Text>

          {error && <BannerError mb="4">{error}</BannerError>}

          <FormField label={`Cantidad final producida (${lote.unidad})`} required mb="0">
            <FormInput
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              autoFocus
            />
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={guardando}>Cerrar lote</BotonGuardar>
            <BotonCancelar onClick={onClose} disabled={guardando}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
