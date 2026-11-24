import { useEffect, useState } from "react";
import { Box, Checkbox, HStack, Separator, Text, Textarea, VStack } from "@chakra-ui/react";
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
import { formatoFecha } from "../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { MiniaturaFoto } from "../../incidente/components/MiniaturaFoto";
import { cerrarReclamo, obtenerReclamo } from "../services/reclamoService";
import type { ReclamoDetalle, ReclamoResumen } from "../types/reclamo";
import { BadgePlazo, BadgePrioridad } from "./ReclamosTable";

interface ModalCerrarReclamoProps {
  /** Reclamo a cerrar; `null` con el modal cerrado. */
  reclamo: ReclamoResumen | null;
  onClose: () => void;
  onCerrado: (reclamo: ReclamoDetalle) => void;
}

type AccionFisica = "SIN_DEVOLUCION" | "CON_DEVOLUCION";
type DisposicionFisica = "CUARENTENA" | "BAJA";

/**
 * Cierre de un reclamo de cliente: la acción correctiva, qué pasó con la
 * mercadería y si se le debe una reposición. Cierra también su incidente.
 */
export function ModalCerrarReclamo({ reclamo, onClose, onCerrado }: ModalCerrarReclamoProps) {
  // La clave reinicia el formulario con cada reclamo que se abre.
  if (!reclamo) return null;
  return (
    <Formulario key={reclamo.id} reclamo={reclamo} onClose={onClose} onCerrado={onCerrado} />
  );
}

function Formulario({
  reclamo,
  onClose,
  onCerrado,
}: ModalCerrarReclamoProps & { reclamo: ReclamoResumen }) {
  const [observacion, setObservacion] = useState("");
  const [accionFisica, setAccionFisica] = useState<AccionFisica>("SIN_DEVOLUCION");
  const [disposicionFisica, setDisposicionFisica] = useState<DisposicionFisica>("CUARENTENA");
  const [generarReposicion, setGenerarReposicion] = useState(false);
  const [cantidadReponer, setCantidadReponer] = useState("");
  const [unidadAfectada, setUnidadAfectada] = useState("");
  const [reposicion, setReposicion] = useState<ReclamoDetalle["reposicion"]>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Foto, reposición ya generada y cantidad entregada, que se sugiere a reponer.
  useEffect(() => {
    let vigente = true;
    obtenerReclamo(reclamo.id)
      .then(({ salida, incidente, reposicion: yaGenerada }) => {
        if (!vigente) return;
        const cantidad = Number(salida.cantidad.replace(",", "."));
        if (Number.isFinite(cantidad) && cantidad > 0) setCantidadReponer(String(cantidad));
        setUnidadAfectada(salida.unidad_medida);
        setFotoUrl(incidente?.foto_url ?? null);
        setReposicion(yaGenerada);
        if (yaGenerada) setGenerarReposicion(false);
      })
      .catch(() => {
        // No bloquea el cierre: es contexto, y la cantidad se puede escribir.
      });
    return () => {
      vigente = false;
    };
  }, [reclamo.id]);

  const campoInvalido = !observacion.trim();
  const mercaderiaDevuelta = accionFisica === "CON_DEVOLUCION";
  const cantidadNum = Number(cantidadReponer);
  const cantidadInvalida = generarReposicion && !(cantidadNum > 0);

  const handleConfirmar = async () => {
    setIntento(true);
    if (campoInvalido || cantidadInvalida) return;
    setEnviando(true);
    setError(null);
    try {
      onCerrado(
        await cerrarReclamo(reclamo.id, {
          accion_correctiva: observacion.trim(),
          mercaderia_devuelta: mercaderiaDevuelta,
          disposicion_fisica: mercaderiaDevuelta ? disposicionFisica : null,
          generar_reposicion: generarReposicion,
          cantidad_a_reponer: generarReposicion ? cantidadNum : null,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el reclamo.");
      setEnviando(false);
    }
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
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Cerrar reclamo <strong>#{reclamo.id}</strong>
        </DialogTitle>

        <Box p="3" bg="bg.muted" rounded="md" mb="4">
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
          <HStack gap="2" flexWrap="wrap" mt="3">
            <Text fontSize="sm" color="fg">
              {reclamo.motivo_label}
            </Text>
            <BadgePrioridad motivo={reclamo.motivo} />
            <BadgePlazo dias={reclamo.dias_desde_entrega} fueraDePlazo={reclamo.fuera_de_plazo} />
          </HStack>
          {reclamo.detalle && (
            <Text fontSize="xs" color="fg.muted" whiteSpace="pre-line" mt="2">
              {reclamo.detalle}
            </Text>
          )}
          {fotoUrl && (
            <Box mt="3">
              <MiniaturaFoto rutaFoto={fotoUrl} />
            </Box>
          )}
        </Box>

        <DialogDescription color="fg.muted" mb="4">
          Se deja asentada la acción correctiva, la fecha de cierre y vos como
          responsable de la resolución.
        </DialogDescription>

        {error && <MensajeError>{error}</MensajeError>}

        <VStack align="stretch" gap="4" mb="5">
          <FormField
            label="Acción correctiva"
            required
            mb="0"
            invalid={intento && campoInvalido}
          >
            <Textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              placeholder="Ej: Se verificó el lote de producción, se contactó al cliente y se gestionó la reposición."
              resize="vertical"
            />
            {intento && campoInvalido ? (
              <MensajeError>La acción correctiva es obligatoria.</MensajeError>
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
          {reposicion ? (
            <Box
              p="3.5"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="md"
            >
              <Text fontSize="sm" fontWeight="semibold" color="fg">
                Este reclamo ya generó una reposición de{" "}
                {cantidadConUnidad(reposicion.cantidad_original, unidadAfectada)}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="0.5">
                {Number(reposicion.cantidad_pendiente) > 0
                  ? `Falta entregar ${cantidadConUnidad(reposicion.cantidad_pendiente, unidadAfectada)}.`
                  : "Ya se entregó completa."}{" "}
                No se genera otra al volver a cerrarlo.
              </Text>
            </Box>
          ) : (
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
                    label={unidadAfectada ? `Cantidad a reponer (${unidadAfectada})` : "Cantidad a reponer"}
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
          )}
        </VStack>

        <AccionesFormulario>
          <BotonGuardar
            type="button"
            onClick={() => void handleConfirmar()}
            loading={enviando}
          >
            Cerrar reclamo
          </BotonGuardar>
          <BotonCancelar onClick={onClose} disabled={enviando}>
            Cancelar
          </BotonCancelar>
        </AccionesFormulario>
      </DialogContent>
    </DialogRoot>
  );
}
