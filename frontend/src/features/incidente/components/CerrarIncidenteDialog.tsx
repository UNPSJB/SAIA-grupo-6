import { useState, useEffect } from "react";
import { Badge, Box, HStack, Text, Textarea } from "@chakra-ui/react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  MensajeError,
} from "../../../components/ui/patrones";
import { formatoFecha } from "../../../common/utils/fechas";
import { MiniaturaFoto } from "./MiniaturaFoto";
import { listarReclamos } from "../../reclamos/services/reclamoService";
import type { Incidente } from "../types/incidente";
import type { ReclamoResumen } from "../../reclamos/types/reclamo";

interface CerrarIncidenteDialogProps {
  isOpen: boolean;
  incidente: Incidente | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (observacionCierre: string) => void;
}

/**
 * Confirmación de cierre de un incidente.
 *
 * El incidente no se borra: queda en estado cerrado con la acción correctiva
 * que se realizó, la fecha de cierre y quién lo resolvió.
 *
 * Cuando el incidente es un reclamo de cliente (tipo `reclamo_cliente`),
 * muestra una tarjeta de resumen con los datos del reclamo vinculado para que
 * quien lo cierra tenga el contexto completo antes de documentar la
 * resolución.
 */
export function CerrarIncidenteDialog({
  isOpen,
  incidente,
  isLoading,
  onClose,
  onConfirm,
}: CerrarIncidenteDialogProps) {
  const [observacion, setObservacion] = useState("");
  const [intento, setIntento] = useState(false);
  const [reclamo, setReclamo] = useState<ReclamoResumen | null>(null);
  const [cargandoReclamo, setCargandoReclamo] = useState(false);

  // Cada apertura arranca vacía.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setObservacion("");
      setIntento(false);
      setReclamo(null);
      setCargandoReclamo(false);
    }
  }

  // Si es un reclamo de cliente, traer sus datos para el resumen del cierre.
  useEffect(() => {
    if (!isOpen || !incidente || incidente.tipo !== "reclamo_cliente") {
      setReclamo(null);
      return;
    }
    setCargandoReclamo(true);
    void listarReclamos({ incidente_id: incidente.id })
      .then((lista) => {
        setReclamo(lista[0] ?? null);
      })
      .catch(() => {
        setReclamo(null);
      })
      .finally(() => {
        setCargandoReclamo(false);
      });
  }, [isOpen, incidente]);

  const esReclamoCliente: boolean = incidente?.tipo === "reclamo_cliente";
  const observacionVacia = !observacion.trim();
  const campoInvalido = esReclamoCliente && observacionVacia;
  const deshabilitarGuardar = isLoading || campoInvalido;

  if (!isOpen || !incidente) return null;

  const tieneResumenReclamo = esReclamoCliente && reclamo !== null;

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
        width={tieneResumenReclamo ? "560px" : "440px"}
        maxWidth="92vw"
        maxHeight="85vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Cerrar incidente <strong>#{incidente.id}</strong>
        </DialogTitle>

        {tieneResumenReclamo && (
          <Box p="3" bg="bg.muted" rounded="md" mb="5">
            <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="2">
              Reclamo de cliente vinculado
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              {reclamo.cliente_nombre}
            </Text>
            <Text fontSize="sm" color="fg">
              {reclamo.producto_nombre} · {reclamo.lote_numero}
            </Text>
            <HStack gap="4" align="baseline" wrap="wrap" mt="2">
              <Text fontSize="xs" color="fg.muted">
                Entrega: {formatoFecha(reclamo.fecha_entrega)}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Reclamo: {formatoFecha(reclamo.fecha_reclamo)}
              </Text>
            </HStack>
            <Text fontSize="xs" fontWeight="medium" color="fg.muted" mt="3" mb="1">
              Motivo
            </Text>
            <HStack gap="2" flexWrap="wrap" mb="2">
              <Text fontSize="sm" color="fg">
                {reclamo.motivo_label}
              </Text>
              {reclamo.motivo === "posible_afectacion_salud" && (
                <Badge colorPalette="red" variant="subtle" size="xs">
                  Prioridad
                </Badge>
              )}
            </HStack>
            <Text fontSize="xs" fontWeight="medium" color="fg.muted" mt="2" mb="1">
              Detalle del reclamo
            </Text>
            <Text fontSize="xs" color="fg.muted" whiteSpace="pre-line" mb="3">
              {reclamo.detalle ?? "Sin detalle registrado."}
            </Text>
            <HStack gap="3" align="baseline">
              <Badge
                colorPalette={reclamo.fuera_de_plazo ? "orange" : "green"}
                variant="subtle"
              >
                {reclamo.fuera_de_plazo ? "Fuera de plazo" : "En plazo"} (
                {reclamo.dias_desde_entrega}{" "}
                {reclamo.dias_desde_entrega === 1 ? "día" : "días"})
              </Badge>
              {incidente.foto_url && (
                <Box mt="1">
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Foto adjunta al incidente
                  </Text>
                  <MiniaturaFoto rutaFoto={incidente.foto_url} />
                </Box>
              )}
            </HStack>
          </Box>
        )}

        {!esReclamoCliente && (
          <Box p="3" bg="bg.muted" rounded="md" mb="5">
            <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="2">
              Incidente
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              {incidente.titulo}
            </Text>
            <Text fontSize="xs" color="fg.muted" mt="1">
              {incidente.descripcion}
            </Text>
            <HStack gap="4" align="baseline" wrap="wrap" mt="3">
              <Badge colorPalette="blue" variant="subtle" size="xs">
                {incidente.tipo}
              </Badge>
            </HStack>
          </Box>
        )}

        <DialogDescription color="fg.muted" mb="4">
          Se deja asentada la acción correctiva, la fecha de cierre y vos como
          responsable de la resolución.
        </DialogDescription>

        <FormField
          label={
            esReclamoCliente ? "Acción correctiva *" : "Acción correctiva (opcional)"
          }
          mb="6"
          invalid={intento && campoInvalido}
        >
          <Textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={4}
            placeholder={
              esReclamoCliente
                ? "Ej: Se verificó el lote de producción, se contactó al cliente y se gestionó la reposición."
                : "Ej: Se lavó y desinfectó el equipo y se cambió el termostato."
            }
            resize="vertical"
          />
          {intento && campoInvalido ? (
            <MensajeError>
              La acción correctiva es obligatoria para cerrar un reclamo de
              cliente.
            </MensajeError>
          ) : null}
        </FormField>

        {esReclamoCliente && (
          <Box p="3" rounded="md" bg="orange.subtle" color="orange.fg" mb="4">
            <Text fontSize="xs" fontWeight="medium">
              Al confirmar se cierra el incidente
            </Text>
            <Text fontSize="xs">
              La acción correctiva quedará registrada junto con tu usuario y la
              fecha actual como resolución del reclamo de cliente.
            </Text>
          </Box>
        )}

        <AccionesFormulario>
          <BotonGuardar
            type="button"
            onClick={() => {
              setIntento(true);
              if (campoInvalido) return;
              onConfirm(observacion);
            }}
            loading={isLoading || cargandoReclamo}
            disabled={deshabilitarGuardar || cargandoReclamo}
          >
            Cerrar incidente
          </BotonGuardar>
          <BotonCancelar onClick={onClose} disabled={isLoading}>
            Cancelar
          </BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}
