import { avisarExito } from "../../../components/ui/patrones";
import { useState, type FormEvent } from "react";
import { Text } from "@chakra-ui/react";
import { DialogForm } from "../../../common/components/DialogForm";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
} from "../../../components/ui/patrones";
import { modificarConsumo } from "../services/loteService";
import type { Consumo } from "../types/lote";

interface CorregirConsumoDialogProps {
  loteId: number;
  consumo: Consumo;
  unidad?: string;
  onCorregido: () => Promise<void> | void;
  onClose: () => void;
}

/**
 * Corrige la cantidad de un consumo mal cargado mientras su etapa sigue
 * pendiente. Para cambiar el lote de insumo o el tipo se borra el consumo y
 * se vuelve a registrar. El cambio queda en la auditoría.
 */
export function CorregirConsumoDialog({ loteId, consumo, unidad, onCorregido, onClose }: CorregirConsumoDialogProps) {
  const [cantidad, setCantidad] = useState(String(Number(consumo.cantidad)));
  const [motivo, setMotivo] = useState(consumo.motivo ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desperdicio = consumo.tipo === "desperdicio";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!(Number(cantidad) > 0)) {
      setError("La cantidad debe ser mayor a cero. Para quitar el consumo, borralo.");
      return;
    }
    setGuardando(true);
    try {
      await modificarConsumo(loteId, consumo.id, cantidad, desperdicio ? motivo.trim() || null : null);
      avisarExito("Consumo corregido correctamente.");
      await onCorregido();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo corregir el consumo.");
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
      <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="420px" maxW="calc(100vw - 32px)">
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="fg">
            Corregir consumo
          </DialogTitle>
          <Text mb="5" fontSize="sm" color="fg.muted">
            {desperdicio ? "Desperdicio" : "Consumo real"} de {consumo.ingrediente_nombre} · lote{" "}
            {consumo.numero_lote_insumo} ({consumo.insumo_nombre}). Registrado:{" "}
            {cantidadConUnidad(consumo.cantidad, unidad)}.
          </Text>

          {error && <BannerError mb="4">{error}</BannerError>}

          <FormField label={`Cantidad${unidad ? ` (${unidad})` : ""}`} required mb={desperdicio ? "4" : "0"}>
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

          {desperdicio && (
            <FormField label="Motivo (opcional)" mb="0">
              <FormInput value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
            </FormField>
          )}

          <AccionesFormulario>
            <BotonGuardar loading={guardando}>Guardar</BotonGuardar>
            <BotonCancelar onClick={onClose} disabled={guardando}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
