import { useState, useEffect, useTransition } from "react";
import { useAuth } from "@/common/context/useAuth";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  SimpleGrid,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { LuInfo, LuUser, LuTriangleAlert, LuBoxes, LuPackage } from "react-icons/lu";
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
import { toaster } from "../../../components/ui/toaster";
import * as retiroService from "../services/retiroService";
import type { RetiroCreateValues, ImpactoRetiro } from "../types/retiro";
import { MOTIVOS_RETIRO } from "../types/retiro";
import { listarStockLotes } from "../../lotesInsumo/services/loteInsumoService";
import type { StockLoteInsumo } from "../../lotesInsumo/types/loteInsumo";
import { trazarLoteInsumo } from "../../trazabilidad/services/trazabilidadService";
import type { LoteProductoUsoInsumo } from "../../trazabilidad/types/trazabilidad";

export const MOTIVOS_PRODUCTO = [
  "Contaminación o cuerpo extraño",
  "Falla en el proceso de elaboración",
  "Reclamos de clientes",
  "Error de rotulado o alérgenos",
  "Otro",
];

export const MOTIVOS_INSUMO = [
  "Aviso o recall del proveedor",
  "Resultado de análisis no conforme",
  "Contaminación cruzada en origen",
  "Insumo fuera de especificación o vencido",
  "Otro",
];

export interface ModalIniciarRetiroProps {
  isOpen: boolean;
  onClose: () => void;
  onRetiroIniciado: () => void;
  loteProductoInicialId?: number | null;
  loteIdInicial?: number | null; // Retrocompatibilidad
  reclamoIdInicial?: number | null;
  loteInsumoInicialId?: number | null;
}

const VALORES_INICIALES: RetiroCreateValues = {
  lote_id: 0,
  motivo: "",
  detalle: "",
  fecha_retiro: hoyISO(),
};

type ModoRetiro = "producto" | "insumo";

export function ModalIniciarRetiro({
  isOpen,
  onClose,
  onRetiroIniciado,
  loteProductoInicialId,
  loteIdInicial,
  reclamoIdInicial,
  loteInsumoInicialId,
}: ModalIniciarRetiroProps) {
  const { user } = useAuth();
  const idProdInicial = loteProductoInicialId ?? loteIdInicial ?? null;

  // Modo activo (producto vs insumo)
  const [modo, setModo] = useState<ModoRetiro>(
    loteInsumoInicialId ? "insumo" : "producto"
  );

  // ---------------------------------------------------------
  // MODO 1: PRODUCTO
  // ---------------------------------------------------------
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
  const impacto =
    loteSeleccionado && impactoCargado?.lote_id === loteSeleccionado.id
      ? impactoCargado
      : null;
  const [codigoConfirmar, setCodigoConfirmar] = useState("");
  const { intentado, puedeEnviar } = useIntentoEnvio();

  // ---------------------------------------------------------
  // MODO 2: INSUMO MASIVO
  // ---------------------------------------------------------
  const [lotesInsumo, setLotesInsumo] = useState<StockLoteInsumo[]>([]);
  const [cargandoInsumos, setCargandoInsumos] = useState(false);
  const [loteInsumoId, setLoteInsumoId] = useState<number>(0);
  const [lotesAfectados, setLotesAfectados] = useState<LoteProductoUsoInsumo[]>([]);
  const [cargandoAfectados, setCargandoAfectados] = useState(false);
  const [seleccionadosIds, setSeleccionadosIds] = useState<number[]>([]);
  const [mapaImpactos, setMapaImpactos] = useState<Record<number, ImpactoRetiro>>({});
  const [cargandoImpactosMasivos, setCargandoImpactosMasivos] = useState(false);
  const [codigoConfirmarMasivo, setCodigoConfirmarMasivo] = useState<string>("");
  const [motivoInsumo, setMotivoInsumo] = useState<string>(MOTIVOS_INSUMO[0]);
  const [detalleInsumo, setDetalleInsumo] = useState<string>("");
  const [enviandoMasivo, setEnviandoMasivo] = useState(false);
  const [errorMasivo, setErrorMasivo] = useState<string | null>(null);

  // Reset al abrir
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setModo(loteInsumoInicialId ? "insumo" : "producto");
      setValues({
        ...VALORES_INICIALES,
        fecha_retiro: hoyISO(),
        reclamo_id: reclamoIdInicial ?? undefined,
      });
      setError(null);
      setErrorMasivo(null);
      setImpacto(null);
      setLoteSeleccionado(null);
      setCodigoConfirmar("");
      setLoteInsumoId(loteInsumoInicialId ?? 0);
      setLotesAfectados([]);
      setSeleccionadosIds([]);
      setMapaImpactos({});
      setCodigoConfirmarMasivo("");
      setMotivoInsumo(MOTIVOS_INSUMO[0]);
      setDetalleInsumo("");
      if (idProdInicial) {
        const lote = lotesDisponibles.find((l) => l.id === idProdInicial);
        if (lote) {
          setLoteSeleccionado({
            id: lote.id,
            codigo: lote.codigo,
            producto_nombre: lote.producto_nombre,
            fecha_inicio: lote.fecha_inicio,
          });
          setValues((prev) => ({ ...prev, lote_id: idProdInicial }));
        }
      } else if (reclamoIdInicial) {
        setValues((prev) => ({ ...prev, motivo: "Reclamos de clientes" }));
      }
    }
  }

  // Cargar lotes de producto disponibles
  useEffect(() => {
    if (!isOpen) return;
    let vigente = true;
    void retiroService.listarLotesDisponibles()
      .then((lotes) => {
        if (!vigente) return;
        const disponibles = lotes.filter((l) => !l.retirado && !l.retiro_id);
        setLotesDisponibles(disponibles);
        if (idProdInicial) {
          const lote = disponibles.find((l) => l.id === idProdInicial);
          if (lote) {
            setLoteSeleccionado({
              id: lote.id,
              codigo: lote.codigo,
              producto_nombre: lote.producto_nombre,
              fecha_inicio: lote.fecha_inicio,
            });
            setValues((prev) => ({ ...prev, lote_id: idProdInicial }));
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
  }, [isOpen, idProdInicial]);

  // Cargar impacto al seleccionar lote de producto
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

  // Cargar stock de lotes de insumos si estamos en modo insumo
  useEffect(() => {
    if (!isOpen || modo !== "insumo") return;
    let vigente = true;
    setCargandoInsumos(true);
    listarStockLotes(undefined, true)
      .then((lotes) => {
        if (!vigente) return;
        setLotesInsumo(lotes);
      })
      .catch(() => {
        if (vigente) setErrorMasivo("Error al cargar los lotes de insumo.");
      })
      .finally(() => {
        if (vigente) setCargandoInsumos(false);
      });
    return () => {
      vigente = false;
    };
  }, [isOpen, modo]);

  // Al seleccionar lote de insumo, consultar trazabilidad
  useEffect(() => {
    if (!isOpen || modo !== "insumo" || !loteInsumoId || loteInsumoId <= 0) {
      setLotesAfectados([]);
      setSeleccionadosIds([]);
      setMapaImpactos({});
      return;
    }
    let vigente = true;
    setCargandoAfectados(true);
    setErrorMasivo(null);
    trazarLoteInsumo(loteInsumoId)
      .then((traza) => {
        if (!vigente) return;
        const lista = traza.lotes_producto || [];
        setLotesAfectados(lista);
        // Pre-seleccionar todos los que NO estén ya retirados
        const elegibles = lista
          .filter((l) => !(l as { retirado?: boolean; retiro_id?: number | null }).retirado && !(l as { retiro_id?: number | null }).retiro_id)
          .map((l) => l.lote_producto_id);
        setSeleccionadosIds(elegibles);

        // Cargar impactos de los lotes elegibles para las métricas de la tarjeta de impacto
        if (elegibles.length > 0) {
          setCargandoImpactosMasivos(true);
          Promise.allSettled(
            elegibles.map((id) => retiroService.obtenerImpactoRetiro(id))
          ).then((resultados) => {
            if (!vigente) return;
            const nuevoMapa: Record<number, ImpactoRetiro> = {};
            resultados.forEach((res) => {
              if (res.status === "fulfilled" && res.value) {
                nuevoMapa[res.value.lote_id] = res.value;
              }
            });
            setMapaImpactos(nuevoMapa);
            setCargandoImpactosMasivos(false);
          });
        } else {
          setMapaImpactos({});
        }
      })
      .catch((err) => {
        if (vigente) {
          setErrorMasivo(err instanceof Error ? err.message : "Error al trazar el lote de insumo.");
          setLotesAfectados([]);
          setSeleccionadosIds([]);
          setMapaImpactos({});
        }
      })
      .finally(() => {
        if (vigente) setCargandoAfectados(false);
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, modo, loteInsumoId]);

  // ---------------------------------------------------------
  // HANDLERS MODO PRODUCTO
  // ---------------------------------------------------------
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

  const guardandoIndividual = async () => {
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
      toaster.create({
        title: "Retiro iniciado",
        description: `Se inició el retiro del lote ${loteSeleccionado?.codigo ?? ""}.`,
        type: "success",
      });
      onRetiroIniciado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el retiro.");
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmitIndividual = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeEnviar(faltan.lista) || fechaInvalida) return;
    void guardandoIndividual();
  };

  // ---------------------------------------------------------
  // HANDLERS MODO INSUMO
  // ---------------------------------------------------------
  const lotesElegibles = lotesAfectados.filter(
    (l) => !(l as { retirado?: boolean }).retirado && !(l as { retiro_id?: number | null }).retiro_id
  );
  const todosSeleccionados =
    lotesElegibles.length > 0 &&
    lotesElegibles.every((l) => seleccionadosIds.includes(l.lote_producto_id));

  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      setSeleccionadosIds([]);
    } else {
      setSeleccionadosIds(lotesElegibles.map((l) => l.lote_producto_id));
    }
  };

  const toggleLoteId = (id: number) => {
    setSeleccionadosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const loteInsumoSeleccionadoObj = lotesInsumo.find(
    (li) => li.lote_insumo_id === loteInsumoId
  );

  // Totales acumulados de impacto para los lotes seleccionados en modo insumo
  const totalReservasACancelar = seleccionadosIds.reduce(
    (acc, id) => acc + (mapaImpactos[id]?.reservas_a_cancelar ?? 0),
    0
  );
  const totalClientesANotificar = seleccionadosIds.reduce(
    (acc, id) => acc + (mapaImpactos[id]?.total_afectadas ?? 0),
    0
  );

  const handleConfirmarMasivo = async () => {
    if (
      !loteInsumoId ||
      seleccionadosIds.length === 0 ||
      codigoConfirmarMasivo.trim().toUpperCase() !== "MASIVO"
    ) {
      return;
    }
    setEnviandoMasivo(true);
    setErrorMasivo(null);
    try {
      const res = await retiroService.iniciarRetiroMasivoInsumo({
        lote_insumo_id: loteInsumoId,
        lotes_producto_ids: seleccionadosIds,
        motivo: motivoInsumo,
        detalle: detalleInsumo.trim() || undefined,
        fecha_retiro: hoyISO(),
        desactivar_insumo: true,
      });
      toaster.create({
        title: "Retiros coordinados exitosos",
        description: res.mensaje || `Se retiraron ${res.retiros_creados.length} lotes de producto.`,
        type: "success",
      });
      onRetiroIniciado();
      onClose();
    } catch (err) {
      setErrorMasivo(
        err instanceof Error ? err.message : "Error al procesar el retiro masivo."
      );
    } finally {
      setEnviandoMasivo(false);
    }
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
        width="100%"
        maxWidth="640px"
        maxHeight="90vh"
        overflowY="auto"
        textAlign="left"
      >
        <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
          Iniciar retiro del mercado
        </DialogTitle>
        <Text fontSize="xs" color="fg.muted" mb="4">
          Activá el procedimiento de retiro de productos para mitigar riesgos de inocuidad y salud.
        </Text>

        {/* SELECTOR DE MODO SUPERIOR (TABS / SEGMENTED CONTROL) */}
        <Flex
          bg="bg.muted"
          p="1"
          rounded="lg"
          mb="5"
          gap="1"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <Button
            type="button"
            size="sm"
            flex="1"
            variant={modo === "producto" ? "solid" : "ghost"}
            colorPalette={modo === "producto" ? "brand" : "neutral"}
            bg={modo === "producto" ? "bg.panel" : "transparent"}
            color={modo === "producto" ? "brand.fg" : "fg.muted"}
            boxShadow={modo === "producto" ? "sm" : "none"}
            onClick={() => setModo("producto")}
          >
            <LuPackage /> Por Lote de Producto
          </Button>
          <Button
            type="button"
            size="sm"
            flex="1"
            variant={modo === "insumo" ? "solid" : "ghost"}
            colorPalette={modo === "insumo" ? "brand" : "neutral"}
            bg={modo === "insumo" ? "bg.panel" : "transparent"}
            color={modo === "insumo" ? "brand.fg" : "fg.muted"}
            boxShadow={modo === "insumo" ? "sm" : "none"}
            onClick={() => setModo("insumo")}
          >
            <LuBoxes /> Por Lote de Insumo con problema
          </Button>
        </Flex>

        {/* MODO 1: LOTE DE PRODUCTO (INDIVIDUAL) */}
        {modo === "producto" && (
          <form onSubmit={handleSubmitIndividual} noValidate>
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
                {MOTIVOS_PRODUCTO.map((m) => (
                  <option key={m} value={m}>
                    {m}
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
        )}

        {/* MODO 2: RETIRO MASIVO POR INSUMO DEFECTUOSO */}
        {modo === "insumo" && (
          <Box>
            {/* 1. Bloque de Responsable */}
            <Box p="3" bg="bg.muted" rounded="md" mb="4">
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

            {errorMasivo && <MensajeError>{errorMasivo}</MensajeError>}

            {/* 2. Selector de Lote de Insumo */}
            <FormField label="Lote de insumo afectado" required mb="4">
              <FormNativeSelect
                value={loteInsumoId === 0 ? "" : String(loteInsumoId)}
                disabled={cargandoInsumos || Boolean(loteInsumoInicialId)}
                onChange={(e) => setLoteInsumoId(Number(e.target.value))}
              >
                <option value="">-- Seleccionar Lote de Insumo --</option>
                {lotesInsumo.map((li) => (
                  <option key={li.lote_insumo_id} value={String(li.lote_insumo_id)}>
                    {li.insumo_nombre} · #{li.numero_lote} ({li.proveedor_nombre}) - Saldo: {li.saldo} {li.unidad}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            {/* 3. Tabla de Lotes de Producto Afectados */}
            {cargandoAfectados && (
              <Box py="6" textAlign="center">
                <Text fontSize="sm" color="fg.muted">
                  Buscando trazabilidad de lotes elaborados con este insumo...
                </Text>
              </Box>
            )}

            {!cargandoAfectados && loteInsumoId > 0 && lotesAfectados.length === 0 && (
              <Box p="4" bg="blue.subtle" borderWidth="1px" borderColor="blue.border" rounded="md" mb="4">
                <HStack gap="2">
                  <LuInfo color="blue.fg" />
                  <Text fontSize="sm" color="blue.fg">
                    Este lote de insumo aún no fue consumido en ningún lote de elaboración.
                  </Text>
                </HStack>
              </Box>
            )}

            {!cargandoAfectados && lotesAfectados.length > 0 && (
              <Box mb="4">
                <Flex justify="space-between" align="center" mb="2">
                  <Text fontSize="xs" fontWeight="bold" color="fg" textTransform="uppercase" letterSpacing="wider">
                    Lotes de producto elaborados ({lotesAfectados.length})
                  </Text>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    colorPalette="neutral"
                    onClick={toggleSeleccionarTodos}
                    disabled={lotesElegibles.length === 0}
                  >
                    {todosSeleccionados ? "Deseleccionar todos" : "Seleccionar todos"}
                  </Button>
                </Flex>

                <Box
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="md"
                  bg="white"
                  p={2}
                  maxH="240px"
                  overflowY="auto"
                >
                  <Table.Root size="sm" variant="outline">
                    <Table.Header bg="gray.50">
                      <Table.Row>
                        <Table.ColumnHeader w="44px" textAlign="center" py="2">
                          [✓]
                        </Table.ColumnHeader>
                        <Table.ColumnHeader fontSize="2xs" color="gray.600" fontWeight="bold" textTransform="uppercase" py="2">
                          LOTE / PRODUCTO
                        </Table.ColumnHeader>
                        <Table.ColumnHeader fontSize="2xs" color="gray.600" fontWeight="bold" textTransform="uppercase" py="2">
                          ELABORACIÓN
                        </Table.ColumnHeader>
                        <Table.ColumnHeader fontSize="2xs" color="gray.600" fontWeight="bold" textTransform="uppercase" py="2">
                          ESTADO
                        </Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {lotesAfectados.map((lote) => {
                        const yaRetirado = Boolean(
                          (lote as { retirado?: boolean }).retirado ||
                          (lote as { retiro_id?: number | null }).retiro_id
                        );
                        const seleccionado = seleccionadosIds.includes(lote.lote_producto_id);

                        return (
                          <Table.Row
                            key={lote.lote_producto_id}
                            bg={yaRetirado ? "gray.50" : seleccionado ? "red.50" : "white"}
                            opacity={yaRetirado ? 0.6 : 1}
                            cursor={yaRetirado ? "not-allowed" : "pointer"}
                            onClick={() => {
                              if (!yaRetirado) {
                                toggleLoteId(lote.lote_producto_id);
                              }
                            }}
                            _hover={{ bg: yaRetirado ? "gray.50" : seleccionado ? "red.100" : "gray.50" }}
                            transition="background-color 0.15s ease"
                          >
                            <Table.Cell
                              textAlign="center"
                              py="2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox.Root
                                checked={seleccionado}
                                disabled={yaRetirado}
                                onCheckedChange={(e) => {
                                  const isChecked = Boolean(e.checked);
                                  setSeleccionadosIds((prev) =>
                                    isChecked
                                      ? (prev.includes(lote.lote_producto_id) ? prev : [...prev, lote.lote_producto_id])
                                      : prev.filter((id) => id !== lote.lote_producto_id)
                                  );
                                }}
                                colorPalette="red"
                              >
                                <Checkbox.HiddenInput />
                                <Checkbox.Control cursor={yaRetirado ? "not-allowed" : "pointer"} />
                              </Checkbox.Root>
                            </Table.Cell>
                            <Table.Cell py="2">
                              <Text fontSize="xs" fontWeight="bold" color="gray.900" fontFamily="mono">
                                {lote.numero_lote}
                              </Text>
                              <Text fontSize="xs" fontWeight="medium" color="gray.800">
                                {lote.producto_nombre}
                              </Text>
                            </Table.Cell>
                            <Table.Cell fontSize="xs" color="gray.800" fontWeight="medium" py="2" whiteSpace="nowrap">
                              {formatoFecha(lote.fecha_inicio)}
                            </Table.Cell>
                            <Table.Cell py="2">
                              {yaRetirado ? (
                                <Badge size="xs" colorPalette="red" variant="solid">
                                  Ya retirado
                                </Badge>
                              ) : (
                                <Badge size="xs" colorPalette="green" variant="subtle">
                                  {lote.estado === "terminado" ? "Terminado" : lote.estado}
                                </Badge>
                              )}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Box>
            )}

            {/* 4. Select de Motivo */}
            <FormField label="Motivo del retiro masivo" required mb="3">
              <FormNativeSelect
                value={motivoInsumo}
                fontWeight="medium"
                color="fg"
                onChange={(e) => setMotivoInsumo(e.target.value)}
              >
                {MOTIVOS_INSUMO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            {/* 5. Input de Detalle / Observaciones */}
            <FormField label="Detalle / Observaciones del lote de insumo" mb="3">
              <FormInput
                type="text"
                placeholder="Ej. Notificación formal del proveedor por detección de aflatoxinas"
                value={detalleInsumo}
                onChange={(e) => setDetalleInsumo(e.target.value)}
                maxLength={500}
              />
            </FormField>

            {/* 6. Input de Fecha del retiro (solo lectura, idéntico a modo producto) */}
            <FormField
              label="Fecha del retiro"
              required
              mb="4"
              helper={`Hoy (${formatoFecha(hoyISO())})`}
            >
              <FormInput
                type="date"
                readOnly
                disabled
                value={hoyISO()}
              />
            </FormField>

            {/* Tarjeta de impacto acumulado (Estilo Producto con cajas de colores) */}
            {lotesAfectados.length > 0 && (
              <Box p="3" bg="bg.subtle" rounded="md" mb="5">
                <Flex justify="space-between" align="center" mb="3">
                  <HStack gap="2" align="center">
                    <Box as="span" display="inline-flex" aria-hidden>
                      <LuInfo size={16} color="brand.500" />
                    </Box>
                    <Text fontSize="sm" fontWeight="semibold" color="fg">
                      Impacto total de los lotes seleccionados ({seleccionadosIds.length})
                    </Text>
                  </HStack>
                  {cargandoImpactosMasivos && (
                    <HStack gap="1">
                      <Spinner size="xs" color="brand.500" />
                      <Text fontSize="2xs" color="fg.muted">Calculando...</Text>
                    </HStack>
                  )}
                </Flex>

                <SimpleGrid columns={2} gap="3" mb="3">
                  <Box p="2" bg="purple.subtle" borderWidth="1px" borderColor="purple.border" rounded="md">
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Lotes a retirar
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="purple.fg">
                      {seleccionadosIds.length}
                    </Text>
                  </Box>
                  <Box p="2" bg="blue.subtle" borderWidth="1px" borderColor="blue.border" rounded="md">
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Clientes totales a notificar
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="blue.fg">
                      {totalClientesANotificar}
                    </Text>
                  </Box>
                  <Box p="2" bg="orange.subtle" borderWidth="1px" borderColor="orange.border" rounded="md">
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Reservas a cancelar
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="orange.fg">
                      {totalReservasACancelar}
                    </Text>
                  </Box>
                  <Box p="2" bg="red.subtle" borderWidth="1px" borderColor="red.border" rounded="md">
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Insumo a bloquear
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="red.fg">
                      {loteInsumoSeleccionadoObj ? `${loteInsumoSeleccionadoObj.saldo} ${loteInsumoSeleccionadoObj.unidad}` : "Bloqueo total"}
                    </Text>
                  </Box>
                </SimpleGrid>

                {/* Alerta de bloqueo automático del insumo en almacén */}
                <Box
                  p="2.5"
                  bg="orange.subtle"
                  borderWidth="1px"
                  borderColor="orange.border"
                  rounded="md"
                >
                  <HStack gap="2" align="flex-start">
                    <Box as="span" mt="0.5" flexShrink={0} aria-hidden>
                      <LuTriangleAlert size={15} color="orange.fg" />
                    </Box>
                    <Text fontSize="xs" color="orange.fg">
                      <strong>Bloqueo automático de almacén:</strong> El saldo restante del lote de insumo ({loteInsumoSeleccionadoObj ? `${loteInsumoSeleccionadoObj.saldo} ${loteInsumoSeleccionadoObj.unidad}` : "saldo disponible"}) será dado de baja y bloqueado automáticamente para producción.
                    </Text>
                  </HStack>
                </Box>
              </Box>
            )}

            {/* 7. Bloque rojo de Advertencia y Freno de Seguridad Obligatorio (idéntico a Modo Producto) */}
            <Box p="3" bg="red.subtle" borderWidth="1px" borderColor="red.border" rounded="md" mb="5">
              <HStack gap="3" align="flex-start" mb="2">
                <Box as="span" mt="0.5" flexShrink={0} aria-hidden>
                  <LuTriangleAlert size={16} color="red.fg" />
                </Box>
                <Text fontSize="sm" color="red.fg" fontWeight="medium">
                  Esta acción es irreversible y retirará {seleccionadosIds.length} {seleccionadosIds.length === 1 ? "lote" : "lotes"} del mercado.
                </Text>
              </HStack>
              <Text fontSize="xs" color="red.fg" mt="1" mb="3">
                Al confirmar, los lotes de producto seleccionados quedarán retirados y no se podrán hacer nuevas reservas ni despachos sobre ellos. Las reservas pendientes se cancelan automáticamente y los clientes de las salidas afectadas quedan pendientes de notificación.
              </Text>
              <FormField
                label="Confirmación de seguridad requerida"
                required
                mb="0"
                invalid={
                  codigoConfirmarMasivo.length > 0 &&
                  codigoConfirmarMasivo.trim().toUpperCase() !== "MASIVO"
                }
                helper='Escribí "MASIVO" para confirmar que comprendés el alcance e iniciar los retiros.'
              >
                <FormInput
                  type="text"
                  value={codigoConfirmarMasivo}
                  onChange={(e) => setCodigoConfirmarMasivo(e.target.value)}
                  placeholder="MASIVO"
                />
              </FormField>
            </Box>

            {/* 8. Botones de acción */}
            <AccionesFormulario>
              <Button
                type="button"
                colorPalette="red"
                variant="solid"
                loading={enviandoMasivo}
                disabled={
                  enviandoMasivo ||
                  seleccionadosIds.length === 0 ||
                  codigoConfirmarMasivo.trim().toUpperCase() !== "MASIVO"
                }
                onClick={handleConfirmarMasivo}
              >
                Iniciar {seleccionadosIds.length} {seleccionadosIds.length === 1 ? "retiro coordinado" : "retiros coordinados"}
              </Button>
              <BotonCancelar onClick={onClose} disabled={enviandoMasivo}>
                Cancelar
              </BotonCancelar>
            </AccionesFormulario>
          </Box>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
