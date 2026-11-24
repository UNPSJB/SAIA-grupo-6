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
  const [mercaderiaDevuelta, setMercaderiaDevuelta] = useState(false);
  const [cantidadDevuelta, setCantidadDevuelta] = useState("");
  const [disponibleDevolucion, setDisponibleDevolucion] = useState(0);
  const [devolucionYaRegistrada, setDevolucionYaRegistrada] = useState<string | null>(null);
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
      .then((data) => {
        if (!vigente) return;
        const { salida, incidente, reposicion: yaGenerada } = data;
        if (data.cantidad_devuelta) {
          setDevolucionYaRegistrada(data.cantidad_devuelta);
          setMercaderiaDevuelta(false);
        }
        const disponibleRaw = salida.cantidad_disponible_devolucion ?? salida.cantidad;
        const disponible = Number(disponibleRaw.replace(",", "."));
        if (Number.isFinite(disponible)) {
          setDisponibleDevolucion(disponible);
          if (disponible > 0) {
            setCantidadDevuelta(String(disponible));
          }
        }
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
  const cantidadNum = Number(cantidadReponer);
  const cantidadInvalida = generarReposicion && !(cantidadNum > 0);
  const cantidadDevueltaNum = Number(cantidadDevuelta);
  const cantidadDevueltaInvalida =
    mercaderiaDevuelta &&
    (!(cantidadDevueltaNum > 0) ||
      (disponibleDevolucion > 0 && cantidadDevueltaNum > disponibleDevolucion));

  const handleConfirmar = async () => {
    setIntento(true);
    if (campoInvalido || cantidadInvalida || cantidadDevueltaInvalida) return;
    setEnviando(true);
    setError(null);
    try {
      onCerrado(
        await cerrarReclamo(reclamo.id, {
          accion_correctiva: observacion.trim(),
          mercaderia_devuelta: mercaderiaDevuelta,
          disposicion_fisica: mercaderiaDevuelta ? "BAJA" : null,
          cantidad_devuelta: mercaderiaDevuelta ? cantidadDevueltaNum : null,
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

          {/* BLOQUE 1: Acción Física (Calidad / Inocuidad) */}
          {devolucionYaRegistrada ? (
            <Box
              p="3.5"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="md"
            >
              <Text fontSize="sm" fontWeight="semibold" color="fg">
                Este reclamo ya registró una devolución física de{" "}
                {cantidadConUnidad(devolucionYaRegistrada, unidadAfectada)}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="0.5">
                La mercadería fue dada de baja sanitaria (desechada en el lote). No se vuelve a descontar al cerrarlo.
              </Text>
            </Box>
          ) : disponibleDevolucion <= 0 ? (
            <Box
              p="3.5"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="md"
            >
              <Text fontSize="sm" fontWeight="semibold" color="fg">
                Sin saldo de entrega disponible para devolver
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="0.5">
                La totalidad de las unidades de esta entrega ya fueron devueltas y dadas de baja en reclamos anteriores.
              </Text>
            </Box>
          ) : (
            <Box>
              <Box
                p="3.5"
                bg={mercaderiaDevuelta ? "orange.subtle" : "bg.subtle"}
                borderWidth="1px"
                borderColor={mercaderiaDevuelta ? "orange.border" : "border.subtle"}
                rounded="md"
                cursor="pointer"
                transition="background-color 0.15s ease, border-color 0.15s ease"
                onClick={() => setMercaderiaDevuelta((prev) => !prev)}
              >
                <HStack gap="3" align="center">
                  <Box onClick={(e) => e.stopPropagation()}>
                    <Checkbox.Root
                      checked={mercaderiaDevuelta}
                      onCheckedChange={(e) =>
                        setMercaderiaDevuelta(Boolean(e.checked))
                      }
                      colorPalette="orange"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control cursor="pointer" />
                    </Checkbox.Root>
                  </Box>
                  <Box flex="1">
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      color={mercaderiaDevuelta ? "orange.fg" : "fg"}
                    >
                      Se recibió mercadería devuelta en planta (Baja / Descarte sanitario)
                    </Text>
                    <Text fontSize="xs" color="fg.muted" mt="0.5">
                      Por pérdida de cadena de custodia, las unidades devueltas por el cliente no vuelven al saldo vendible: se descuentan de lo entregado y pasan a 'Desechado' en el lote.
                    </Text>
                  </Box>
                </HStack>
              </Box>

              {mercaderiaDevuelta && (
                <Box mt="3" pl="1">
                  <FormField
                    label={unidadAfectada ? `Cantidad devuelta a descartar (${unidadAfectada})` : "Cantidad devuelta a descartar"}
                    required
                    mb="0"
                    invalid={intento && cantidadDevueltaInvalida}
                    helper={`Máximo disponible para devolver de esta entrega: ${cantidadConUnidad(disponibleDevolucion, unidadAfectada)}.`}
                  >
                    <FormInput
                      type="number"
                      min="0"
                      max={disponibleDevolucion}
                      step="any"
                      value={cantidadDevuelta}
                      onChange={(e) => setCantidadDevuelta(e.target.value)}
                      placeholder="0"
                    />
                    {intento && cantidadDevueltaInvalida ? (
                      <MensajeError>
                        Ingresá una cantidad mayor a 0 y que no supere {cantidadConUnidad(disponibleDevolucion, unidadAfectada)}.
                      </MensajeError>
                    ) : null}
                  </FormField>
                </Box>
              )}
            </Box>
          )}

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
