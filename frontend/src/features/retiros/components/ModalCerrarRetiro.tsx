import { useState } from "react";
import { Box, Text, Textarea } from "@chakra-ui/react";
import {
  DialogContent,
  DialogDescription,
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

interface ModalCerrarRetiroProps {
  isOpen: boolean;
  retiroId: number;
  tienePendientes: boolean;
  totalPendientes: number;
  onClose: () => void;
  onCerrado: (accionCorrectiva: string) => void;
  disabled?: boolean;
}

export function ModalCerrarRetiro({
  isOpen,
  retiroId,
  tienePendientes,
  totalPendientes,
  onClose,
  onCerrado,
  disabled = false,
}: ModalCerrarRetiroProps) {
  const [accion, setAccion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setAccion("");
      setError(null);
    }
  }

  const faltan = faltantes({
    accion_correctiva: [!accion.trim(), "la acción correctiva"],
  });

  const guardando = async () => {
    setEnviando(true);
    setError(null);
    try {
      await onCerrado(accion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el retiro.");
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
        width="480px"
        maxWidth="90vw"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="4" fontSize="lg" fontWeight="bold" color="brand.fg">
          Cerrar retiro #{retiroId}
        </DialogTitle>

        <DialogDescription color="fg.muted" mb="4">
          Al cerrar, el retiro queda como `CERRADO` y se cierra el incidente
          vinculado en E6. La acción correctiva quedará registrada con tu
          usuario y la fecha actual.
        </DialogDescription>

        <form onSubmit={handleSubmit} noValidate>
          {error ? <MensajeError>{error}</MensajeError> : null}
          <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

          <FormField
            label="Acción correctiva *"
            required
            mb="0"
            invalid={intentado && faltan.tiene("accion_correctiva")}
            helper="Documentá qué se investigó, la causa detectada y la solución brindada al cliente."
          >
            <Textarea
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              rows={4}
              placeholder="Ej: Se verificó el lote, se contactó a los clientes afectados y se gestionó la devolución del producto."
              resize="vertical"
              maxLength={500}
            />
          </FormField>

          {tienePendientes && (
            <Box p="3" bg="orange.subtle" color="orange.fg" rounded="md" mb="4">
              <Text fontSize="xs" fontWeight="medium">
                No se puede cerrar aún
              </Text>
              <Text fontSize="xs">
                Quedan {totalPendientes} afectado(s) pendiente(s) de notificación.
                Notificá a todos antes de cerrar el retiro.
              </Text>
            </Box>
          )}

          <AccionesFormulario>
            <BotonGuardar
              loading={enviando}
              disabled={disabled || enviando || tienePendientes || !puedeEnviar(faltan.lista)}
            >
              Cerrar retiro
            </BotonGuardar>
            <BotonCancelar onClick={onClose} disabled={disabled || enviando}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
