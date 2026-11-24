import { useState } from "react";
import { Box, SimpleGrid, Text, Textarea } from "@chakra-ui/react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import { DatoDetalle } from "../../../components/ui/plantillas";
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
import { etiquetaMotivoRetiro } from "../types/retiro";
import { useAuth } from "../../../common/context/useAuth";

interface ModalCerrarRetiroProps {
  isOpen: boolean;
  retiroId: number;
  loteCodigo: string;
  loteProducto: string;
  motivo: string;
  totalAfectados: number;
  notificados: number;
  incidenteId: number | null;
  tienePendientes: boolean;
  totalPendientes: number;
  onClose: () => void;
  onCerrado: (accionCorrectiva: string) => void;
  disabled?: boolean;
}

export function ModalCerrarRetiro({
  isOpen,
  retiroId,
  loteCodigo,
  loteProducto,
  motivo,
  totalAfectados,
  notificados,
  incidenteId,
  tienePendientes,
  totalPendientes,
  onClose,
  onCerrado,
  disabled = false,
}: ModalCerrarRetiroProps) {
  const { user } = useAuth();
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
          Al cerrar, el retiro queda como "Cerrado" y se cierra
          automáticamente el incidente vinculado. El retiro pasará a
          solo lectura y la acción correctiva quedará registrada con tu
          usuario y la fecha actual.
        </DialogDescription>

        {/* Contexto del retiro: a la vista al cerrar. */}
        <Box
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="md"
          p="4"
          mb="5"
        >
          <Text fontSize="sm" fontWeight="semibold" color="fg" mb="3">
            Resumen del cierre
          </Text>
          <SimpleGrid columns={2} gap="3">
            <DatoDetalle etiqueta="Lote y producto">
              {loteCodigo} · {loteProducto}
            </DatoDetalle>
            <DatoDetalle etiqueta="Motivo">{etiquetaMotivoRetiro(motivo)}</DatoDetalle>
            <DatoDetalle etiqueta="Clientes notificados">
              {totalAfectados === 0 ? "Sin afectados" : `${notificados} de ${totalAfectados}`}
            </DatoDetalle>
            <DatoDetalle etiqueta="Incidente vinculado">
              {incidenteId ? `#${incidenteId}` : "—"}
            </DatoDetalle>
            <DatoDetalle etiqueta="Registra el cierre">
              {user ? `${user.nombre} ${user.apellido}` : "—"}
            </DatoDetalle>
          </SimpleGrid>
        </Box>

        <form onSubmit={handleSubmit} noValidate>
          {error ? <MensajeError>{error}</MensajeError> : null}
          <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

          <FormField
            label="Acción correctiva"
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
              disabled={disabled || enviando || tienePendientes}
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
