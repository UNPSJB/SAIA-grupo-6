import { useState, useEffect } from "react";
import {
  Badge,
  Box,
  Checkbox,
  HStack,
  Separator,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
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
  FormInput,
  FormNativeSelect,
  MensajeError,
} from "../../../components/ui/patrones";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import { formatoFecha } from "../../../common/utils/fechas";
import { useNotificacionesListener } from "../../notificaciones/hooks/useNotificacionesListener";
import { MiniaturaFoto } from "./MiniaturaFoto";
import { listarReclamos, obtenerReclamo } from "../../reclamos/services/reclamoService";
import { obtenerSalida } from "../../salidas/services/salidaService";
import type { Incidente } from "../types/incidente";
import type { ReclamoResumen } from "../../reclamos/types/reclamo";

export interface CerrarIncidentePayload {
  observacion_cierre: string | null;
  mercaderia_devuelta: boolean;
  disposicion_fisica?: "CUARENTENA" | "BAJA" | null;
  generar_reposicion: boolean;
  cantidad_a_reponer?: number | null;
}

interface CerrarIncidenteDialogProps {
  isOpen: boolean;
  incidente: Incidente | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (observacionCierre: string, payload?: CerrarIncidentePayload) => void;
}

type AccionFisica = "SIN_DEVOLUCION" | "CON_DEVOLUCION";
type DisposicionFisica = "CUARENTENA" | "BAJA";

/**
 * Confirmación de cierre / resolución de un incidente.
 *
 * Incluye los selectores de:
 * - Bloque 1: Acción física tomada con la mercadería y disposición física condicional.
 * - Bloque 2: Acción comercial (generación opcional de reposición de stock con prioridad alta).
 */
export function CerrarIncidenteDialog({
  isOpen,
  incidente,
  isLoading,
  onClose,
  onConfirm,
}: CerrarIncidenteDialogProps) {
  const { notificarCambio } = useNotificacionesListener();

  const [observacion, setObservacion] = useState("");
  const [accionFisica, setAccionFisica] = useState<AccionFisica>("SIN_DEVOLUCION");
  const [disposicionFisica, setDisposicionFisica] =
    useState<DisposicionFisica>("CUARENTENA");
  const [generarReposicion, setGenerarReposicion] = useState(false);
  const [cantidadReponer, setCantidadReponer] = useState("");
  const [unidadAfectada, setUnidadAfectada] = useState<string>("unidades/kg");

  const [intento, setIntento] = useState(false);
  const [reclamo, setReclamo] = useState<ReclamoResumen | null>(null);
  const [cargandoReclamo, setCargandoReclamo] = useState(false);
  const [enviandoPropio, setEnviandoPropio] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null);

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setObservacion("");
      setAccionFisica("SIN_DEVOLUCION");
      setDisposicionFisica("CUARENTENA");
      setGenerarReposicion(false);
      setCantidadReponer("");
      setUnidadAfectada("unidades/kg");
      setIntento(false);
      setReclamo(null);
      setCargandoReclamo(false);
      setEnviandoPropio(false);
      setErrorSubmit(null);
    }
  }

  // Cargar datos del reclamo vinculado y la cantidad original de la entrega/salida afectada
  useEffect(() => {
    if (!isOpen || !incidente) {
      setReclamo(null);
      return;
    }

    let vigente = true;

    const cargarContexto = async () => {
      if (incidente.tipo === "reclamo_cliente") {
        setCargandoReclamo(true);
        try {
          const lista = await listarReclamos({ incidente_id: incidente.id });
          if (!vigente) return;
          const primero = lista[0] ?? null;
          setReclamo(primero);
          if (primero) {
            try {
              const det = await obtenerReclamo(primero.id);
              if (!vigente) return;
              if (det.salida?.cantidad) {
                const num = Number(
                  String(det.salida.cantidad).replace(",", ".")
                );
                if (Number.isFinite(num) && num > 0) {
                  setCantidadReponer(num.toString());
                }
              }
              if (det.salida?.unidad_medida) {
                setUnidadAfectada(det.salida.unidad_medida);
              }
              return;
            } catch {
              // Continúa con fallback a salida_id si falla
            }
          }
        } catch {
          if (vigente) setReclamo(null);
        } finally {
          if (vigente) setCargandoReclamo(false);
        }
      }

      if (incidente.salida_id) {
        try {
          const sal = await obtenerSalida(incidente.salida_id);
          if (!vigente) return;
          const num = Number(String(sal.cantidad).replace(",", "."));
          if (Number.isFinite(num) && num > 0) {
            setCantidadReponer(num.toString());
          }
          if (sal.unidad_medida) {
            setUnidadAfectada(sal.unidad_medida);
          }
        } catch {
          // No bloquea el cierre si no se puede leer la salida
        }
      }
    };

    void cargarContexto();
    return () => {
      vigente = false;
    };
  }, [isOpen, incidente]);

  const esReclamoCliente: boolean = incidente?.tipo === "reclamo_cliente";
  const observacionVacia = !observacion.trim();
  const campoInvalido = esReclamoCliente && observacionVacia;

  const mercaderiaDevuelta = accionFisica === "CON_DEVOLUCION";
  const disposicionInvalida = mercaderiaDevuelta && !disposicionFisica;

  const cantidadNum = Number(cantidadReponer);
  const cantidadInvalida =
    generarReposicion &&
    (!cantidadReponer.trim() ||
      !Number.isFinite(cantidadNum) ||
      cantidadNum <= 0);

  const procesando = Boolean(isLoading || enviandoPropio || cargandoReclamo);
  const deshabilitarGuardar =
    procesando || campoInvalido || disposicionInvalida || cantidadInvalida;

  if (!isOpen || !incidente) return null;

  const tieneResumenReclamo = esReclamoCliente && reclamo !== null;

  const handleConfirmarCierre = async () => {
    setIntento(true);
    setErrorSubmit(null);
    if (campoInvalido || disposicionInvalida || cantidadInvalida) return;

    const payload: CerrarIncidentePayload = {
      observacion_cierre: observacion.trim() ? observacion.trim() : null,
      mercaderia_devuelta: mercaderiaDevuelta,
      disposicion_fisica: mercaderiaDevuelta ? disposicionFisica : null,
      generar_reposicion: generarReposicion,
      cantidad_a_reponer: generarReposicion ? Number(cantidadReponer) : null,
    };

    // Si se activó devolución física o reposición comercial, enviamos el PATCH completo
    // directamente al endpoint para garantizar que los 4 campos nuevos viajen al backend.
    if (mercaderiaDevuelta || generarReposicion) {
      setEnviandoPropio(true);
      try {
        const res = await apiFetch(
          `${API_URL}/incidentes/${incidente.id}/estado`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              estado: "cerrado",
              ...payload,
            }),
          }
        );
        await pedir<Incidente>(res, "No se pudo cerrar el incidente");
        notificarCambio();
        // Notificar al padre: como el incidente ya quedó en estado 'cerrado',
        // la llamada posterior del padre es idempotente en el backend y refresca la lista.
        onConfirm(observacion, payload);
      } catch (err) {
        setErrorSubmit(
          err instanceof Error ? err.message : "No se pudo cerrar el incidente."
        );
      } finally {
        setEnviandoPropio(false);
      }
      return;
    }

    onConfirm(observacion, payload);
  };

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
        width="560px"
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
          Cerrar incidente <strong>#{incidente.id}</strong>
        </DialogTitle>

        {tieneResumenReclamo && (
          <Box p="3" bg="bg.muted" rounded="md" mb="4">
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
          <Box p="3" bg="bg.muted" rounded="md" mb="4">
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

        {errorSubmit && <MensajeError>{errorSubmit}</MensajeError>}

        <VStack align="stretch" gap="4" mb="5">
          {/* Acción correctiva */}
          <FormField
            label={
              esReclamoCliente
                ? "Acción correctiva *"
                : "Acción correctiva (opcional)"
            }
            mb="0"
            invalid={intento && campoInvalido}
          >
            <Textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
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

          {/* BLOQUE 1: Acción Física (Calidad) */}
          <Box
            p="3.5"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="md"
          >
            <VStack align="stretch" gap="3">
              <FormField
                label="Acción física tomada con la mercadería"
                mb="0"
              >
                <FormNativeSelect
                  value={accionFisica}
                  onChange={(e) =>
                    setAccionFisica(e.target.value as AccionFisica)
                  }
                >
                  <option value="SIN_DEVOLUCION">
                    No hubo devolución física (solo registro)
                  </option>
                  <option value="CON_DEVOLUCION">
                    Se recibió mercadería devuelta en planta
                  </option>
                </FormNativeSelect>
              </FormField>

              {mercaderiaDevuelta && (
                <FormField
                  label="Disposición física"
                  required
                  mb="0"
                  invalid={intento && disposicionInvalida}
                  helper="Indicá el destino en planta de las unidades devueltas por el cliente."
                >
                  <FormNativeSelect
                    value={disposicionFisica}
                    onChange={(e) =>
                      setDisposicionFisica(e.target.value as DisposicionFisica)
                    }
                  >
                    <option value="CUARENTENA">
                      CUARENTENA (Reingreso a cuarentena)
                    </option>
                    <option value="BAJA">
                      BAJA (Descarte/Destrucción)
                    </option>
                  </FormNativeSelect>
                </FormField>
              )}
            </VStack>
          </Box>

          {/* Separador entre Bloque 1 (Calidad) y Bloque 2 (Comercial) */}
          <Separator />

          {/* BLOQUE 2: Acción Comercial (Reposición) */}
          <Box>
            <Box
              p="3.5"
              bg={generarReposicion ? "teal.subtle" : "bg.subtle"}
              borderWidth="1px"
              borderColor={generarReposicion ? "teal.border" : "border.subtle"}
              rounded="md"
              cursor="pointer"
              transition="background-color 0.15s ease, border-color 0.15s ease"
              onClick={() => setGenerarReposicion((prev) => !prev)}
            >
              <HStack gap="3" align="center">
                <Box onClick={(e) => e.stopPropagation()}>
                  <Checkbox.Root
                    checked={generarReposicion}
                    onCheckedChange={(e) =>
                      setGenerarReposicion(Boolean(e.checked))
                    }
                    colorPalette="teal"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control cursor="pointer" />
                  </Checkbox.Root>
                </Box>
                <Box flex="1">
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color={generarReposicion ? "teal.fg" : "fg"}
                  >
                    Generar deuda comercial (Reposición de stock) para este cliente
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mt="0.5">
                    Registrará una reposición pendiente con prioridad ALTA en la bandeja de Operaciones.
                  </Text>
                </Box>
              </HStack>
            </Box>

            {generarReposicion && (
              <Box mt="3" pl="1">
                <FormField
                  label={`Cantidad a reponer (${unidadAfectada})`}
                  required
                  mb="0"
                  invalid={intento && cantidadInvalida}
                  helper="Por defecto se sugiere la cantidad entregada en la salida afectada."
                >
                  <FormInput
                    type="number"
                    min="0"
                    step="any"
                    value={cantidadReponer}
                    onChange={(e) => setCantidadReponer(e.target.value)}
                    placeholder="0"
                  />
                  {intento && cantidadInvalida ? (
                    <MensajeError>
                      Ingresá una cantidad válida mayor a 0 para generar la
                      reposición.
                    </MensajeError>
                  ) : null}
                </FormField>
              </Box>
            )}
          </Box>
        </VStack>

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
            onClick={() => void handleConfirmarCierre()}
            loading={procesando}
            disabled={deshabilitarGuardar}
          >
            Cerrar incidente
          </BotonGuardar>
          <BotonCancelar onClick={onClose} disabled={procesando}>
            Cancelar
          </BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}

export { CerrarIncidenteDialog as ModalResolverIncidente };
