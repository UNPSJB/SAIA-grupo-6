import { useState } from "react";
import { Box, SimpleGrid, Text } from "@chakra-ui/react";
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
  FormInput,
  FormNativeSelect,
  MensajeError,
  faltantes,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import { formatoFecha, hoyISO } from "../../../common/utils/fechas";
import { MEDIOS_CONTACTO_RETIRO } from "../types/retiro";
import type { RetiroAfectadoResumen } from "../types/retiro";
import { notificarAfectado } from "../services/retiroService";

interface ModalNotificarAfectadoProps {
  isOpen: boolean;
  retiroId: number;
  afectadoId: number;
  /**
   * Datos del afectado que se está notificando: se muestran arriba del
   * formulario para tener a mano el contacto sin cerrar el modal.
   */
  afectado: RetiroAfectadoResumen | null;
  fechaRetiro: string;
  onClose: () => void;
  onNotificado: () => void;
}

export function ModalNotificarAfectado({
  isOpen,
  retiroId,
  afectadoId,
  afectado,
  fechaRetiro,
  onClose,
  onNotificado,
}: ModalNotificarAfectadoProps) {
  const [values, setValues] = useState({
    fecha_notificacion: hoyISO(),
    medio_contacto: "" as string | null,
    observacion: "" as string | null,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setValues({
        fecha_notificacion: hoyISO(),
        medio_contacto: null,
        observacion: null,
      });
      setError(null);
    } else {
      // Limpieza al cerrar: resetea el formulario para la próxima apertura
      setValues({
        fecha_notificacion: hoyISO(),
        medio_contacto: null,
        observacion: null,
      });
      setError(null);
      setEnviando(false);
    }
  }

  const faltan = faltantes({
    fecha_notificacion: [!values.fecha_notificacion, "la fecha de notificación"],
  });

  const fechaInvalida =
    values.fecha_notificacion.trim() !== "" &&
    (values.fecha_notificacion < fechaRetiro || values.fecha_notificacion > hoyISO());

  const guardando = async () => {
    setEnviando(true);
    setError(null);
    try {
      await notificarAfectado(retiroId, afectadoId, {
        fecha_notificacion: values.fecha_notificacion,
        medio_contacto: values.medio_contacto?.trim() || null,
        observacion: values.observacion?.trim() || null,
      });
      onNotificado();
      onClose(); // Cerrar el modal tras notificar correctamente
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo notificar al afectado.");
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
        width="480px"
        maxWidth="90vw"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="4" fontSize="lg" fontWeight="bold" color="brand.fg">
          Notificar al cliente
        </DialogTitle>

        <DialogDescription color="fg.muted" mb="4">
          Registrá la notificación al cliente afectado por el retiro del lote.
        </DialogDescription>

        {/* Contexto del afectado: contacto y entrega, a la vista al registrar. */}
        {afectado && (
          <Box
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="md"
            p="4"
            mb="5"
          >
            <Text fontSize="sm" fontWeight="semibold" color="fg" mb="3">
              {afectado.cliente_nombre}
            </Text>
            <SimpleGrid columns={2} gap="3">
              <DatoDetalle etiqueta="Teléfono">
                {afectado.cliente_telefono ?? "Sin teléfono"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Email">
                {afectado.cliente_email ?? "Sin email"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Cantidad">
                {afectado.cantidad_con_unidad}
              </DatoDetalle>
              <DatoDetalle etiqueta="Transportista">
                {afectado.transportista}
              </DatoDetalle>
            </SimpleGrid>
          </Box>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {error ? <MensajeError>{error}</MensajeError> : null}
          <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

          <FormField
            label="Fecha de notificación"
            required
            mb="0"
            invalid={(intentado && faltan.tiene("fecha_notificacion")) || fechaInvalida}
            helper={`Entre ${formatoFecha(fechaRetiro)} y hoy (${formatoFecha(hoyISO())})`}
          >
            <FormInput
              type="date"
              min={fechaRetiro}
              max={hoyISO()}
              value={values.fecha_notificacion}
              onChange={(e) => setValues({ ...values, fecha_notificacion: e.target.value })}
            />
          </FormField>

          <FormField label="Medio de contacto" mb="0">
            <FormNativeSelect
              value={values.medio_contacto ?? ""}
              onChange={(e) =>
                setValues({ ...values, medio_contacto: e.target.value || null })
              }
            >
              <option value="">-- Medio de contacto --</option>
              {MEDIOS_CONTACTO_RETIRO.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField label="Observación (opcional)" mb="0">
            <FormInput
              type="text"
              value={values.observacion ?? ""}
              onChange={(e) => setValues({ ...values, observacion: e.target.value || null })}
              placeholder="Ej: Se contactó por WhatsApp y confirmó recepción."
              maxLength={500}
            />
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={enviando} disabled={enviando}>
              Marcar como notificado
            </BotonGuardar>
            <BotonCancelar onClick={onClose} disabled={enviando}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
