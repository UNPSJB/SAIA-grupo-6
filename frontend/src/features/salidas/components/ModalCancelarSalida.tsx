import { avisarExito } from "../../../components/ui/patrones";
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
  MensajeError,
  faltantes,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { cancelarSalida } from "../services/salidaService";
import type { SalidaCancelarValues } from "../types/salida";

interface ModalCancelarSalidaProps {
  isOpen: boolean;
  salidaId: number;
  loteNumero: string;
  productoNombre: string;
  clienteNombre: string;
  cantidad: string;
  unidadMedida: string;
  onClose: () => void;
  onCancelacionRegistrada: () => void;
}

const VALORES_INICIALES: SalidaCancelarValues = {
  motivo: "",
};

/**
 * Modal para cancelar una reserva.
 *
 * Pide un motivo obligatorio y muestra una confirmación explícita de que
 * la cantidad volverá al saldo del lote.
 */
export function ModalCancelarSalida({
  isOpen,
  salidaId,
  loteNumero,
  productoNombre,
  clienteNombre,
  cantidad,
  unidadMedida,
  onClose,
  onCancelacionRegistrada,
}: ModalCancelarSalidaProps) {
  const [values, setValues] = useState<SalidaCancelarValues>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setValues({ ...VALORES_INICIALES });
      setError(null);
    }
  }

  const faltan = faltantes({
    motivo: [!values.motivo.trim(), "el motivo de cancelación"],
  });

  const guardando = async () => {
    setEnviando(true);
    setError(null);

    try {
      await cancelarSalida(salidaId, {
        motivo: values.motivo.trim(),
      });
      avisarExito("Reserva cancelada correctamente.");
      onCancelacionRegistrada();
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo cancelar la reserva.";
      setError(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmit = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
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
          Cancelar reserva
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error ? <MensajeError>{error}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            {/* Resumen de la reserva */}
            <Box p="3" bg="bg.muted" rounded="md" mb="2">
              <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                Reserva a cancelar
              </Text>
              <Text fontSize="sm" color="fg">
                {productoNombre} ({loteNumero})
              </Text>
              <Text fontSize="sm" color="fg">
                {cantidadConUnidad(cantidad, unidadMedida)} para {clienteNombre}
              </Text>
            </Box>

            <Text fontSize="xs" color="fg.muted" mb="1">
              Al cancelar, la cantidad volverá a estar disponible en el saldo
              del lote. Esta acción no se puede deshacer.
            </Text>

            <FormField
              label="Motivo de cancelación"
              required
              mb="0"
              invalid={intentado && faltan.tiene("motivo")}
            >
              <Textarea
                value={values.motivo}
                onChange={(e) => setValues({ ...values, motivo: e.target.value })}
                rows={3}
                placeholder="Ej: error en la cantidad, cliente desiste..."
              />
            </FormField>

            <AccionesFormulario>
              <BotonGuardar
                loading={enviando}
                disabled={enviando}
                colorPalette="red"
              >
                Cancelar reserva
              </BotonGuardar>
              <BotonCancelar onClick={onClose} disabled={enviando}>
                Volver
              </BotonCancelar>
            </AccionesFormulario>
          </VStack>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
