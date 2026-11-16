import { useRef, useState } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Image,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { LuPaperclip, LuX } from "react-icons/lu";
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
  FormInput,
  FormNativeSelect,
  MensajeError,
  faltantes,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import {
  formatoFecha,
  formatoFechaHora,
  hoyISO,
} from "../../../common/utils/fechas";
import { rechazarSalida } from "../services/salidaService";
import {
  MOTIVOS_RECHAZO,
  type MotivoRechazo,
} from "../types/salida";

interface ModalRechazarSalidaProps {
  isOpen: boolean;
  salidaId: number;
  loteNumero: string;
  productoNombre: string;
  clienteNombre: string;
  cantidad: string;
  unidadMedida: string;
  fechaDespacho: string;
  despachadoEn?: string | null;
  onClose: () => void;
  onRechazoRegistrado: () => void;
}

const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];
// Mismo límite que el backend (y que el alta de incidentes).
const TAMANO_MAX_FOTO = 5 * 1024 * 1024;

/**
 * Modal para registrar que el cliente rechazó una entrega (Historia A).
 *
 * Pide motivo de la lista, detalle libre (obligatorio para "Otro") y fecha
 * (entre el despacho y hoy). La foto es opcional y se valida con el mismo
 * criterio que la del incidente. Avisa que la cantidad queda en revisión
 * hasta que un administrador decida su destino.
 */
export function ModalRechazarSalida({
  isOpen,
  salidaId,
  loteNumero,
  productoNombre,
  clienteNombre,
  cantidad,
  unidadMedida,
  fechaDespacho,
  despachadoEn,
  onClose,
  onRechazoRegistrado,
}: ModalRechazarSalidaProps) {
  const [motivo, setMotivo] = useState<MotivoRechazo | "">("");
  const [detalle, setDetalle] = useState("");
  const [fechaRechazo, setFechaRechazo] = useState(hoyISO());
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();
  const inputFoto = useRef<HTMLInputElement>(null);

  // Cada apertura arranca limpia.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setMotivo("");
      setDetalle("");
      setFechaRechazo(hoyISO());
      setFoto(null);
      setFotoPreview(null);
      setErrorFoto(null);
      setError(null);
    }
  }

  const detalleObligatorio = motivo.toLowerCase() === "otro";
  const fechaInvalida =
    fechaRechazo.trim() !== "" &&
    ((fechaDespacho !== "" && fechaRechazo < fechaDespacho) ||
      fechaRechazo > hoyISO());

  const faltan = faltantes({
    motivo: [!motivo, "el motivo del rechazo"],
    detalle: [detalleObligatorio && !detalle.trim(), "el detalle del rechazo"],
    fecha: [!fechaRechazo.trim(), "la fecha del rechazo"],
  });

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setErrorFoto(null);

    if (file) {
      if (!FORMATOS_PERMITIDOS.includes(file.type)) {
        setErrorFoto(
          "Formato no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WebP)."
        );
        setFoto(null);
        setFotoPreview(null);
        return;
      }
      if (file.size > TAMANO_MAX_FOTO) {
        setErrorFoto("La foto supera el máximo de 5 MB.");
        setFoto(null);
        setFotoPreview(null);
        return;
      }
      setFoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFoto(null);
      setFotoPreview(null);
    }
  };

  const quitarFoto = () => {
    setFoto(null);
    setFotoPreview(null);
    setErrorFoto(null);
    if (inputFoto.current) inputFoto.current.value = "";
  };

  const guardando = async () => {
    if (!motivo) return;
    if (detalleObligatorio && !detalle.trim()) return;
    setEnviando(true);
    setError(null);

    try {
      await rechazarSalida(
        salidaId,
        {
          motivo,
          detalle: detalle.trim(),
          fecha_rechazo: fechaRechazo,
        },
        foto ?? undefined
      );
      onRechazoRegistrado();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el rechazo."
      );
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
        maxHeight="85vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Rechazar entrega
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error ? <MensajeError>{error}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            {/* Resumen de la salida */}
            <Box p="3" bg="bg.muted" rounded="md" mb="2">
              <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                Entrega rechazada por el cliente
              </Text>
              <Text fontSize="sm" color="fg">
                {productoNombre} ({loteNumero})
              </Text>
              <Text fontSize="sm" color="fg">
                {cantidadConUnidad(cantidad, unidadMedida)} para {clienteNombre}
              </Text>
              {fechaDespacho && (
                <Text fontSize="xs" color="fg.muted" mt="1">
                  Fecha de despacho:{" "}
                  {despachadoEn
                    ? formatoFechaHora(despachadoEn)
                    : formatoFecha(fechaDespacho)}
                </Text>
              )}
            </Box>

            <FormField
              label="Motivo del rechazo"
              required
              mb="0"
              invalid={intentado && faltan.tiene("motivo")}
            >
              <FormNativeSelect
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoRechazo)}
              >
                <option value="">Seleccionar motivo</option>
                {MOTIVOS_RECHAZO.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField
              label={detalleObligatorio ? "Detalle" : "Detalle (opcional)"}
              required={detalleObligatorio}
              mb="0"
              invalid={intentado && faltan.tiene("detalle")}
              helper={
                detalleObligatorio
                  ? "Obligatorio para el motivo “Otro”: contá qué pasó. Máximo 500 caracteres."
                  : "Texto libre para ampliar el motivo. Máximo 500 caracteres."
              }
            >
              <Textarea
                rows={3}
                maxLength={500}
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Ej: la caja llegó golpeada y con humedad."
              />
            </FormField>

            <FormField
              label="Fecha del rechazo"
              required
              mb="0"
              invalid={fechaInvalida || (intentado && faltan.tiene("fecha"))}
              helper={
                fechaInvalida
                  ? "La fecha no puede ser anterior al despacho ni posterior a hoy."
                  : undefined
              }
            >
              <FormInput
                type="date"
                min={fechaDespacho || undefined}
                max={hoyISO()}
                value={fechaRechazo}
                onChange={(e) => setFechaRechazo(e.target.value)}
              />
            </FormField>

            <FormField label="Foto (opcional)" invalid={Boolean(errorFoto)} mb="0">
              <Input
                ref={inputFoto}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                display="none"
                onChange={handleFotoChange}
              />
              <HStack gap="3">
                <Button
                  type="button"
                  onClick={() => inputFoto.current?.click()}
                  variant="outline"
                  colorPalette="neutral"
                  size="sm"
                >
                  <LuPaperclip aria-hidden />
                  Adjuntar foto
                </Button>
                {foto && (
                  <Text fontSize="sm" color="brand.fg" fontWeight="medium">
                    {foto.name}
                  </Text>
                )}
              </HStack>

              {errorFoto && <MensajeError>{errorFoto}</MensajeError>}

              {fotoPreview && (
                <Box mt="4" position="relative" display="inline-block">
                  <Image
                    src={fotoPreview}
                    alt="Vista previa de la foto del rechazo"
                    maxW="200px"
                    maxH="200px"
                    rounded="lg"
                    borderWidth="2px"
                    borderColor="brand.300"
                    display="block"
                  />
                  <IconButton
                    type="button"
                    onClick={quitarFoto}
                    aria-label="Quitar foto adjunta"
                    position="absolute"
                    top="-2"
                    right="-2"
                    size="xs"
                    rounded="full"
                    colorPalette="red"
                  >
                    <LuX />
                  </IconButton>
                </Box>
              )}
            </FormField>

            <Text fontSize="xs" color="orange.fg">
              La cantidad quedará en revisión hasta que un administrador decida
              su destino.
            </Text>

            <AccionesFormulario>
              <BotonGuardar
                loading={enviando}
                disabled={enviando}
                colorPalette="red"
              >
                Registrar rechazo
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
