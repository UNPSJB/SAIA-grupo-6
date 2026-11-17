import { useState, useEffect } from "react";
import { Box, Text, VStack } from "@chakra-ui/react";
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
import { formatoFecha, hoyISO } from "../../../common/utils/fechas";
import { despacharSalida } from "../services/salidaService";
import type { SalidaDespacharValues } from "../types/salida";
import { FORMAS_ENTREGA } from "../types/salida";

interface ModalDespacharSalidaProps {
  isOpen: boolean;
  salidaId: number;
  loteNumero: string;
  productoNombre: string;
  clienteNombre: string;
  clienteContacto: string | null;
  clienteDomicilio: string | null;
  cantidad: string;
  unidadMedida: string;
  fechaReserva: string;
  loteVencido: boolean;
  onClose: () => void;
  onDespachoRegistrado: () => void;
}

const VALORES_INICIALES: SalidaDespacharValues = {
  forma_entrega: "RETIRA_CLIENTE",
  transportista_id: null,
  fecha_despacho: hoyISO(),
};

/**
 * Modal para despachar una reserva.
 *
 * Permite elegir la forma de entrega (con transportista o retira el cliente).
 * Si es con transportista, solo se pueden elegir transportistas activos con
 * estado de habilitación "Habilitado" a la fecha de hoy.
 */
export function ModalDespacharSalida({
  isOpen,
  salidaId,
  loteNumero,
  productoNombre,
  clienteNombre,
  clienteContacto,
  clienteDomicilio,
  cantidad,
  unidadMedida,
  fechaReserva,
  loteVencido,
  onClose,
  onDespachoRegistrado,
}: ModalDespacharSalidaProps) {
  const [values, setValues] = useState<SalidaDespacharValues>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transportistas, setTransportistas] = useState<{
    id: number;
    razon_social: string;
    estado_habilitacion: string;
    habilitado: boolean;
  }[]>([]);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setValues({ ...VALORES_INICIALES, fecha_despacho: hoyISO() });
      setError(null);
    }
  }

  // Carga transportistas activos con su estado de habilitación.
  useEffect(() => {
    if (!isOpen) return;

    let vigente = true;
    void import("../../transportistas/services/transportistaService").then(
      ({ listarTransportistas }) => {
        listarTransportistas()
          .then((lista) => {
            if (!vigente) return;
            const transportistasLista = Array.isArray(lista)
              ? lista
              : lista.items ?? [];
            setTransportistas(
              transportistasLista
                .filter((t) => t.activo)
                .map((t) => ({
                  id: t.id,
                  razon_social: t.razon_social,
                  estado_habilitacion: t.estado_habilitacion,
                  habilitado: t.estado_habilitacion === "Habilitado",
                }))
                .sort((a, b) => a.razon_social.localeCompare(b.razon_social))
            );
          })
          .catch(() => {
            if (vigente) {
              setError("No se pudieron cargar los transportistas disponibles.");
            }
          });
      }
    );

    return () => {
      vigente = false;
    };
  }, [isOpen]);

  const esConTransportista = values.forma_entrega === "CON_TRANSPORTISTA";

  const faltan = faltantes({
    forma_entrega: [!values.forma_entrega, "la forma de entrega"],
    fecha_despacho: [!values.fecha_despacho.trim(), "la fecha de despacho"],
  });

  const transportistaFalta =
    esConTransportista && (!values.transportista_id || values.transportista_id === 0);

  const fechaInvalida =
    values.fecha_despacho.trim() !== "" &&
    (values.fecha_despacho < fechaReserva ||
      values.fecha_despacho > hoyISO());

  const guardando = async () => {
    setEnviando(true);
    setError(null);

    try {
      await despacharSalida(salidaId, {
        forma_entrega: values.forma_entrega,
        transportista_id: esConTransportista
          ? values.transportista_id
          : null,
        fecha_despacho: values.fecha_despacho,
      });
      onDespachoRegistrado();
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo despachar la salida.";
      setError(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmit = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (
      !puedeEnviar(faltan.lista) ||
      transportistaFalta ||
      fechaInvalida ||
      loteVencido
    )
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
          Despachar salida
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error ? <MensajeError>{error}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            {/* Resumen de la reserva */}
            <Box p="3" bg="bg.muted" rounded="md" mb="2">
              <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                Reserva a despachar
              </Text>
              <Text fontSize="sm" color="fg">
                {productoNombre} ({loteNumero})
              </Text>
              <Text fontSize="sm" color="fg">
                {cantidadConUnidad(cantidad, unidadMedida)} para {clienteNombre}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="1">
                Fecha de reserva: {formatoFecha(fechaReserva)}
              </Text>
              {clienteContacto && (
                <Text fontSize="xs" color="fg.muted" mt="1">
                  Contacto: {clienteContacto}
                </Text>
              )}
              {clienteDomicilio && (
                <Text fontSize="xs" color="fg.muted" mt="1">
                  Domicilio: {clienteDomicilio}
                </Text>
              )}
            </Box>

            <FormField
              label="Forma de entrega"
              required
              mb="0"
              invalid={intentado && faltan.tiene("forma_entrega")}
            >
              <FormNativeSelect
                value={values.forma_entrega}
                onChange={(e) =>
                  setValues({
                    ...values,
                    forma_entrega: e.target.value,
                    transportista_id: null,
                  })
                }
              >
                {FORMAS_ENTREGA.map((forma) => (
                  <option key={forma.valor} value={forma.valor}>
                    {forma.etiqueta}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            {esConTransportista && (
              <>
                <FormField
                  label="Transportista"
                  required
                  mb="0"
                  invalid={
                    (intentado && faltan.tiene("forma_entrega")) ||
                    transportistaFalta
                  }
                  helper={
                    transportistaFalta
                      ? "Seleccioná un transportista."
                      : undefined
                  }
                >
                  <FormNativeSelect
                    value={String(values.transportista_id ?? "")}
                    onChange={(e) =>
                      setValues({ ...values, transportista_id: Number(e.target.value) })
                    }
                  >
                    <option value="">-- Transportista --</option>
                    {transportistas.map((t) => (
                      <option
                        key={t.id}
                        value={String(t.id)}
                        disabled={!t.habilitado}
                      >
                        {t.razon_social}
                        {" ("}
                        <Text fontSize="xs" color={t.habilitado ? "green.fg" : "gray.fg"}>
                          {t.estado_habilitacion}
                        </Text>
                        {")"}
                      </option>
                    ))}
                  </FormNativeSelect>
                </FormField>
                <Text fontSize="xs" color="fg.muted" mt="1">
                  Solo se pueden elegir transportistas con certificación vigente.
                </Text>
              </>
            )}

            <FormField
              label="Fecha de despacho"
              required
              mb="0"
              invalid={
                (intentado && faltan.tiene("fecha_despacho")) || fechaInvalida
              }
              helper={
                fechaInvalida
                  ? "La fecha debe ser igual o posterior a la reserva y no posterior a hoy."
                  : undefined
              }
            >
              <FormInput
                type="date"
                min={fechaReserva}
                max={hoyISO()}
                value={values.fecha_despacho}
                onChange={(e) =>
                  setValues({ ...values, fecha_despacho: e.target.value })
                }
              />
            </FormField>

            {loteVencido && (
              <Text fontSize="xs" color="red.fg" mt="1">
                Este lote está vencido. No se puede despachar.
              </Text>
            )}

            <AccionesFormulario>
              <BotonGuardar
                loading={enviando}
                disabled={enviando || loteVencido}
              >
                Despachar salida
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
