import { useState, useEffect } from "react";
import { InputGroup, Text, VStack } from "@chakra-ui/react";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  MensajeError,
  faltantes,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { hoyISO, formatoFecha } from "../../../common/utils/fechas";
import {
  listarClientesDisponibles,
  listarLotesDisponibles,
  reservarSalida,
} from "../services/salidaService";
import type { SalidaCreateValues } from "../types/salida";

interface ModalReservarLoteProps {
  isOpen: boolean;
  /** Lote preseleccionado (abre el modal con el lote ya elegido). */
  loteIdInicial?: number | null;
  onClose: () => void;
  onReservaRegistrada: () => void;
}

const VALORES_INICIALES: SalidaCreateValues = {
  lote_id: 0,
  cliente_id: 0,
  cantidad: "",
  fecha_reserva: hoyISO(),
};

interface LoteOpcion {
  id: number;
  numero_lote: string;
  producto_nombre: string;
  saldo: number;
  unidad: string;
  fecha_vencimiento: string | null;
  fecha_inicio: string | null;
  vencido: boolean;
}

/**
 * Orden FEFO/FIFO del selector de lotes.
 *
 * 1. Vigentes con vencimiento: el vencimiento más próximo primero (FEFO),
 *    desempatando por elaboración y, al final, por código de lote.
 * 2. Vigentes sin vencimiento: el más antiguo primero (FIFO), con el mismo
 *    desempate final por código.
 * 3. Vencidos: al final y deshabilitados, también del más viejo al más nuevo.
 */
function compararLotes(a: LoteOpcion, b: LoteOpcion): number {
  if (a.vencido !== b.vencido) return a.vencido ? 1 : -1;

  if (a.fecha_vencimiento && b.fecha_vencimiento) {
    const porVencimiento = a.fecha_vencimiento.localeCompare(
      b.fecha_vencimiento
    );
    if (porVencimiento !== 0) return porVencimiento;
  } else if (a.fecha_vencimiento !== b.fecha_vencimiento) {
    // Los que tienen vencimiento van antes que los que no lo tienen.
    return a.fecha_vencimiento ? -1 : 1;
  }

  const porElaboracion = (a.fecha_inicio ?? "").localeCompare(
    b.fecha_inicio ?? ""
  );
  if (porElaboracion !== 0) return porElaboracion;

  return a.numero_lote.localeCompare(b.numero_lote);
}

/**
 * Modal para reservar una cantidad de un lote para un cliente.
 * Valida que la cantidad sea > 0 y <= saldo del lote elegido.
 */
export function ModalReservarLote({
  isOpen,
  loteIdInicial,
  onClose,
  onReservaRegistrada,
}: ModalReservarLoteProps) {
  const [values, setValues] = useState<SalidaCreateValues>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lotesDisponibles, setLotesDisponibles] = useState<LoteOpcion[]>([]);
  const [clientesActivos, setClientesActivos] = useState<{
    id: number;
    nombre: string;
  }[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<{
    id: number;
    saldo: number;
    unidad: string;
    fecha_inicio: string | null;
    fecha_vencimiento: string | null;
  } | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setValues({
        ...VALORES_INICIALES,
        fecha_reserva: hoyISO(),
      });
      setError(null);
      if (loteIdInicial) {
        setValues({ ...values, lote_id: loteIdInicial });
      }
    }
  }

  // Carga lotes con saldo > 0 y no retirados, y clientes activos.
  useEffect(() => {
    if (!isOpen) return;

    let vigente = true;
    void Promise.all([listarLotesDisponibles(), listarClientesDisponibles()])
      .then(([lotes, clientes]) => {
        if (!vigente) return;
        const disponibles = lotes.map((l) => ({
          id: l.id,
          numero_lote: l.codigo,
          producto_nombre: l.producto_nombre,
          saldo: Number(l.saldo),
          unidad: l.unidad_medida,
          fecha_vencimiento: l.fecha_vencimiento,
          fecha_inicio: l.fecha_inicio,
          vencido:
            !!l.fecha_vencimiento && l.fecha_vencimiento < hoyISO(),
        })).sort(compararLotes);
        setLotesDisponibles(disponibles);
        setClientesActivos(
          clientes
            .map((c) => ({ id: c.id, nombre: c.nombre }))
            .sort((a: { nombre: string }, b: { nombre: string }) =>
              a.nombre.localeCompare(b.nombre)
            )
        );

        // Si hay un lote preseleccionado, marcarlo (salvo que esté vencido:
        // esos se muestran deshabilitados y no se pueden reservar).
        if (loteIdInicial) {
          const lote = disponibles.find((l) => l.id === loteIdInicial);
          if (lote && !lote.vencido) {
            const saldoNum = Number(lote.saldo);
            setLoteSeleccionado({
              id: lote.id,
              saldo: saldoNum,
              unidad: lote.unidad,
              fecha_inicio: lote.fecha_inicio,
              fecha_vencimiento: lote.fecha_vencimiento,
            });
            setValues({ ...values, lote_id: loteIdInicial });
          }
        }
      })
      .catch(() => {
        if (vigente) {
          setError(
            "No se pudieron cargar los lotes y clientes disponibles."
          );
        }
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, loteIdInicial]);

  // Cuando cambia el lote, recalcular el saldo máximo y resetear la fecha si fuera de rango.
  useEffect(() => {
    if (values.lote_id) {
      const lote = lotesDisponibles.find((l) => l.id === values.lote_id);
      if (lote) {
        const saldoNum = Number(lote.saldo);
        setLoteSeleccionado({
          id: lote.id,
          saldo: saldoNum,
          unidad: lote.unidad,
          fecha_inicio: lote.fecha_inicio,
          fecha_vencimiento: lote.fecha_vencimiento,
        });
        // Si la fecha ya elegida quedó fuera de rango, resetea a hoy y avisa.
        const hoy = hoyISO();
        if (values.fecha_reserva > hoy) {
          setValues({ ...values, fecha_reserva: hoy });
        }
      } else {
        setLoteSeleccionado(null);
      }
    } else {
      setLoteSeleccionado(null);
    }
  }, [values.lote_id, lotesDisponibles]);

  const saldoMax = loteSeleccionado?.saldo ?? 0;

  const ayudaLote = loteSeleccionado
    ? loteSeleccionado.fecha_vencimiento
      ? `Vence el ${formatoFecha(
          loteSeleccionado.fecha_vencimiento
        )}. Se muestran primero los vencimientos más próximos (FEFO).`
      : loteSeleccionado.fecha_inicio
      ? `Sin vencimiento: elaborado el ${formatoFecha(
          loteSeleccionado.fecha_inicio
        )}. Después de los lotes con vencimiento se ordena por antigüedad (FIFO).`
      : "Sin fechas de vencimiento ni de elaboración registradas."
    : "Se muestran primero los lotes con vencimiento más próximo (FEFO) y después los más antiguos (FIFO). Los vencidos quedan al final, deshabilitados.";

  const faltan = faltantes({
    lote_id: [!values.lote_id || values.lote_id === 0, "el lote"],
    cliente_id: [!values.cliente_id || values.cliente_id === 0, "el cliente"],
    cantidad: [!values.cantidad.trim(), "la cantidad"],
    fecha_reserva: [!values.fecha_reserva.trim(), "la fecha"],
  });

  const cantidadInvalida =
    values.cantidad.trim() !== "" &&
    (Number(values.cantidad) <= 0 || Number(values.cantidad) > saldoMax);

  const fechaInvalida =
    values.fecha_reserva.trim() !== "" &&
    (loteSeleccionado?.fecha_inicio &&
      values.fecha_reserva < loteSeleccionado.fecha_inicio) ||
    values.fecha_reserva > hoyISO();

  const guardando = async () => {
    setEnviando(true);
    setError(null);

    try {
      await reservarSalida({
        lote_id: values.lote_id,
        cliente_id: values.cliente_id,
        cantidad: values.cantidad,
        fecha_reserva: values.fecha_reserva,
      });
      onReservaRegistrada();
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo registrar la reserva.";
      setError(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmit = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeEnviar(faltan.lista) || cantidadInvalida || fechaInvalida)
      return;
    void guardando();
  };

  if (!isOpen) return null;

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="480px"
        maxWidth="90vw"
        maxHeight="85vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Nueva reserva
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error ? <MensajeError>{error}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            <FormField
              label="Lote"
              required
              mb="0"
              invalid={intentado && faltan.tiene("lote_id")}
              helper={ayudaLote}
            >
              <FormNativeSelect
                value={String(values.lote_id)}
                onChange={(e) =>
                  setValues({ ...values, lote_id: Number(e.target.value) })
                }
              >
                <option value="">-- Lote --</option>
                {lotesDisponibles.map((lote) => (
                  <option
                    key={lote.id}
                    value={String(lote.id)}
                    disabled={lote.vencido}
                  >
                    {lote.numero_lote} · {lote.producto_nombre} · saldo:{" "}
                    {cantidadConUnidad(lote.saldo, lote.unidad)}
                    {lote.vencido && lote.fecha_vencimiento
                      ? ` · Vencido el ${formatoFecha(lote.fecha_vencimiento)}`
                      : lote.fecha_vencimiento
                      ? ` · vence ${formatoFecha(lote.fecha_vencimiento)}`
                      : " · sin vencimiento"}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField
              label="Cliente"
              required
              mb="0"
              invalid={intentado && faltan.tiene("cliente_id")}
            >
              <FormNativeSelect
                value={String(values.cliente_id)}
                onChange={(e) =>
                  setValues({ ...values, cliente_id: Number(e.target.value) })
                }
              >
                <option value="">-- Cliente --</option>
                {clientesActivos.map((cliente) => (
                  <option key={cliente.id} value={String(cliente.id)}>
                    {cliente.nombre}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField
              label="Cantidad"
              required
              mb="0"
              invalid={
                (intentado && faltan.tiene("cantidad")) || cantidadInvalida
              }
              helper={
                cantidadInvalida
                  ? `La cantidad debe ser mayor a 0 y menor o igual al saldo (${cantidadConUnidad(saldoMax, loteSeleccionado?.unidad)}).`
                  : `Saldo disponible: ${cantidadConUnidad(saldoMax, loteSeleccionado?.unidad)}`
              }
            >
              <InputGroup
                endElement={
                  loteSeleccionado?.unidad ? (
                    <Text fontSize="xs" color="fg.muted">
                      {loteSeleccionado.unidad}
                    </Text>
                  ) : undefined
                }
              >
                <FormInput
                  type="number"
                  step={loteSeleccionado?.unidad === "un" ? "1" : "0.001"}
                  min="0"
                  value={values.cantidad}
                  onChange={(e) => setValues({ ...values, cantidad: e.target.value })}
                  placeholder="0"
                />
              </InputGroup>
            </FormField>

            <FormField
              label="Fecha de reserva"
              required
              mb="0"
              invalid={
                (intentado && faltan.tiene("fecha_reserva")) || fechaInvalida
              }
              helper={
                loteSeleccionado?.fecha_inicio
                  ? `Entre ${formatoFecha(loteSeleccionado.fecha_inicio)} y hoy (${formatoFecha(hoyISO())})`
                  : `Hasta hoy (${formatoFecha(hoyISO())})`
              }
            >
              <FormInput
                type="date"
                disabled={!loteSeleccionado}
                min={loteSeleccionado?.fecha_inicio ?? undefined}
                max={hoyISO()}
                value={values.fecha_reserva}
                onChange={(e) =>
                  setValues({ ...values, fecha_reserva: e.target.value })
                }
              />
            </FormField>

            <AccionesFormulario>
              <BotonGuardar loading={enviando} disabled={enviando}>
                Reservar
              </BotonGuardar>
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
