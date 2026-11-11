import { useState } from "react";
import { Text, Textarea, VStack } from "@chakra-ui/react";
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
import { anularCertificacion } from "../services/certificacionService";
import type { CertificacionTransportista } from "../types/certificacion";

interface ModalAnularCertificacionProps {
  isOpen: boolean;
  certificacion: CertificacionTransportista | null;
  onClose: () => void;
  onAnulada: () => void;
}

/**
 * Baja lógica de una certificación. El motivo es obligatorio: queda guardado
 * junto con el usuario y la fecha para poder auditar por qué se anuló.
 */
export function ModalAnularCertificacion({
  isOpen,
  certificacion,
  onClose,
  onAnulada,
}: ModalAnularCertificacionProps) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setMotivo("");
      setError(null);
    }
  }

  const faltan = faltantes({
    motivo: [!motivo.trim(), "el motivo de anulación"],
  });

  const handleSubmit = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!certificacion || !puedeEnviar(faltan.lista)) return;

    setEnviando(true);
    setError(null);
    try {
      await anularCertificacion(certificacion.id, motivo.trim());
      onAnulada();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo anular la certificación.",
      );
    } finally {
      setEnviando(false);
    }
  };

  if (!isOpen || !certificacion) return null;

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
          Anular certificación
        </DialogTitle>
        <Text fontSize="sm" color="fg.muted" mb="5">
          {certificacion.tipo} · {certificacion.numero}
        </Text>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error ? <MensajeError>{error}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            <FormField
              label="Motivo de anulación"
              required
              mb="0"
              invalid={intentado && faltan.tiene("motivo")}
              helper="La certificación pasa al historial como Anulada. No se puede reactivar."
            >
              <Textarea
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Ej: error en la fecha de emisión"
                rows={3}
                resize="vertical"
              />
            </FormField>

            <AccionesFormulario>
              <BotonGuardar loading={enviando} disabled={enviando}>
                Anular certificación
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
