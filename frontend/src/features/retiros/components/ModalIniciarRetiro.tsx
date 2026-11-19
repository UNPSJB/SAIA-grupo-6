import { useState, useEffect } from "react";
import { useAuth } from "@/common/context/useAuth";
import { Box, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { LuInfo, LuUser, LuTriangleAlert } from "react-icons/lu";
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
import { formatoFecha, hoyISO } from "../../../common/utils/fechas";
import * as retiroService from "../services/retiroService";
import type { RetiroCreateValues } from "../types/retiro";
import { MOTIVOS_RETIRO } from "../types/retiro";

interface ModalIniciarRetiroProps {
  isOpen: boolean;
  loteIdInicial?: number | null;
  reclamoIdInicial?: number | null;
  onClose: () => void;
  onRetiroIniciado: () => void;
}

const VALORES_INICIALES: RetiroCreateValues = {
  lote_id: 0,
  motivo: "",
  detalle: "",
  fecha_retiro: hoyISO(),
};

export function ModalIniciarRetiro({
  isOpen,
  loteIdInicial,
  reclamoIdInicial,
  onClose,
  onRetiroIniciado,
}: ModalIniciarRetiroProps) {
  const { user } = useAuth();
  const [values, setValues] = useState<RetiroCreateValues>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lotesDisponibles, setLotesDisponibles] = useState<{
    id: number;
    codigo: string;
    producto_nombre: string;
    unidad_medida: string;
    saldo: string | number;
    fecha_inicio: string | null;
    fecha_vencimiento: string | null;
  }[]>([]);
  const [impactoCargado, setImpacto] = useState<{
    lote_id: number;
    reservas_a_cancelar: number;
    total_afectadas: number;
    saldo_en_planta: string;
    en_revision: string;
  } | null>(null);
  const [loteSeleccionado, setLoteSeleccionado] = useState<{
    id: number;
    codigo: string;
    producto_nombre: string;
    fecha_inicio: string | null;
  } | null>(null);
  // El impacto solo vale para el lote con el que se pidió: al cambiar o quitar
  // el lote deja de mostrarse sin tener que limpiarlo desde un efecto.
  const impacto =
    loteSeleccionado && impactoCargado?.lote_id === loteSeleccionado.id
      ? impactoCargado
      : null;
  const [codigoConfirmar, setCodigoConfirmar] = useState("");
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setValues({
        ...VALORES_INICIALES,
        fecha_retiro: hoyISO(),
        reclamo_id: reclamoIdInicial ?? undefined,
      });
      setError(null);
      setImpacto(null);
      setLoteSeleccionado(null);
      if (loteIdInicial) {
        const lote = lotesDisponibles.find((l) => l.id === loteIdInicial);
        if (lote) {
          setLoteSeleccionado({
            id: lote.id,
            codigo: lote.codigo,
            producto_nombre: lote.producto_nombre,
            fecha_inicio: lote.fecha_inicio,
          });
          setValues({ ...values, lote_id: loteIdInicial });
        }
      } else if (reclamoIdInicial) {
        setValues({ ...values, motivo: "Reclamos de clientes" });
      }
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    let vigente = true;
    void retiroService.listarLotesDisponibles()
      .then((lotes) => {
        if (!vigente) return;
        const disponibles = lotes.filter((l) => !l.retirado && !l.retiro_id);
        setLotesDisponibles(disponibles);
        if (loteIdInicial) {
          const lote = disponibles.find((l: { id: number }) => l.id === loteIdInicial);
          if (lote) {
            setLoteSeleccionado({
              id: lote.id,
              codigo: lote.codigo,
              producto_nombre: lote.producto_nombre,
              fecha_inicio: lote.fecha_inicio,
            });
            setValues((prev) => ({ ...prev, lote_id: loteIdInicial }));
          }
        }
      })
      .catch(() => {
        if (vigente) {
          setError("No se pudieron cargar los lotes disponibles.");
        }
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, loteIdInicial]);

  useEffect(() => {
    if (!loteSeleccionado) return;
    const loteId = loteSeleccionado.id;
    let vigente = true;
    void retiroService.obtenerImpactoRetiro(loteId)
      .then((data) => {
        if (!vigente) return;
        setImpacto({
          lote_id: loteId,
          reservas_a_cancelar: data.reservas_a_cancelar,
          total_afectadas: data.total_afectadas,
          saldo_en_planta: data.saldo_en_planta,
          en_revision: data.en_revision,
        });
      })
      .catch(() => {
        if (vigente) setImpacto(null);
      });

    return () => {
      vigente = false;
    };
  }, [loteSeleccionado]);

  const motivoOtro = values.motivo === "Otro";
  const detalleObligatorio = motivoOtro && !(values.detalle ?? "").trim();

  const faltan = faltantes({
    lote_id: [!values.lote_id || values.lote_id === 0, "el lote"],
    motivo: [!values.motivo, "el motivo"],
    detalle: [detalleObligatorio, "el detalle (obligatorio si el motivo es 'Otro')"],
    fecha_retiro: [!values.fecha_retiro, "la fecha del retiro"],
  });

  const fechaInvalida =
    values.fecha_retiro.trim() !== "" &&
    (values.fecha_retiro > hoyISO() ||
      (loteSeleccionado?.fecha_inicio &&
        values.fecha_retiro < loteSeleccionado.fecha_inicio));

  const guardando = async () => {
    setEnviando(true);
    setError(null);
    try {
      await retiroService.crearRetiro({
        lote_id: values.lote_id,
        motivo: values.motivo,
        detalle: (values.detalle ?? "").trim() || null,
        fecha_retiro: values.fecha_retiro,
        reclamo_id: values.reclamo_id,
      });
      onRetiroIniciado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el retiro.");
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
        width="560px"
        maxWidth="90vw"
        maxHeight="85vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Nuevo retiro de lote
        </DialogTitle>

        <form onSubmit={handleSubmit} noValidate>

          <Box p="3" bg="bg.muted" rounded="md" mb="5">
            <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
              Responsable
            </Text>
            <HStack gap="3" align="center">
              <Box as="span" display="inline-flex" aria-hidden>
                <LuUser size={18} color="brand.500" />
              </Box>
              <Text fontSize="sm" color="fg">
                {user?.nombre ? `${user.nombre} ${user.apellido}` : "Usuario logueado"}
              </Text>
            </HStack>
          </Box>

          {error ? <MensajeError>{error}</MensajeError> : null}
          <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

          <FormField
            label="Lote"
            required
            mb="0"
            invalid={intentado && faltan.tiene("lote_id")}
          >
            <FormNativeSelect
              value={values.lote_id === 0 ? "" : String(values.lote_id)}
              onChange={(e) => {
                const id = Number(e.target.value);
                setValues({ ...values, lote_id: id });
                const lote = lotesDisponibles.find((l) => l.id === id);
                if (lote) {
                  setLoteSeleccionado({
                    id: lote.id,
                    codigo: lote.codigo,
                    producto_nombre: lote.producto_nombre,
                    fecha_inicio: lote.fecha_inicio,
                  });
                } else {
                  setLoteSeleccionado(null);
                }
              }}
            >
              <option value="">-- Lote --</option>
              {lotesDisponibles.map((lote) => (
                <option key={lote.id} value={String(lote.id)}>
                  {lote.producto_nombre} · {lote.codigo}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField
            label="Motivo"
            required
            mb="0"
            invalid={intentado && faltan.tiene("motivo")}
          >
            <FormNativeSelect
              value={values.motivo}
              onChange={(e) =>
                setValues({ ...values, motivo: e.target.value })
              }
            >
              <option value="">-- Motivo --</option>
              {MOTIVOS_RETIRO.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField
            label={motivoOtro ? "Detalle *" : "Detalle (opcional)"}
            required={motivoOtro}
            mb="0"
            invalid={intentado && faltan.tiene("detalle")}
            helper={
              motivoOtro
                ? "Obligatorio cuando el motivo es 'Otro': describí qué sucedió."
                : "Texto libre para ampliar el motivo del retiro."
            }
          >
            <FormInput
              type="text"
              value={values.detalle ?? ""}
              onChange={(e) => setValues({ ...values, detalle: e.target.value })}
              placeholder={motivoOtro ? "Ej: lote contaminado con cuerpo extraño" : undefined}
              maxLength={500}
            />
          </FormField>

          <FormField
            label="Fecha del retiro"
            required
            mb="0"
            invalid={
              Boolean(
                (intentado && faltan.tiene("fecha_retiro")) || fechaInvalida
              )
            }
            helper={
              loteSeleccionado?.fecha_inicio
                ? `Entre ${formatoFecha(loteSeleccionado.fecha_inicio)} y hoy (${formatoFecha(hoyISO())})`
                : `Hasta hoy (${formatoFecha(hoyISO())})`
            }
          >
            <FormInput
              type="date"
              disabled={!loteSeleccionado}
              min={loteSeleccionado?.fecha_inicio ?? undefined}
              max={hoyISO()}
              value={values.fecha_retiro}
              onChange={(e) => setValues({ ...values, fecha_retiro: e.target.value })}
            />
          </FormField>

          {impacto && (
            <Box p="3" bg="bg.subtle" rounded="md" mb="5">
              <HStack gap="2" align="center" mb="3">
                <Box as="span" display="inline-flex" aria-hidden>
                  <LuInfo size={16} color="brand.500" />
                </Box>
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  Vista previa del impacto al retirar este lote
                </Text>
              </HStack>
              <SimpleGrid columns={2} gap="3">
                <Box p="2" bg="orange.subtle" borderWidth="1px" borderColor="orange.border" rounded="md">
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Reservas a cancelar
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color="orange.fg">
                    {impacto.reservas_a_cancelar}
                  </Text>
                </Box>
                <Box p="2" bg="blue.subtle" borderWidth="1px" borderColor="blue.border" rounded="md">
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Clientes a notificar
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color="blue.fg">
                    {impacto.total_afectadas}
                  </Text>
                </Box>
                <Box p="2" bg="teal.subtle" borderWidth="1px" borderColor="teal.border" rounded="md">
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Saldo en planta
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" color="teal.fg">
                    {impacto.saldo_en_planta}
                  </Text>
                </Box>
                <Box p="2" bg="yellow.subtle" borderWidth="1px" borderColor="yellow.border" rounded="md">
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    En revisión
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" color="yellow.fg">
                    {impacto.en_revision}
                  </Text>
                </Box>
              </SimpleGrid>
            </Box>
          )}

          <Box p="3" bg="red.subtle" borderWidth="1px" borderColor="red.border" rounded="md" mb="5">
            <HStack gap="3" align="flex-start" mb="2">
              <Box as="span" mt="0.5" flexShrink={0} aria-hidden>
                <LuTriangleAlert size={16} color="red.fg" />
              </Box>
              <Text fontSize="sm" color="red.fg" fontWeight="medium">
                Esta acción es irreversible y retirará el lote del mercado.
              </Text>
            </HStack>
            <Text fontSize="xs" color="red.fg" mt="1">
              Al confirmar, el lote quedará retirado y no se podrán hacer nuevas
              reservas ni despachos sobre él. Las reservas pendientes se cancelan
              automáticamente y las entregas/despachos quedan pendientes de
              notificación a los clientes.
            </Text>
            <FormField
              label="Confirmar código del lote"
              required
              mb="0"
              invalid={
                intentado && codigoConfirmar !== loteSeleccionado?.codigo
              }
              helper={loteSeleccionado
  ? `Escribí "${loteSeleccionado.codigo}" para confirmar que sabés qué lote retirás.`
  : "Escribí el código exacto del lote (ej. LP-20261114-001) para confirmar que sabés qué lote retirás."}
            >
              <FormInput
                type="text"
                value={codigoConfirmar}
                onChange={(e) => setCodigoConfirmar(e.target.value)}
                placeholder="LP-...."
              />
            </FormField>
          </Box>

          <AccionesFormulario>
            <BotonGuardar
              loading={enviando}
              disabled={
                enviando ||
                Boolean(!loteSeleccionado || codigoConfirmar !== loteSeleccionado.codigo)
              }
            >
              Confirmar retiro del mercado
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
