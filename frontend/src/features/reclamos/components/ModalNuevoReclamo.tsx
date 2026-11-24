import { useCallback, useEffect, useRef, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
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
import { formatoFecha, hoyISO } from "../../../common/utils/fechas";
import { listarSalidas } from "../../salidas/services/salidaService";
import { obtenerClientesReclamo } from "../services/reclamoService";
import type { Salida } from "../../salidas/types/salida";
import { obtenerPlazoReclamo } from "../../configuracion/services/configuracionService";
import { crearReclamo } from "../services/reclamoService";
import {
  MOTIVOS_RECLAMO,
  MOTIVO_RECLAMO_OTRO,
  type MotivoReclamo,
  type ReclamoDetalle,
} from "../types/reclamo";

interface ModalNuevoReclamoProps {
  isOpen: boolean;
  /**
   * Entrega desde la que se abre el reclamo (ficha o fila de Salidas). Si
   * viene, el cliente y la entrega quedan fijos.
   */
  salidaInicial?: Salida | null;
  onClose: () => void;
  onReclamoRegistrado: (reclamo: ReclamoDetalle) => void;
}

const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];
// Mismo límite que el backend (y que el alta de incidentes).
const TAMANO_MAX_FOTO = 5 * 1024 * 1024;

/** Días de calendario entre dos fechas puras `YYYY-MM-DD`. */
function diasEntre(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  return Math.max(
    0,
    Math.round((fin.getTime() - inicio.getTime()) / 86_400_000)
  );
}

/**
 * Alta de un reclamo de cliente (Historia 20).
 *
 * Se registra sobre una entrega: desde la ficha de la salida cliente y
 * entrega vienen fijos; desde el listado se eligen a mano (el cliente puede
 * estar dado de baja y aun así reclamar). El plazo es solo una referencia:
 * fuera de plazo se registra igual y queda marcado.
 */
interface EntregasDelCliente {
  clienteId: number;
  salidas: Salida[];
}

export function ModalNuevoReclamo({
  isOpen,
  salidaInicial,
  onClose,
  onReclamoRegistrado,
}: ModalNuevoReclamoProps) {
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [clienteId, setClienteId] = useState(0);
  // La entrega elegida; `salidaId` (más abajo) la descarta si ya no está en la lista.
  const [salidaElegida, setSalidaId] = useState(0);
  const [plazoReferencia, setPlazoReferencia] = useState<number | null>(null);
  const [motivo, setMotivo] = useState<MotivoReclamo | "">("");
  const [detalle, setDetalle] = useState("");
  const [fechaReclamo, setFechaReclamo] = useState(hoyISO());
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();
  const inputFoto = useRef<HTMLInputElement>(null);

  // Cada apertura arranca limpia y con la entrega fija, si vino.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setClienteId(salidaInicial?.cliente_id ?? 0);
      setSalidaId(salidaInicial?.id ?? 0);
      setMotivo("");
      setDetalle("");
      setFechaReclamo(hoyISO());
      setFoto(null);
      setFotoPreview(null);
      setErrorFoto(null);
      setError(null);
    }
  }

  // Clientes (incluye inactivos: pueden reclamar igual) y plazo configurado.
  useEffect(() => {
    if (!isOpen) return;
    let vigente = true;

    void obtenerClientesReclamo()
      .then((lista) => {
        if (!vigente) return;
        setClientes(
          lista
            .map((c) => ({ id: c.id, nombre: c.nombre }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
      })
      .catch(() => {
        if (vigente) setError("No se pudieron cargar los clientes.");
      });

    void obtenerPlazoReclamo()
      .then((config) => {
        if (vigente) setPlazoReferencia(config.plazo_reclamo_dias);
      })
      .catch(() => {
        // Sin configuración el formulario sigue funcionando: el backend usa
        // el plazo vigente igual.
        if (vigente) setPlazoReferencia(null);
      });

    return () => {
      vigente = false;
    };
  }, [isOpen]);

  // Entregas del cliente elegido (solo cuando no vino una entrega fija). Se
  // guarda de qué cliente son: al cambiar de cliente no se muestran las del
  // anterior mientras cargan las nuevas.
  const clienteABuscar = isOpen && !salidaInicial && clienteId ? clienteId : 0;
  const cargarEntregas = useCallback(async (): Promise<EntregasDelCliente> => {
    if (!clienteABuscar) return { clienteId: 0, salidas: [] };
    const salidas = await listarSalidas({ cliente_id: clienteABuscar, estado: "ENTREGADO" });
    return { clienteId: clienteABuscar, salidas };
  }, [clienteABuscar]);
  const {
    items: entregasCargadas,
    loading: cargandoLista,
    error: errorEntregas,
  } = useLista<EntregasDelCliente>({
    cargar: cargarEntregas,
    dependencias: [clienteABuscar],
    valorInicial: { clienteId: 0, salidas: [] },
    mensajeError: "No se pudieron cargar las entregas del cliente.",
  });
  const entregas: Salida[] = salidaInicial
    ? [salidaInicial]
    : entregasCargadas.clienteId === clienteABuscar
      ? entregasCargadas.salidas
      : [];
  const cargandoEntregas = clienteABuscar !== 0 && cargandoLista;
  const salidaId = entregas.some((s) => s.id === salidaElegida) ? salidaElegida : 0;

  const salidaSeleccionada =
    salidaInicial ??
    entregas.find((s) => s.id === salidaId) ??
    null;

  const detalleObligatorio = motivo === MOTIVO_RECLAMO_OTRO;

  const fechaInvalida =
    fechaReclamo.trim() !== "" &&
    salidaSeleccionada?.fecha_entrega != null &&
    (fechaReclamo < salidaSeleccionada.fecha_entrega ||
      fechaReclamo > hoyISO());

  const diasDesdeEntrega =
    salidaSeleccionada?.fecha_entrega && fechaReclamo.trim() !== ""
      ? diasEntre(salidaSeleccionada.fecha_entrega, fechaReclamo)
      : null;
  const fueraDePlazo =
    diasDesdeEntrega !== null &&
    plazoReferencia !== null &&
    diasDesdeEntrega > plazoReferencia;

  const faltan = faltantes({
    cliente: [!salidaInicial && !clienteId, "el cliente"],
    entrega: [!salidaInicial && !salidaId, "la entrega"],
    motivo: [!motivo, "el motivo"],
    detalle: [detalleObligatorio && !detalle.trim(), "el detalle"],
    fecha: [!fechaReclamo.trim(), "la fecha del reclamo"],
  });

  const handleClienteChange = (valor: string) => {
    setClienteId(Number(valor));
    setSalidaId(0);
  };

  const handleSalidaChange = (valor: string) => {
    setSalidaId(Number(valor));
    // La fecha de hoy siempre es válida para una entrega ya registrada.
    setFechaReclamo(hoyISO());
  };

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
    if (!motivo || !salidaSeleccionada) return;
    setEnviando(true);
    setError(null);

    try {
      const reclamo = await crearReclamo(
        {
          salida_id: salidaSeleccionada.id,
          motivo,
          detalle: detalle.trim(),
          fecha_reclamo: fechaReclamo,
        },
        foto ?? undefined
      );
      onReclamoRegistrado(reclamo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el reclamo."
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
        width="520px"
        maxWidth="90vw"
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
          Nuevo reclamo de cliente
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>
          <VStack align="stretch" gap="4">
            {error || errorEntregas ? <MensajeError>{error ?? errorEntregas}</MensajeError> : null}
            <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

            {salidaInicial ? (
              <Box p="3" bg="bg.muted" rounded="md">
                <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                  Entrega reclamada
                </Text>
                <Text fontSize="sm" color="fg">
                  {salidaInicial.producto_nombre} ({salidaInicial.lote_numero})
                </Text>
                <Text fontSize="sm" color="fg">
                  {cantidadConUnidad(
                    salidaInicial.cantidad,
                    salidaInicial.unidad_medida
                  )}{" "}
                  para {salidaInicial.cliente_nombre}
                </Text>
                <Text fontSize="xs" color="fg.muted" mt="1">
                  Entregada el {formatoFecha(salidaInicial.fecha_entrega)}
                </Text>
              </Box>
            ) : (
              <>
                <FormField
                  label="Cliente"
                  required
                  mb="0"
                  invalid={intentado && faltan.tiene("cliente")}
                >
                  <FormNativeSelect
                    value={clienteId ? String(clienteId) : ""}
                    onChange={(e) => handleClienteChange(e.target.value)}
                  >
                    <option value="">-- Cliente --</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={String(cliente.id)}>
                        {cliente.nombre}
                      </option>
                    ))}
                  </FormNativeSelect>
                </FormField>

                <FormField
                  label="Entrega"
                  required
                  mb="0"
                  invalid={intentado && faltan.tiene("entrega")}
                  helper={
                    !clienteId
                      ? "Elegí primero el cliente."
                      : cargandoEntregas
                      ? "Cargando entregas..."
                      : entregas.length === 0
                      ? "Este cliente no tiene entregas registradas."
                      : "Solo se puede reclamar sobre entregas ya realizadas."
                  }
                >
                  <FormNativeSelect
                    value={salidaId ? String(salidaId) : ""}
                    disabled={!clienteId || cargandoEntregas}
                    onChange={(e) => handleSalidaChange(e.target.value)}
                  >
                    <option value="">-- Entrega --</option>
                    {entregas.map((salida) => (
                      <option key={salida.id} value={String(salida.id)}>
                        {salida.producto_nombre} · {salida.lote_numero} ·{" "}
                        {cantidadConUnidad(
                          salida.cantidad,
                          salida.unidad_medida
                        )} · entregada el {formatoFecha(salida.fecha_entrega)}
                      </option>
                    ))}
                  </FormNativeSelect>
                </FormField>
              </>
            )}

            <FormField
              label="Motivo del reclamo"
              required
              mb="0"
              invalid={intentado && faltan.tiene("motivo")}
            >
              <FormNativeSelect
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoReclamo)}
              >
                <option value="">Seleccionar motivo</option>
                {MOTIVOS_RECLAMO.map((m) => (
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
                placeholder="Ej: el cliente notó un sabor extraño en la última partida."
              />
            </FormField>

            <FormField
              label="Fecha del reclamo"
              required
              mb="0"
              invalid={fechaInvalida || (intentado && faltan.tiene("fecha"))}
              helper={
                fechaInvalida
                  ? "La fecha no puede ser anterior a la entrega ni posterior a hoy."
                  : undefined
              }
            >
              <FormInput
                type="date"
                disabled={!salidaSeleccionada}
                min={salidaSeleccionada?.fecha_entrega ?? undefined}
                max={hoyISO()}
                value={fechaReclamo}
                onChange={(e) => setFechaReclamo(e.target.value)}
              />
            </FormField>

            {plazoReferencia !== null &&
              salidaSeleccionada &&
              diasDesdeEntrega !== null &&
              !fechaInvalida && (
                <Text
                  fontSize="xs"
                  color={fueraDePlazo ? "orange.fg" : "fg.muted"}
                >
                  Plazo de referencia: {plazoReferencia} días. Esta entrega fue
                  hace {diasDesdeEntrega}{" "}
                  {diasDesdeEntrega === 1 ? "día" : "días"} (
                  {fueraDePlazo
                    ? "fuera de plazo: se registrará igual con la etiqueta"
                    : "en plazo"}
                  ).
                </Text>
              )}

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
                    alt="Vista previa de la foto del reclamo"
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

            <AccionesFormulario>
              <BotonGuardar loading={enviando} disabled={enviando}>
                Registrar reclamo
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
