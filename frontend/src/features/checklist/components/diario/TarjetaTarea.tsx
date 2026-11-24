import { useState, type ChangeEvent } from "react";
import { Badge, Box, Button, Checkbox, HStack, IconButton, Image, Spinner, Stack, Text } from "@chakra-ui/react";
import {
  LuBookOpen,
  LuCheck,
  LuChevronDown,
  LuHistory,
  LuImage,
  LuPaperclip,
  LuShieldAlert,
  LuShieldPlus,
  LuTriangleAlert,
  LuUser,
  LuX,
} from "react-icons/lu";
import type { User } from "../../../../common/context/auth-context";
import { MensajeError } from "../../../../components/ui/patrones";
import { Tooltip } from "../../../../components/ui/tooltip";
import type { ElementoLimpiezaOpcion } from "../../../elementoLimpieza/types/elementoLimpieza";
import type { InsumoQuimicoOpcion } from "../../../insumoQuimico/types/insumoQuimico";
import type { ConsumoTarea, TareaDelDia } from "../../types/checklist";
import { FotoEvidenciaDialog, HistorialTareaDialog } from "./DialogosTarea";
import { CampoRegistro } from "./campos";
import { RegistroInsumos, ResumenInsumos } from "./RegistroInsumos";
import { completadaPor, etiquetaEtapa, filaConsumoVacia, idTareaChecklist, type FilaConsumo } from "./modelo";

/**
 * Las dos filas de abajo (observaciones | "Ver procedimiento", y registro |
 * evidencia) comparten la misma grilla: contenido a la izquierda y una columna
 * derecha de ancho fijo. Así la alerta de observaciones y la tabla de
 * elementos y productos terminan exactamente en el mismo lugar.
 */
const GRILLA_FILAS = { base: "1fr", md: "minmax(0, 1fr) 220px" } as const;

// Mismos formatos que acepta el backend (EXTENSIONES_EVIDENCIA en src/checklist/router.py).
const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Paleta del badge de etapa: operacional verde, postoperacional coral. */
const PALETA_ETAPA: Record<string, string> = {
  preoperacional: "blue",
  operacional: "green",
  postoperacional: "red",
};

export interface TarjetaTareaProps {
  tarea: TareaDelDia;
  isLoading: boolean;
  insumosQuimicos: InsumoQuimicoOpcion[];
  elementosLimpieza: ElementoLimpiezaOpcion[];
  usuarioActual: User | null;
  puedeAsignarCobertura: boolean;
  onAsignarCobertura: (registroId: number) => void;
  /** Se llegó a esta tarea desde un enlace (p. ej. el inicio): se marca un momento. */
  resaltada?: boolean;
  onToggle: (
    tareaId: number,
    estadoActual: boolean,
    evidencia?: File,
    consumos?: ConsumoTarea[],
    elementosLimpiezaIds?: number[],
  ) => void;
}

/**
 * Tarea del checklist como tarjeta horizontal:
 *
 *   [✓] Nombre · Etapa                       Operador  + Cobertura  Historial
 *   ⚠ Observaciones de seguridad            [Ver procedimiento]
 *   [Elemento ▾]   [Producto químico ▾]   [Adjuntar evidencia]
 *
 * Antes los campos iban apilados a la izquierda y la casilla flotaba sola en
 * otra columna, lejos de lo que confirmaba. La lógica es la misma: valida el
 * consumo (producto y cantidad juntos, cantidad > 0), manda la evidencia y
 * respeta quién puede marcar.
 */
export function TarjetaTarea({
  tarea,
  isLoading,
  insumosQuimicos,
  elementosLimpieza,
  usuarioActual,
  puedeAsignarCobertura,
  onAsignarCobertura,
  resaltada = false,
  onToggle,
}: TarjetaTareaProps) {
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null);
  // Varios productos (cada uno con su cantidad) y varios elementos por tarea.
  const [filasConsumo, setFilasConsumo] = useState<FilaConsumo[]>(() =>
    tarea.consumos && tarea.consumos.length > 0
      ? tarea.consumos.map((c) => filaConsumoVacia(String(c.insumo_quimico_id), String(c.cantidad)))
      : [filaConsumoVacia()],
  );
  const [elementosSeleccionados, setElementosSeleccionados] = useState<number[]>(
    tarea.elementos_limpieza_ids ?? [],
  );
  const [errorConsumo, setErrorConsumo] = useState<string | null>(null);
  const [mostrarProcedimiento, setMostrarProcedimiento] = useState(false);
  const [mostrarFoto, setMostrarFoto] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [previewEvidencia, setPreviewEvidencia] = useState<string | null>(null);
  const [errorEvidencia, setErrorEvidencia] = useState<string | null>(null);

  const esHistorico = tarea.checklist_estado === "cerrado";
  const esFuturo = tarea.registro_id === 0;
  const esCerrado = esHistorico || esFuturo;
  const editable = !tarea.completado && !esCerrado;

  const esAdmin = usuarioActual?.puede_administrar || usuarioActual?.es_super_admin || false;
  const esOperadorAsignado = tarea.operador_id != null && tarea.operador_id === usuarioActual?.id;
  const esReemplazado = tarea.reemplazado_por_id != null && tarea.reemplazado_por_id === usuarioActual?.id;
  const tareaSinAsignar = tarea.operador_id == null;
  // Al operador no se le repite su propio nombre en cada tarea; sí cuando otra
  // persona lo cubre (para que se vea quién) o la tarea es de otro.
  const mostrarAsignado = esAdmin || !esOperadorAsignado || tarea.reemplazado_por_id != null;
  // Puede marcar si: es admin, es el operador asignado, es quien la cubrió,
  // o la tarea no tiene operador asignado (cualquier operador la toma).
  const puedeMarcar = esAdmin || esOperadorAsignado || esReemplazado || tareaSinAsignar;

  const idInputEvidencia = `evidencia-${tarea.registro_id}-${tarea.id}`;

  /** Limpia archivo, preview e input (así elegir la misma foto vuelve a disparar el onChange). */
  const limpiarEvidencia = () => {
    setArchivoEvidencia(null);
    setPreviewEvidencia(null);
    setErrorEvidencia(null);
    const input = document.getElementById(idInputEvidencia) as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const handleEvidenciaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setErrorEvidencia(null);
    if (!file) {
      limpiarEvidencia();
      return;
    }
    if (!FORMATOS_PERMITIDOS.includes(file.type)) {
      setErrorEvidencia("Formato no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WebP).");
      limpiarEvidencia();
      return;
    }
    setArchivoEvidencia(file);
    // Data URL para mostrarla sin subirla todavía.
    const reader = new FileReader();
    reader.onloadend = () => setPreviewEvidencia(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCheckboxClick = () => {
    if (tarea.completado) {
      onToggle(tarea.id, tarea.completado, archivoEvidencia || undefined);
      limpiarEvidencia();
      setErrorConsumo(null);
      return;
    }

    // Cada fila con producto necesita una cantidad mayor que 0; una fila sin
    // producto ni cantidad es la vacía de "Sin producto químico" y se ignora.
    const consumos: ConsumoTarea[] = [];
    for (const fila of filasConsumo) {
      const hayProducto = fila.insumoId !== "";
      const hayCantidad = fila.cantidad !== "";
      if (!hayProducto && !hayCantidad) continue;
      if (hayProducto !== hayCantidad) {
        setErrorConsumo("Indicá la cantidad consumida de cada producto químico elegido.");
        return;
      }
      const cantidad = Number(fila.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        setErrorConsumo("La cantidad consumida debe ser mayor que 0.");
        return;
      }
      consumos.push({ insumo_quimico_id: Number(fila.insumoId), cantidad });
    }

    setErrorConsumo(null);
    onToggle(tarea.id, tarea.completado, archivoEvidencia || undefined, consumos, elementosSeleccionados);
    limpiarEvidencia();
  };

  const quien = completadaPor(tarea, usuarioActual);
  const horaCompletada = tarea.fecha_completado
    ? new Date(tarea.fecha_completado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : null;

  return (
    <Box
      id={tarea.registro_id > 0 ? idTareaChecklist(tarea.registro_id) : undefined}
      scrollMarginTop="24"
      outline={resaltada ? "2px solid" : undefined}
      outlineColor="teal.solid"
      outlineOffset="2px"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={tarea.completado ? "green.muted" : "border.subtle"}
      borderLeftWidth="4px"
      borderLeftColor={tarea.completado ? "green.solid" : esCerrado ? "border" : "teal.muted"}
      rounded="lg"
      p={{ base: "3", md: "4" }}
      opacity={tarea.completado ? 0.82 : esCerrado ? 0.75 : 1}
      transition="opacity 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
      _hover={editable ? { boxShadow: "sm", borderColor: "border" } : undefined}
    >
      {/* ── Encabezado: estado + título + etapa · operador y acciones ── */}
      <Stack direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "stretch", md: "flex-start" }} gap="3">
        <HStack align="flex-start" gap="3" minW="0" flex="1">
          <ControlEstado
            tarea={tarea}
            isLoading={isLoading}
            esFuturo={esFuturo}
            esHistorico={esHistorico}
            puedeMarcar={puedeMarcar}
            onMarcar={handleCheckboxClick}
          />
          <Box minW="0" pt="2">
            <HStack gap="2" flexWrap="wrap">
              <Text
                fontWeight="semibold"
                color="fg"
                fontSize="md"
                lineHeight="1.3"
                textDecoration={tarea.completado ? "line-through" : undefined}
                textDecorationColor="fg.subtle"
              >
                {tarea.nombre}
              </Text>
              {tarea.tipo && (
                <Badge colorPalette={PALETA_ETAPA[tarea.tipo] ?? "gray"} variant="subtle" rounded="full" px="2.5" py="0.5">
                  {etiquetaEtapa(tarea.tipo)}
                </Badge>
              )}
            </HStack>
            {tarea.completado && (horaCompletada || quien) && (
              <HStack gap="1.5" mt="1" fontSize="xs" color="green.fg" fontVariantNumeric="tabular-nums">
                <LuCheck size={12} aria-hidden />
                <Text as="span">
                  Completada{quien ? ` por ${quien}` : ""}
                  {horaCompletada ? ` · ${horaCompletada}` : ""}
                </Text>
              </HStack>
            )}
          </Box>
        </HStack>

        <HStack gap="2" flexWrap="wrap" justify={{ base: "flex-start", md: "flex-end" }} ps={{ base: "14", md: "0" }}>
          {tarea.operador_id && tarea.operador_nombre && mostrarAsignado && (
            <Chip paleta="blue" icono={<LuUser size={13} />} titulo={`Asignado a: ${tarea.operador_nombre}`}>
              {tarea.operador_nombre}
            </Chip>
          )}
          {tarea.reemplazado_por_id && tarea.reemplazado_por_nombre && (
            <Chip paleta="orange" icono={<LuShieldAlert size={13} />} titulo={`Cubierto por: ${tarea.reemplazado_por_nombre}`}>
              {tarea.reemplazado_por_nombre}
            </Chip>
          )}
          {!tarea.operador_id && !esCerrado && !tarea.completado && <Chip paleta="gray">Sin asignar</Chip>}
          {/* Una tarea ya hecha no necesita quién la cubra. */}
          {puedeAsignarCobertura && !esCerrado && !tarea.completado && tarea.registro_id > 0 && (
            <Button
              size="sm"
              h="9"
              variant="ghost"
              colorPalette="teal"
              onClick={() => onAsignarCobertura(tarea.registro_id)}
              title="Elegir quién cubre esta tarea hoy"
            >
              <LuShieldPlus aria-hidden /> Suplente
            </Button>
          )}
          {tarea.evidencia_url && (
            <BotonIcono etiqueta="Ver evidencia fotográfica" onClick={() => setMostrarFoto(true)}>
              <LuImage size={18} />
            </BotonIcono>
          )}
          {tarea.registro_id > 0 && (
            <BotonIcono etiqueta="Historial de cambios" onClick={() => setMostrarHistorial(true)}>
              <LuHistory size={18} />
            </BotonIcono>
          )}
        </HStack>
      </Stack>

      {/* ── Seguridad y guía ── */}
      {(tarea.observaciones || tarea.descripcion) && (
        <Box
          display="grid"
          gridTemplateColumns={GRILLA_FILAS}
          gap="3"
          mt="3"
          ms={{ base: "0", md: "14" }}
          alignItems="start"
        >
          {tarea.observaciones ? (
            <HStack
              flex="1"
              align="flex-start"
              gap="2.5"
              px="3"
              py="2.5"
              rounded="md"
              bg="orange.subtle"
              borderWidth="1px"
              borderColor="orange.muted"
              color="orange.fg"
              role="note"
            >
              <Box mt="0.5" flexShrink={0} aria-hidden>
                <LuTriangleAlert size={16} />
              </Box>
              <Box fontSize="sm" whiteSpace="pre-line">
                <Text as="span" fontWeight="semibold">
                  Observaciones:{" "}
                </Text>
                <Text as="span" color="fg">
                  {tarea.observaciones}
                </Text>
              </Box>
            </HStack>
          ) : (
            <Box display={{ base: "none", md: "block" }} />
          )}
          {tarea.descripcion && (
            <Button
              size="sm"
              h="10"
              w="100%"
              variant="outline"
              colorPalette="gray"
              flexShrink={0}
              onClick={() => setMostrarProcedimiento((v) => !v)}
              aria-expanded={mostrarProcedimiento}
            >
              <LuBookOpen aria-hidden />
              {mostrarProcedimiento ? "Ocultar procedimiento" : "Ver procedimiento"}
              <Box
                as="span"
                display="inline-flex"
                transform={mostrarProcedimiento ? "rotate(180deg)" : undefined}
                transition="transform 0.2s ease"
                aria-hidden
              >
                <LuChevronDown />
              </Box>
            </Button>
          )}
        </Box>
      )}
      {tarea.descripcion && mostrarProcedimiento && (
        <Box
          mt="3"
          ms={{ base: "0", md: "14" }}
          p="3"
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="md"
          whiteSpace="pre-line"
          fontSize="sm"
          color="fg"
        >
          {tarea.descripcion}
        </Box>
      )}

      {/* ── Elementos, productos y evidencia ── */}
      {editable && (
        <Box mt="4" ms={{ base: "0", md: "14" }}>
          <Box display="grid" gridTemplateColumns={GRILLA_FILAS} gap="3" alignItems="start">
            <RegistroInsumos
              nombreTarea={tarea.nombre}
              elementos={elementosLimpieza}
              quimicos={insumosQuimicos}
              elementosSeleccionados={elementosSeleccionados}
              filasConsumo={filasConsumo}
              onGuardar={(ids, filas) => {
                setElementosSeleccionados(ids);
                setFilasConsumo(filas);
                setErrorConsumo(null);
              }}
            />

            <CampoRegistro etiqueta="Evidencia">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: "none" }}
                id={idInputEvidencia}
                onChange={handleEvidenciaChange}
              />
              {previewEvidencia ? (
                <HStack
                  gap="2"
                  h="11"
                  ps="1"
                  pe="1"
                  borderWidth="1px"
                  borderColor="teal.muted"
                  bg="teal.subtle"
                  rounded="lg"
                >
                  <Image src={previewEvidencia} alt="Vista previa de la evidencia" boxSize="9" objectFit="cover" rounded="md" />
                  <Text fontSize="sm" color="teal.fg" fontWeight="medium" lineClamp={1} maxW="140px" title={archivoEvidencia?.name}>
                    1 foto lista
                  </Text>
                  <IconButton
                    type="button"
                    onClick={limpiarEvidencia}
                    aria-label="Quitar evidencia"
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    rounded="md"
                  >
                    <LuX />
                  </IconButton>
                </HStack>
              ) : (
                <Button
                  type="button"
                  h="11"
                  w="100%"
                  variant="outline"
                  colorPalette="gray"
                  borderStyle="dashed"
                  onClick={() => document.getElementById(idInputEvidencia)?.click()}
                >
                  <LuPaperclip aria-hidden />
                  Adjuntar evidencia
                </Button>
              )}
            </CampoRegistro>
          </Box>
          {errorConsumo && <MensajeError>{errorConsumo}</MensajeError>}
          {errorEvidencia && <MensajeError>{errorEvidencia}</MensajeError>}
        </Box>
      )}

      {/*
        Tarea hecha (o de un día cerrado): lo que quedó registrado, de solo
        lectura, en la misma columna y con el mismo ancho que las observaciones.
        Antes, al marcarla, el bloque de registro desaparecía y no se veía qué
        se había usado.
      */}
      {!editable && ((tarea.consumos?.length ?? 0) > 0 || (tarea.elementos_limpieza_ids?.length ?? 0) > 0) && (
        <Box mt="4" ms={{ base: "0", md: "14" }} display="grid" gridTemplateColumns={GRILLA_FILAS} gap="3">
          <CampoRegistro etiqueta="Elementos y productos químicos utilizados">
            <ResumenInsumos
              elementos={elementosLimpieza}
              quimicos={insumosQuimicos}
              elementosIds={tarea.elementos_limpieza_ids ?? []}
              consumos={(tarea.consumos ?? []).map((c) => ({ insumoId: c.insumo_quimico_id, cantidad: c.cantidad }))}
            />
          </CampoRegistro>
        </Box>
      )}

      {mostrarFoto && tarea.evidencia_url && (
        <FotoEvidenciaDialog ruta={tarea.evidencia_url} onCerrar={() => setMostrarFoto(false)} />
      )}
      {mostrarHistorial && (
        <HistorialTareaDialog
          registroId={tarea.registro_id}
          nombreTarea={tarea.nombre}
          onCerrar={() => setMostrarHistorial(false)}
        />
      )}
    </Box>
  );
}

/* ─────────────────────────── Piezas ─────────────────────────── */

/**
 * Control principal de la tarea: casilla grande (área táctil de 44px) en un
 * checklist abierto; tilde o cruz fijos en uno cerrado; guion en la vista
 * previa de un día futuro.
 */
function ControlEstado({
  tarea,
  isLoading,
  esFuturo,
  esHistorico,
  puedeMarcar,
  onMarcar,
}: {
  tarea: TareaDelDia;
  isLoading: boolean;
  esFuturo: boolean;
  esHistorico: boolean;
  puedeMarcar: boolean;
  onMarcar: () => void;
}) {
  const caja = { w: "11", h: "11", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", rounded: "lg" } as const;

  if (isLoading) {
    return (
      <Box {...caja} bg="bg.subtle">
        <Spinner size="sm" color="teal.solid" />
      </Box>
    );
  }
  if (esFuturo) {
    return (
      <Box {...caja} bg="bg.subtle" color="fg.subtle" title="Vista previa: todavía no llegó ese día">
        —
      </Box>
    );
  }
  if (esHistorico) {
    const texto = tarea.completado ? "Completada (checklist cerrado)" : "No completada (checklist cerrado)";
    return (
      <Box
        {...caja}
        bg={tarea.completado ? "green.subtle" : "red.subtle"}
        color={tarea.completado ? "green.fg" : "red.fg"}
        role="img"
        aria-label={texto}
        title={texto}
      >
        {tarea.completado ? <LuCheck size={22} /> : <LuX size={22} />}
      </Box>
    );
  }
  return (
    <Tooltip
      content={
        !puedeMarcar
          ? "Solo el operador asignado, su cobertura o administración pueden marcarla"
          : tarea.completado
            ? "Desmarcar"
            : "Marcar como completada"
      }
      showArrow
      openDelay={400}
    >
      <Checkbox.Root
        checked={tarea.completado}
        onCheckedChange={puedeMarcar ? onMarcar : undefined}
        disabled={!puedeMarcar}
        colorPalette="green"
        size="lg"
        {...caja}
        cursor={puedeMarcar ? "pointer" : "not-allowed"}
        bg={tarea.completado ? "green.subtle" : "bg.subtle"}
        _hover={puedeMarcar ? { bg: tarea.completado ? "green.muted" : "teal.subtle" } : undefined}
        transition="background-color 0.15s ease"
      >
        <Checkbox.HiddenInput aria-label={`Marcar "${tarea.nombre}" como completada`} />
        <Checkbox.Control w="6" h="6" rounded="md" borderWidth="2px" cursor="inherit">
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Root>
    </Tooltip>
  );
}

function Chip({
  paleta,
  icono,
  titulo,
  children,
}: {
  paleta: string;
  icono?: React.ReactNode;
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge colorPalette={paleta} variant="subtle" rounded="full" px="2.5" h="7" gap="1.5" fontWeight="medium" title={titulo}>
      {icono}
      {children}
    </Badge>
  );
}

function BotonIcono({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip content={etiqueta} showArrow openDelay={300} closeDelay={0}>
      <IconButton
        type="button"
        aria-label={etiqueta}
        onClick={onClick}
        variant="outline"
        colorPalette="gray"
        size="sm"
        w="10"
        h="10"
        rounded="lg"
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}
