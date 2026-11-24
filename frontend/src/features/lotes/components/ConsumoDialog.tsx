import { avisarExito } from "../../../components/ui/patrones";
import { useState, type FormEvent } from "react";
import { Box, Stack, Text } from "@chakra-ui/react";
import { DialogForm } from "../../../common/components/DialogForm";
import { formatoFecha } from "../../../common/utils/fechas";
import { cantidadConUnidad, formatoCantidad, redondear } from "../../../common/utils/numeros";
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

/** Lo que le falta registrar a un ingrediente de la tarea (redondeado a milésimas). */
const faltanteDe = (i: ItemChecklist["ingredientes"][number]) =>
  redondear(Math.max(Number(i.cantidad_planificada) - Number(i.consumo_real), 0));

export function ConsumoDialog({ loteId, item, onRegistrado, onClose }: ConsumoDialogProps) {
  // Empieza por el primer ingrediente al que todavía le falta consumo.
  const [ingredienteId, setIngredienteId] = useState(
    (item.ingredientes.find((i) => faltanteDe(i) > 0) ?? item.ingredientes[0])?.ingrediente_id ?? 0,
  );
  // Lo último registrado, para confirmarlo cuando el diálogo sigue abierto.
  const [registrado, setRegistrado] = useState<string | null>(null);
  const ingrediente = item.ingredientes.find((i) => i.ingrediente_id === ingredienteId);
  // Redondeado a milésimas, como guarda el backend: la resta de decimales en
  // JavaScript deja colas como 1,2079999999999984 que el backend rechaza.
  const faltante = ingrediente ? faltanteDe(ingrediente) : 0;

  const [cantidades, setCantidades] = useState<Record<number, string>>({});

  const {
    lotes: todos,
    loading: cargandoLotes,
    error: errorLotes,
    recargar: recargarLotes,
  } = useLotesSugeridos(ingredienteId || null);
  // Solo los lotes que se pueden usar: con saldo, sin vencer y de una marca
  // homologada (el backend rechaza los demás). Vienen por vencimiento (FEFO).
  const lotes = todos.filter((l) => Number(l.saldo) > 0 && !l.vencido && !l.marca_no_utilizable);
  const sugerido = lotes[0] ?? null;
  const [elegido, setElegido] = useState<{ ingrediente: number; lote: number } | null>(null);
  const loteId_ =
    elegido && elegido.ingrediente === ingredienteId ? elegido.lote : (sugerido?.lote_insumo_id ?? 0);
  const loteInsumo = lotes.find((l) => l.lote_insumo_id === loteId_);
  // No se consume más que el saldo del lote: por defecto se propone lo que
  // falta para la tarea, hasta lo que queda en el lote elegido (el resto se
  // registra después desde otro lote).
  const saldo = loteInsumo ? redondear(Math.max(Number(loteInsumo.saldo), 0)) : null;
  const propuesta = saldo === null ? faltante : Math.min(faltante, saldo);
  const cantidad = cantidades[ingredienteId] ?? (propuesta > 0 ? String(propuesta) : "");

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
    if (saldo !== null && Number(cantidad) > saldo) {
      setError(
        `El lote ${loteInsumo?.numero_lote} tiene ${cantidadConUnidad(saldo, ingrediente?.unidad)}. ` +
          "Registrá hasta ese saldo y lo que falta desde otro lote.",
      );
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
        return;
      }
      // Si a la tarea todavía le falta consumo (de este ingrediente, desde otro
      // lote, o de otro ingrediente), el diálogo sigue abierto con lo próximo.
      const quedaDeEste = tipo === "real" && Number(cantidad) < faltante;
      const siguiente = quedaDeEste
        ? ingrediente
        : item.ingredientes.find((i) => i.ingrediente_id !== ingredienteId && faltanteDe(i) > 0);
      if (!siguiente) {
        // Entre ingredientes el aviso va dentro del diálogo; al terminar, en un toast.
        avisarExito("Consumo registrado correctamente.");
        onClose();
        return;
      }
      setRegistrado(
        `Registrado: ${ingrediente?.ingrediente_nombre} ${cantidadConUnidad(cantidad, ingrediente?.unidad)}. ` +
          (quedaDeEste
            ? "Registrá lo que falta desde otro lote."
            : `Seguí con ${siguiente.ingrediente_nombre}.`),
      );
      setCantidades((prev) => {
        const resto = { ...prev };
        delete resto[ingredienteId];
        return resto;
      });
      setElegido(null);
      setTipo("real");
      setMotivo("");
      setIngredienteId(siguiente.ingrediente_id);
      if (quedaDeEste) await recargarLotes();
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
                  bg="orange.subtle"
                  color="orange.fg"
                  borderWidth="1px"
                  borderColor="orange.border"
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

            {registrado && !error && (
              <Box
                role="status"
                bg="green.subtle"
                color="green.fg"
                borderWidth="1px"
                borderColor="green.border"
                rounded="md"
                px="4"
                py="3"
                mb="4"
                fontSize="sm"
              >
                {registrado}
              </Box>
            )}
            {error && <BannerError mb="4">{error}</BannerError>}
            {errorLotes && <BannerError mb="4">{errorLotes}</BannerError>}

            <FormField label="Ingrediente" required mb="4">
              <FormNativeSelect
                value={ingredienteId}
                onChange={(e) => setIngredienteId(Number(e.target.value))}
              >
                {item.ingredientes.map((i) => (
                  <option key={i.ingrediente_id} value={i.ingrediente_id}>
                    {i.ingrediente_nombre} (planificado{" "}
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
                loteInsumo
                  ? `${loteInsumo.insumo_nombre} · ${loteInsumo.proveedor_nombre}${
                      loteInsumo.lote_insumo_id === sugerido?.lote_insumo_id
                        ? " · sugerido por vencimiento"
                        : ""
                    }`
                  : sugerido
                  ? `Sugerido por vencimiento: ${sugerido.numero_lote}. Podés elegir otro.`
                  : cargandoLotes
                    ? undefined
                    : "No hay lotes de este ingrediente con saldo, sin vencer y de una marca homologada."
              }
            >
              <FormNativeSelect
                value={loteId_}
                onChange={(e) => setElegido({ ingrediente: ingredienteId, lote: Number(e.target.value) })}
                disabled={cargandoLotes}
              >
                <SelectPlaceholder>
                  {cargandoLotes ? "Cargando lotes..." : "Seleccioná un lote"}
                </SelectPlaceholder>
                {lotes.map((l) => (
                  <option
                    key={l.lote_insumo_id}
                    value={l.lote_insumo_id}
                  >
                    {l.numero_lote} · saldo {formatoCantidad(l.saldo)}
                    {l.fecha_vencimiento ? ` · vence ${formatoFecha(l.fecha_vencimiento)}` : ""}
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
              label={`Cantidad${ingrediente ? ` (${ingrediente.unidad})` : ""}`}
              required
              mb={tipo === "desperdicio" ? "4" : "0"}
              helper={
                loteInsumo
                  ? faltante > (saldo ?? 0)
                    ? `Saldo del lote: ${cantidadConUnidad(loteInsumo.saldo, ingrediente?.unidad)}. A la tarea le faltan ${cantidadConUnidad(faltante, ingrediente?.unidad)}: el resto se registra desde otro lote.`
                    : `Saldo del lote: ${cantidadConUnidad(loteInsumo.saldo, ingrediente?.unidad)}`
                  : undefined
              }
            >
              <FormInput
                type="number"
                min="0"
                max={saldo ?? undefined}
                step="any"
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidades((prev) => ({ ...prev, [ingredienteId]: e.target.value }))}
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
