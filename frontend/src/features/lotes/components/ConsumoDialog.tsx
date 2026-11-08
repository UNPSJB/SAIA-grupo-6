import { useState, type FormEvent } from "react";
import { Box, Stack, Text } from "@chakra-ui/react";
import { DialogForm } from "../../../common/components/DialogForm";
import { formatoFecha } from "../../../common/utils/fechas";
import { cantidadConUnidad, formatoCantidad } from "../../../common/utils/numeros";
import { DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
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
import { useLotesSugeridos } from "../../lotesInsumo/hooks/useStockInsumos";
import { registrarConsumo } from "../services/loteService";
import type { ItemChecklist, TipoConsumo } from "../types/lote";

interface ConsumoDialogProps {
  loteId: number;
  item: ItemChecklist;
  /** Se llama con el lote ya actualizado en el servidor (recargar la pantalla). */
  onRegistrado: () => Promise<void> | void;
  onClose: () => void;
}

export function ConsumoDialog({ loteId, item, onRegistrado, onClose }: ConsumoDialogProps) {
  const [insumoId, setInsumoId] = useState(item.insumos[0]?.insumo_id ?? 0);
  const insumo = item.insumos.find((i) => i.insumo_id === insumoId);
  const faltante = insumo
    ? Math.max(Number(insumo.cantidad_planificada) - Number(insumo.consumo_real), 0)
    : 0;

  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const cantidad = cantidades[insumoId] ?? (faltante > 0 ? String(faltante) : "");

  const { lotes, loading: cargandoLotes, error: errorLotes } = useLotesSugeridos(insumoId || null);
  const sugerido = lotes.find((l) => Number(l.saldo) > 0 && !l.vencido) ?? null;
  const [elegido, setElegido] = useState<{ insumo: number; lote: number } | null>(null);
  const loteId_ =
    elegido && elegido.insumo === insumoId ? elegido.lote : (sugerido?.lote_insumo_id ?? 0);
  const loteInsumo = lotes.find((l) => l.lote_insumo_id === loteId_);

  const [tipo, setTipo] = useState<TipoConsumo>("real");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertencias, setAdvertencias] = useState<string[] | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!loteId_) {
      setError("Elegí el lote de insumo del que sale lo consumido.");
      return;
    }
    if (!(Number(cantidad) > 0)) {
      setError("La cantidad debe ser mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      const consumo = await registrarConsumo(loteId, item.id, {
        lote_insumo_id: loteId_,
        cantidad,
        tipo,
        motivo: motivo.trim() || null,
      });
      await onRegistrado();
      if (consumo.advertencias.length > 0) {
        setAdvertencias(consumo.advertencias);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el consumo.");
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
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="480px"
        maxW="calc(100vw - 32px)"
      >
        {advertencias ? (
          <Box>
            <DialogTitle as="h3" mt={0} mb="3" fontSize="lg" fontWeight="bold" color="fg">
              Consumo registrado con advertencias
            </DialogTitle>
            <Stack gap="2" mb="5">
              {advertencias.map((texto) => (
                <Box
                  key={texto}
                  role="alert"
                  bg="orange.50"
                  color="orange.fg"
                  borderWidth="1px"
                  borderColor="orange.200"
                  rounded="md"
                  px="4"
                  py="3"
                  fontSize="sm"
                >
                  {texto}
                </Box>
              ))}
            </Stack>
            <BotonGuardar type="button" onClick={onClose}>
              Entendido
            </BotonGuardar>
          </Box>
        ) : (
          <DialogForm onSubmit={handleSubmit}>
            <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="fg">
              Registrar consumo
            </DialogTitle>
            <Text mb="5" fontSize="sm" color="fg.muted">
              Tarea {item.orden}: {item.descripcion}
            </Text>

            {error && <BannerError mb="4">{error}</BannerError>}
            {errorLotes && <BannerError mb="4">{errorLotes}</BannerError>}

            <FormField label="Insumo" required mb="4">
              <FormNativeSelect
                value={insumoId}
                onChange={(e) => setInsumoId(Number(e.target.value))}
              >
                {item.insumos.map((i) => (
                  <option key={i.insumo_id} value={i.insumo_id}>
                    {i.insumo_nombre} (planificado{" "}
                    {cantidadConUnidad(i.cantidad_planificada, i.unidad)})
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField
              label="Lote de insumo"
              required
              mb="4"
              helper={
                sugerido
                  ? `Sugerido por vencimiento: ${sugerido.numero_lote}. Podés elegir otro.`
                  : "No hay un lote disponible sin vencer. Podés elegir uno de la lista."
              }
            >
              <FormNativeSelect
                value={loteId_}
                onChange={(e) => setElegido({ insumo: insumoId, lote: Number(e.target.value) })}
                disabled={cargandoLotes}
              >
                <SelectPlaceholder>
                  {cargandoLotes ? "Cargando lotes..." : "Seleccioná un lote"}
                </SelectPlaceholder>
                {lotes.map((l) => (
                  <option key={l.lote_insumo_id} value={l.lote_insumo_id}>
                    {l.numero_lote} · {l.proveedor_nombre} · saldo {formatoCantidad(l.saldo)}
                    {l.fecha_vencimiento ? ` · vence ${formatoFecha(l.fecha_vencimiento)}` : ""}
                    {l.vencido ? " (vencido)" : ""}
                    {l.lote_insumo_id === sugerido?.lote_insumo_id ? " — sugerido" : ""}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField label="Tipo de salida" required mb="4">
              <FormNativeSelect value={tipo} onChange={(e) => setTipo(e.target.value as TipoConsumo)}>
                <option value="real">Consumo real</option>
                <option value="desperdicio">Desperdicio accidental</option>
              </FormNativeSelect>
            </FormField>

            <FormField
              label={`Cantidad${insumo ? ` (${insumo.unidad})` : ""}`}
              required
              mb={tipo === "desperdicio" ? "4" : "0"}
              helper={
                loteInsumo
                  ? `Saldo del lote: ${cantidadConUnidad(loteInsumo.saldo, insumo?.unidad)}`
                  : undefined
              }
            >
              <FormInput
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidades((prev) => ({ ...prev, [insumoId]: e.target.value }))}
              />
            </FormField>

            {tipo === "desperdicio" && (
              <FormField label="Motivo (opcional)" mb="0">
                <FormInput
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={300}
                  placeholder="Ej: se cayó el recipiente"
                />
              </FormField>
            )}

            <AccionesFormulario>
              <BotonGuardar loading={guardando}>Registrar</BotonGuardar>
              <BotonCancelar onClick={onClose} disabled={guardando}>
                Cancelar
              </BotonCancelar>
            </AccionesFormulario>
          </DialogForm>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
