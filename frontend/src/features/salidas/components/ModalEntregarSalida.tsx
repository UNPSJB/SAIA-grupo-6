import { useState } from "react";
import { Box, Text, Textarea, VStack } from "@chakra-ui/react";
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
  MensajeError,
  faltantes,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { formatoFecha, formatoFechaHora, hoyISO } from "../../../common/utils/fechas";
import { entregarSalida } from "../services/salidaService";
import type { SalidaEntregarValues } from "../types/salida";

interface ModalEntregarSalidaProps {
  isOpen: boolean;
  salidaId: number;
  loteNumero: string;
  productoNombre: string;
  clienteNombre: string;
  cantidad: string;
  unidadMedida: string;
  formaEntrega: string;
  fechaDespacho: string;
  despachadoEn?: string | null;
  onClose: () => void;
  onEntregaRegistrada: () => void;
}

const VALORES_INICIALES: SalidaEntregarValues = {
  fecha_entrega: hoyISO(),
  observacion: null,
  recibido_por: null,
  forma_entrega: null,
};

/**
 * Modal para registrar la entrega de un despacho.
 *
 * Permite indicar la fecha de entrega (máximo hoy, mínimo fecha de despacho)
 * y una observación opcional. También permite indicar quién recibió el despacho
 * (o quién retiró en planta).
 */
export function ModalEntregarSalida({
  isOpen,
  salidaId,
  loteNumero,
  productoNombre,
  clienteNombre,
  cantidad,
  unidadMedida,
  formaEntrega,
  fechaDespacho,
  despachadoEn,
  onClose,
  onEntregaRegistrada,
}: ModalEntregarSalidaProps) {
  const [values, setValues] = useState<SalidaEntregarValues>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setValues({
        ...VALORES_INICIALES,
        fecha_entrega: hoyISO(),
      });
      setError(null);
    }
  }

  const esRetiraCliente = formaEntrega === "RETIRA_CLIENTE";

  const faltan = faltantes({
    fecha_entrega: [!values.fecha_entrega.trim(), "la fecha de entrega"],
  });

  const fechaInvalida =
    values.fecha_entrega.trim() !== "" &&
    (values.fecha_entrega < fechaDespacho ||
      values.fecha_entrega > hoyISO());

  const guardando = async () => {
    setEnviando(true);
    setError(null);

    try {
      await entregarSalida(salidaId, {
        fecha_entrega: values.fecha_entrega,
        observacion: values.observacion?.trim() || null,
        recibido_por: values.recibido_por?.trim() || null,
        forma_entrega: values.forma_entrega,
      });
      onEntregaRegistrada();
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo registrar la entrega.";
      setError(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmit = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeEnviar(faltan.lista) || fechaInvalida) return;
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
        width="460px"
        maxWidth="90vw"
        maxHeight="85vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Registrar entrega
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error ? <MensajeError>{error}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            {/* Resumen de la reserva */}
            <Box p="3" bg="bg.muted" rounded="md" mb="2">
              <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                Despacho a entregar
              </Text>
              <Text fontSize="sm" color="fg">
                {productoNombre} ({loteNumero})
              </Text>
              <Text fontSize="sm" color="fg">
                {cantidadConUnidad(cantidad, unidadMedida)} para {clienteNombre}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="1">
                Fecha de despacho:{" "}
                {despachadoEn
                  ? formatoFechaHora(despachadoEn)
                  : formatoFecha(fechaDespacho)}
              </Text>
            </Box>

            <FormField
              label="Fecha de entrega"
              required
              mb="0"
              invalid={
                (intentado && faltan.tiene("fecha_entrega")) || fechaInvalida
              }
              helper={
                fechaInvalida
                  ? "La fecha debe ser igual o posterior al despacho y no posterior a hoy."
                  : undefined
              }
            >
              <FormInput
                type="date"
                min={fechaDespacho}
                max={hoyISO()}
                value={values.fecha_entrega}
                onChange={(e) =>
                  setValues({ ...values, fecha_entrega: e.target.value })
                }
              />
            </FormField>

            <FormField
              label={esRetiraCliente ? "Retirado por" : "Recibido por"}
              mb="0"
              helper="Nombre de quién retiró o recibió el despacho (opcional). Máximo 100 caracteres."
            >
              <FormInput
                maxLength={100}
                value={values.recibido_por ?? ""}
                onChange={(e) =>
                  setValues({ ...values, recibido_por: e.target.value })
                }
                placeholder="Nombre y apellido"
              />
            </FormField>

            <FormField label="Observación" mb="0">
              <Textarea
                rows={3}
                value={values.observacion ?? ""}
                onChange={(e) =>
                  setValues({ ...values, observacion: e.target.value })
                }
                placeholder="Observaciones opcionales sobre la entrega..."
              />
            </FormField>

            <AccionesFormulario>
              <BotonGuardar loading={enviando} disabled={enviando}>
                Registrar entrega
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
