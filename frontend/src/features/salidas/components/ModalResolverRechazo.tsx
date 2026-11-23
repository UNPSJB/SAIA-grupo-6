import { avisarExito } from "../../../components/ui/patrones";
import { useState } from "react";
import { Box, Button, Checkbox, HStack, Input, Text, Textarea, VStack } from "@chakra-ui/react";
import { LuCircleCheck, LuTrash2 } from "react-icons/lu";
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
import { formatoFecha } from "../../../common/utils/fechas";
import { MiniaturaFoto } from "../../incidente/components/MiniaturaFoto";
import { resolverRechazo } from "../services/salidaService";
import type { DisposicionRechazo } from "../types/salida";

interface ModalResolverRechazoProps {
  isOpen: boolean;
  salidaId: number;
  loteNumero: string;
  productoNombre: string;
  clienteNombre: string;
  cantidad: string;
  unidadMedida: string;
  motivoRechazoLabel: string | null;
  detalleRechazo: string | null;
  fechaRechazo: string | null;
  rechazadaPorNombre: string | null;
  incidenteFotoUrl: string | null;
  /** El lote de origen está vencido: no se puede reingresar la mercadería. */
  loteVencido: boolean;
  /** El lote de origen está retirado: no se puede reingresar la mercadería. */
  loteRetirado: boolean;
  onClose: () => void;
  onRechazoResuelto: () => void;
}

/**
 * Modal para resolver un rechazo (Historia B).
 *
 * Un administrador decide el destino de la mercadería rechazada:
 * reingresarla al lote o desecharla. La justificación es obligatoria y la
 * decisión es definitiva (el backend no permite modificarla). Si el lote está
 * vencido o retirado, el reingreso queda deshabilitado y solo se puede
 * desechar: la opción se muestra igual para que el motivo sea visible.
 */
export function ModalResolverRechazo({
  isOpen,
  salidaId,
  loteNumero,
  productoNombre,
  clienteNombre,
  cantidad,
  unidadMedida,
  motivoRechazoLabel,
  detalleRechazo,
  fechaRechazo,
  rechazadaPorNombre,
  incidenteFotoUrl,
  loteVencido,
  loteRetirado,
  onClose,
  onRechazoResuelto,
}: ModalResolverRechazoProps) {
  const reingresoBloqueado = loteVencido || loteRetirado;

  const [disposicion, setDisposicion] = useState<DisposicionRechazo | "">("");
  const [justificacion, setJustificacion] = useState("");
  const [generarReposicion, setGenerarReposicion] = useState(false);
  const [cantidadAReponer, setCantidadAReponer] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setDisposicion("");
      setJustificacion("");
      setGenerarReposicion(false);
      // Limpiar ceros decimales innecesarios: "50.000" -> "50"
      setCantidadAReponer(Number(cantidad).toString());
      setError(null);
    }
  }

  const faltan = faltantes({
    disposicion: [!disposicion, "el destino de la mercadería"],
    justificacion: [!justificacion.trim(), "la justificación de la decisión"],
  });

  const guardando = async () => {
    if (!disposicion) return;
    setEnviando(true);
    setError(null);

    try {
      await resolverRechazo(salidaId, {
        disposicion,
        justificacion: justificacion.trim(),
        generar_reposicion: generarReposicion,
        cantidad_a_reponer: generarReposicion ? Number(cantidadAReponer) : undefined,
      });
      avisarExito("Rechazo resuelto correctamente.");
      onRechazoResuelto();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo resolver el rechazo."
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmit = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeEnviar(faltan.lista) || !disposicion) return;
    if (disposicion === "REINGRESADA" && reingresoBloqueado) return;
    void guardando();
  };

  if (!isOpen) return null;

  const opciones: {
    valor: DisposicionRechazo;
    titulo: string;
    detalle: string;
    icono: typeof LuCircleCheck;
  }[] = [
    {
      valor: "REINGRESADA",
      titulo: "Reingresar al lote",
      detalle:
        "La cantidad vuelve al saldo disponible del lote. Solo si el lote no está vencido ni retirado.",
      icono: LuCircleCheck,
    },
    {
      valor: "DESECHADA",
      titulo: "Desechar",
      detalle:
        "La cantidad se da de baja y no vuelve al saldo. Queda registrada como desecho.",
      icono: LuTrash2,
    },
  ];

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
        maxHeight="85vh"
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
          Resolver rechazo
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error ? <MensajeError>{error}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            {/* Resumen del rechazo */}
            <Box p="3" bg="bg.muted" rounded="md">
              <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                Entrega rechazada
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {productoNombre} ({loteNumero})
              </Text>
              <Text fontSize="sm" color="fg">
                {cantidadConUnidad(cantidad, unidadMedida)} para {clienteNombre}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="2">
                Motivo: {motivoRechazoLabel ?? "—"}
              </Text>
              {detalleRechazo && (
                <Text fontSize="xs" color="fg.muted" whiteSpace="pre-line">
                  Detalle: {detalleRechazo}
                </Text>
              )}
              {fechaRechazo && (
                <Text fontSize="xs" color="fg.muted">
                  Fecha del rechazo: {formatoFecha(fechaRechazo)}
                </Text>
              )}
              {rechazadaPorNombre && (
                <Text fontSize="xs" color="fg.muted">
                  Registrado por {rechazadaPorNombre}
                </Text>
              )}
              {incidenteFotoUrl && (
                <Box mt="3">
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Foto adjunta al incidente
                  </Text>
                  <MiniaturaFoto rutaFoto={incidenteFotoUrl} />
                </Box>
              )}
            </Box>

            <FormField
              label="Destino de la mercadería"
              required
              mb="0"
              invalid={intentado && faltan.tiene("disposicion")}
              helper="La decisión no se puede modificar una vez confirmada."
            >
              <VStack align="stretch" gap="2">
                {opciones.map((opcion) => {
                  const bloqueada =
                    opcion.valor === "REINGRESADA" && reingresoBloqueado;
                  const seleccionada = disposicion === opcion.valor;
                  const Icono = opcion.icono;

                  return (
                    <Button
                      key={opcion.valor}
                      type="button"
                      variant={seleccionada ? "solid" : "outline"}
                      colorPalette={
                        opcion.valor === "DESECHADA" ? "red" : "green"
                      }
                      onClick={() => setDisposicion(opcion.valor)}
                      disabled={bloqueada || enviando}
                      h="auto"
                      py="3"
                      px="4"
                      justifyContent="flex-start"
                      textAlign="left"
                      whiteSpace="normal"
                      aria-pressed={seleccionada}
                    >
                      <HStack align="flex-start" gap="3">
                        <Icono size={18} aria-hidden />
                        <Box>
                          <Text fontSize="sm" fontWeight="bold">
                            {opcion.titulo}
                          </Text>
                          <Text fontSize="xs" opacity={0.85}>
                            {bloqueada
                              ? loteRetirado
                                ? "No disponible: el lote está retirado."
                                : "No disponible: el lote está vencido."
                              : opcion.detalle}
                          </Text>
                        </Box>
                      </HStack>
                    </Button>
                  );
                })}
              </VStack>
            </FormField>

            <FormField
              label="Justificación"
              required
              mb="0"
              invalid={intentado && faltan.tiene("justificacion")}
              helper="Explicá por qué se reingresa o se desecha. Máximo 500 caracteres."
            >
              <Textarea
                rows={3}
                maxLength={500}
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Ej: se verificó la cadena de frío y el producto está apto para volver al lote."
              />
            </FormField>

            <Box my="4" borderBottomWidth="1px" borderColor="border.subtle" />

            <Box p="3" rounded="md" bg="bg.muted" borderWidth="1px" borderColor="border.subtle">
              <Checkbox.Root
                checked={generarReposicion}
                onCheckedChange={(e) => setGenerarReposicion(e.checked === true)}
                colorPalette="brand"
              >
                <Checkbox.HiddenInput />
                <HStack gap="2" align="center">
                  <Checkbox.Control />
                  <Checkbox.Label fontSize="sm" color="fg">
                    Generar deuda comercial (Reposición de stock) para compensar este rechazo
                  </Checkbox.Label>
                </HStack>
              </Checkbox.Root>
              {generarReposicion && (
                <Box mt="3">
                  <FormField
                    label={`Cantidad a reponer (${unidadMedida || "u"})`}
                    mb="0"
                  >
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      max={Number(cantidad)}
                      value={cantidadAReponer}
                      onChange={(e) => setCantidadAReponer(e.target.value)}
                      placeholder={`Ej: ${Number(cantidad).toString()}`}
                    />
                  </FormField>
                </Box>
              )}
            </Box>

            <Box p="3" rounded="md" bg="orange.subtle" color="orange.fg">
              <Text fontSize="xs" fontWeight="medium">
                Esta decisión es definitiva
              </Text>
              <Text fontSize="xs">
                Al resolver el rechazo se cierra el incidente asociado y no se
                puede cambiar el destino elegido.
              </Text>
            </Box>

            <AccionesFormulario>
              <BotonGuardar
                loading={enviando}
                disabled={enviando}
                colorPalette="brand"
              >
                Confirmar decisión
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
