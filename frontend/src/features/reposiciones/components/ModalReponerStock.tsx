import { useEffect, useState } from "react";
import { Box, Button, HStack, InputGroup, Text, VStack } from "@chakra-ui/react";
import { LuInfo, LuPackageCheck } from "react-icons/lu";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BotonCancelar,
  FormField,
  FormInput,
  FormNativeSelect,
  MensajeError,
} from "../../../components/ui/patrones";
import { toaster } from "../../../components/ui/toaster";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import { formatoFecha, hoyISO } from "../../../common/utils/fechas";
import {
  cantidadConUnidad,
  formatoCantidad,
  propsCampoCantidad,
} from "../../../common/utils/numeros";
import { listarLotes } from "../../lotes/services/loteService";
import type { LoteResumen } from "../../lotes/types/lote";
import type { Reposicion } from "../types/reposicion";

export interface ModalReponerStockProps {
  reposicion: Reposicion | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ModalReponerStock({
  reposicion,
  isOpen,
  onClose,
  onSuccess,
}: ModalReponerStockProps) {
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [cargandoLotes, setCargandoLotes] = useState(false);
  const [loteId, setLoteId] = useState<number>(0);
  const [cantidad, setCantidad] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resetear estado al abrir con una reposición
  useEffect(() => {
    if (!isOpen || !reposicion) return;
    setError(null);
    setLoteId(0);
    const pendienteInicial = Number(reposicion.cantidad_pendiente);
    setCantidad(
      Number.isFinite(pendienteInicial) ? pendienteInicial.toString() : ""
    );

    let vigente = true;
    setCargandoLotes(true);
    void listarLotes({ productoId: String(reposicion.producto_id) })
      .then((todos) => {
        if (!vigente) return;
        const hoy = hoyISO();
        const disponibles = todos.filter(
          (l) =>
            l.producto_id === reposicion.producto_id &&
            !l.retirado &&
            l.estado !== "cancelado" &&
            Number(l.saldo) > 0 &&
            (!l.fecha_vencimiento || l.fecha_vencimiento >= hoy)
        );
        setLotes(disponibles);
        if (disponibles.length > 0) {
          const primero = disponibles[0];
          setLoteId(primero.id);
          const deudaNum = Number(reposicion.cantidad_pendiente);
          const saldoNum = Number(primero.saldo);
          if (Number.isFinite(deudaNum) && Number.isFinite(saldoNum)) {
            setCantidad(Math.min(deudaNum, saldoNum).toString());
          }
        }
      })
      .catch(() => {
        if (vigente) {
          setError("No se pudieron cargar los lotes disponibles del producto.");
        }
      })
      .finally(() => {
        if (vigente) setCargandoLotes(false);
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, reposicion]);

  if (!isOpen || !reposicion) return null;

  const clienteNombre =
    reposicion.cliente?.nombre ?? `Cliente #${reposicion.cliente_id}`;
  const productoNombre =
    reposicion.producto?.nombre ?? `Producto #${reposicion.producto_id}`;
  const deudaActual = Number(reposicion.cantidad_pendiente);
  const uom = reposicion.producto?.unidad_medida || "u";

  const loteSeleccionado = lotes.find((l) => l.id === loteId) ?? null;
  const saldoLote = loteSeleccionado ? Number(loteSeleccionado.saldo) : 0;
  const maxPermitido = loteSeleccionado
    ? Math.min(deudaActual, saldoLote)
    : deudaActual;

  const cantidadNum = Number(cantidad);
  const cantidadInvalida =
    !cantidad.trim() ||
    !Number.isFinite(cantidadNum) ||
    cantidadNum <= 0 ||
    cantidadNum > deudaActual ||
    (loteSeleccionado !== null && cantidadNum > saldoLote);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loteId || cantidadInvalida) return;

    setEnviando(true);
    setError(null);
    try {
      const response = await apiFetch(
        `${API_URL}/reposiciones/${reposicion.id}/cumplir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lote_id: loteId,
            cantidad_a_reponer: Number(cantidad),
          }),
        }
      );
      await pedir<Reposicion>(
        response,
        "No se pudo registrar la reserva de reposición"
      );

      toaster.create({
        title: "Reposición registrada",
        description: `Se reservaron ${formatoCantidad(cantidad)} ${uom} del lote ${loteSeleccionado?.numero_lote ?? ""} para ${clienteNombre}.`,
        type: "success",
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo confirmar la reposición de stock."
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={!enviando}
      closeOnInteractOutside={!enviando}
    >
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="500px"
        maxWidth="92vw"
        maxHeight="88vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle
          as="h3"
          mt={0}
          mb="1"
          fontSize="lg"
          fontWeight="bold"
          color="brand.fg"
        >
          Reponer Stock a {clienteNombre}
        </DialogTitle>
        <Text fontSize="xs" color="fg.muted" mb="4">
          Asigná un lote sano con stock disponible para generar la reserva comercial.
        </Text>

        <form onSubmit={handleConfirmar} noValidate>
          <VStack align="stretch" gap="4">
            {/* Bloque de resumen de deuda actual */}
            <Box
              p="3"
              bg="teal.subtle"
              borderWidth="1px"
              borderColor="teal.border"
              rounded="md"
            >
              <HStack gap="2" align="center">
                <Box as="span" display="inline-flex" color="teal.fg" aria-hidden>
                  <LuInfo size={16} />
                </Box>
                <Text fontSize="sm" color="teal.fg" fontWeight="medium">
                  Deuda actual:{" "}
                  <Text as="span" fontWeight="bold">
                    {formatoCantidad(reposicion.cantidad_pendiente)} {uom}
                  </Text>{" "}
                  de{" "}
                  <Text as="span" fontWeight="bold">
                    {productoNombre}
                  </Text>
                </Text>
              </HStack>
            </Box>

            {error && <MensajeError>{error}</MensajeError>}

            {/* Selector de Lotes disponibles */}
            <FormField
              label="Lote disponible para reponer"
              required
              mb="0"
              helper={
                cargandoLotes
                  ? "Buscando lotes activos con saldo..."
                  : lotes.length === 0
                  ? "No hay lotes activos con saldo disponible para este producto."
                  : loteSeleccionado
                  ? `Saldo disponible en lote: ${cantidadConUnidad(
                      loteSeleccionado.saldo,
                      loteSeleccionado.unidad
                    )}`
                  : "Seleccioná un lote sano con stock disponible."
              }
            >
              <FormNativeSelect
                value={loteId === 0 ? "" : String(loteId)}
                disabled={cargandoLotes || lotes.length === 0}
                onChange={(e) => {
                  const nuevoId = Number(e.target.value);
                  setLoteId(nuevoId);
                  const loteObj = lotes.find((l) => l.id === nuevoId);
                  if (loteObj) {
                    const s = Number(loteObj.saldo);
                    if (Number(cantidad) > s) {
                      setCantidad(String(Math.min(deudaActual, s)));
                    }
                  }
                }}
              >
                <option value="">-- Seleccionar lote disponible --</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={String(lote.id)}>
                    {lote.numero_lote} · Saldo:{" "}
                    {cantidadConUnidad(lote.saldo, lote.unidad)}
                    {lote.fecha_vencimiento
                      ? ` · Vence: ${formatoFecha(lote.fecha_vencimiento)}`
                      : ""}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            {/* Input numérico de cantidad a reponer */}
            <FormField
              label="Cantidad a reponer"
              required
              mb="0"
              invalid={cantidad.trim() !== "" && cantidadInvalida}
              helper={
                loteSeleccionado && cantidadNum > saldoLote
                  ? `Supera el saldo disponible del lote (${cantidadConUnidad(
                      saldoLote,
                      uom
                    )}).`
                  : cantidadNum > deudaActual
                  ? `No puede superar la deuda pendiente (${formatoCantidad(
                      deudaActual
                    )} ${uom}).`
                  : `Podés ingresar el total adeudado o una cantidad menor para reposición parcial (máx: ${formatoCantidad(
                      maxPermitido
                    )} ${uom}).`
              }
            >
              <InputGroup
                endElement={
                  <Text fontSize="xs" color="fg.muted">
                    {uom}
                  </Text>
                }
              >
                <FormInput
                  type="number"
                  {...propsCampoCantidad(uom)}
                  min="0"
                  max={String(maxPermitido)}
                  disabled={!loteSeleccionado}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                />
              </InputGroup>
            </FormField>

            <AccionesFormulario>
              <Button
                type="submit"
                colorPalette="teal"
                loading={enviando}
                disabled={enviando || !loteId || cantidadInvalida}
              >
                <LuPackageCheck aria-hidden />
                Confirmar Reserva
              </Button>
              <BotonCancelar onClick={onClose} disabled={enviando}>
                Cancelar
              </BotonCancelar>
            </AccionesFormulario>
          </VStack>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
