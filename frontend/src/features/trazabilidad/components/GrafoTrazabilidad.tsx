import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  useChakraContext,
} from "@chakra-ui/react";
import { LuArrowRight, LuRotateCcw, LuX } from "react-icons/lu";
import { BotonCancelar, EtiquetaEstado, Tarjeta, type TonoEstado } from "../../../components/ui/patrones";
import { formatoFecha, formatoFechaHora } from "../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { getTimelineLote } from "../../lotes/services/loteService";
import type { LoteTimelineResponse, NodoTimeline } from "../../lotes/types/timeline";
import { ESTADOS_SALIDA } from "../../salidas/types/salida";
import type { GrafoTrazabilidadResponse, NodoGrafo } from "../types/grafo";

interface GrafoTrazabilidadProps {
  grafo: GrafoTrazabilidadResponse;
}

type TipoVisual = "P" | "L" | "Ini" | "Paso" | "Fin" | "S" | "C";

interface Paleta {
  bg: string;
  borde: string;
  texto: string;
}

interface NodoDibujo {
  id: string;
  x: number;
  y: number;
  radio: number;
  tipo: TipoVisual;
  /** Lo que va dentro del círculo. */
  marca: string;
  linea1: string;
  linea2: string;
  /** Texto completo, para el tooltip (las líneas se recortan). */
  tooltip: string;
  paleta: Paleta;
  grafo?: NodoGrafo;
  tarea?: NodoTimeline;
}

interface Arista {
  id: string;
  origenId: string;
  destinoId: string;
  d: string;
}

interface Pastilla {
  id: string;
  /** La pastilla se apaga junto con esta arista. */
  aristaId: string;
  /** Punto de anclaje: el borde izquierdo ("inicio") o derecho ("fin") de la pastilla. */
  x: number;
  y: number;
  alinear: "inicio" | "fin";
  texto: string;
}

const RADIO = 22;
const ESPACIADO_Y = 110;
const MARGEN_Y = 70;
const COL = 230;
const PASO = 190;

const PALETAS: Record<string, Paleta> = {
  proveedor: { bg: "#FAF5FF", borde: "#9333EA", texto: "#7E22CE" },
  insumo: { bg: "#EFF6FF", borde: "#2563EB", texto: "#1D4ED8" },
  elaboracion: { bg: "#F0FDFA", borde: "#0D9488", texto: "#0F766E" },
  completo: { bg: "#ECFDF5", borde: "#10B981", texto: "#047857" },
  pendiente: { bg: "#FEF3C7", borde: "#F59E0B", texto: "#B45309" },
  cancelado: { bg: "#FEF2F2", borde: "#DC2626", texto: "#B91C1C" },
  salida: { bg: "#FFF7ED", borde: "#F97316", texto: "#C2410C" },
  cliente: { bg: "#F0FDF4", borde: "#16A34A", texto: "#15803D" },
};

const LEYENDA: { color: string; texto: string }[] = [
  { color: PALETAS.proveedor.borde, texto: "Proveedores" },
  { color: PALETAS.insumo.borde, texto: "Lotes de insumo" },
  { color: PALETAS.elaboracion.borde, texto: "Elaboración" },
  { color: PALETAS.salida.borde, texto: "Salidas" },
  { color: PALETAS.cliente.borde, texto: "Clientes" },
];

const NOMBRE_TIPO: Record<TipoVisual, string> = {
  P: "Proveedor",
  L: "Lote de insumo",
  Ini: "Inicio de elaboración",
  Paso: "Etapa de elaboración",
  Fin: "Cierre del lote",
  S: "Salida",
  C: "Cliente",
};

const FORMA_ENTREGA: Record<string, string> = {
  RETIRA_CLIENTE: "Retira el cliente en planta",
  CON_TRANSPORTISTA: "Con transportista",
};

function truncar(texto: string | null | undefined, max: number): string {
  if (!texto) return "";
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

function etiquetaEstadoSalida(estado: string | null | undefined): string {
  return ESTADOS_SALIDA.find((e) => e.valor === estado)?.etiqueta ?? estado ?? "-";
}

/**
 * Ubica `n` nodos alrededor de las alturas deseadas sin que se pisen: respeta
 * el orden, separa al menos `ESPACIADO_Y` y no se sale de [min, max].
 */
function repartir(deseadas: number[], min: number, max: number): number[] {
  const ys = [...deseadas];
  for (let i = 0; i < ys.length; i++) {
    ys[i] = Math.max(ys[i], min, i > 0 ? ys[i - 1] + ESPACIADO_Y : min);
  }
  for (let i = ys.length - 1; i >= 0; i--) {
    ys[i] = Math.min(ys[i], max, i < ys.length - 1 ? ys[i + 1] - ESPACIADO_Y : max);
  }
  return ys;
}

/** Curva horizontal suave entre dos puntos. */
function curvaHorizontal(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Sale horizontal y entra vertical (desde arriba o abajo) a un nodo del eje central. */
function curvaHaciaEje(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} C ${x2} ${y1}, ${x2} ${y1}, ${x2} ${y2}`;
}

// Los globos y las pastillas son HTML dentro de un <foreignObject>: el
// navegador calcula el ancho, el padding y el centrado (antes se estimaba el
// ancho del texto y desbordaba). El foreignObject es una caja holgada y el
// contenido se acomoda adentro con flex; lo que sobra es transparente.
const CAJA_GLOBO = { ancho: 220, alto: 56 };
const CAJA_PASTILLA = { ancho: 140, alto: 24 };

/** Globo de dos renglones bajo el nodo. */
function Globo({ titulo, detalle, elegido }: { titulo: string; detalle: string; elegido: boolean }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap="3px"
      px="12px"
      py="6px"
      whiteSpace="nowrap"
      lineHeight="1.25"
      bg="bg.panel"
      borderWidth={elegido ? "1.5px" : "1px"}
      borderColor={elegido ? "#2563EB" : "border.emphasized"}
      borderRadius="8px"
    >
      <Box as="span" fontSize="12px" fontWeight={elegido ? 700 : 600} color="fg">
        {titulo}
      </Box>
      <Box as="span" fontSize="10.5px" fontWeight={400} color="fg.muted">
        {detalle}
      </Box>
    </Box>
  );
}

/** Pastilla de cantidad sobre una línea. */
function PastillaCantidad({ texto, resaltada }: { texto: string; resaltada: boolean }) {
  return (
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      h="20px"
      px="10px"
      whiteSpace="nowrap"
      lineHeight="1"
      fontSize="10.5px"
      fontWeight={600}
      color="fg"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={resaltada ? "#2563EB" : "border.emphasized"}
      borderRadius="full"
    >
      {texto}
    </Box>
  );
}

export function GrafoTrazabilidad({ grafo }: GrafoTrazabilidadProps) {
  const navigate = useNavigate();
  const system = useChakraContext();
  const [respuesta, setRespuesta] = useState<{ loteId: number; timeline: LoteTimelineResponse | null } | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  // Las etapas del checklist salen de la línea de tiempo del lote. Hasta que
  // responde no se dibuja: si no, el grafo aparece sin etapas y salta.
  useEffect(() => {
    let montado = true;
    getTimelineLote(grafo.lote_id)
      .then((data) => {
        if (montado) setRespuesta({ loteId: grafo.lote_id, timeline: data });
      })
      .catch(() => {
        // Sin línea de tiempo los lotes de insumo se conectan al inicio.
        if (montado) setRespuesta({ loteId: grafo.lote_id, timeline: null });
      });
    return () => {
      montado = false;
    };
  }, [grafo.lote_id]);
  const timelineListo = respuesta?.loteId === grafo.lote_id;
  const timeline = timelineListo ? respuesta.timeline : null;

  const layout = useMemo(() => {
    const nodos: Record<string, NodoDibujo> = {};
    const aristas: Arista[] = [];
    const pastillas: Pastilla[] = [];
    const adelante: Record<string, string[]> = {};
    const atras: Record<string, string[]> = {};

    const conectar = (origen: string, destino: string, d: string) => {
      const id = `${origen}->${destino}`;
      if (aristas.some((a) => a.id === id)) return id;
      aristas.push({ id, origenId: origen, destinoId: destino, d });
      (adelante[origen] ??= []).push(destino);
      (atras[destino] ??= []).push(origen);
      return id;
    };

    const delTipo = (columna: NodoGrafo["columna"]) => grafo.nodos.filter((n) => n.columna === columna);
    const proveedores = delTipo("proveedor");
    const salidasRaw = delTipo("despacho");
    const clientes = delTipo("cliente");
    const nodoLote = grafo.nodos.find((n) => n.columna === "lote_producto");

    const origenDe = (destino: string) => grafo.conexiones.find((c) => c.destino_id === destino);
    const destinoDe = (origen: string) => grafo.conexiones.find((c) => c.origen_id === origen);

    // Etapas: cada ítem del checklist es `tarea_<id>` en la línea de tiempo.
    const tareas = (timeline?.nodos ?? []).filter((n) => n.tipo === "tarea");
    const cierre = timeline?.nodos.find((n) => n.tipo === "cierre");
    const indicePorItem = new Map<number, number>();
    tareas.forEach((t, i) => {
      const itemId = Number(t.id.replace("tarea_", ""));
      if (Number.isFinite(itemId)) indicePorItem.set(itemId, i);
    });

    // Orden de los lotes de insumo: por la primera etapa que los usa y por
    // proveedor, así las líneas casi no se cruzan.
    const ordenProveedor = new Map(proveedores.map((p, i) => [p.id, i]));
    const lotesInsumo = delTipo("insumo")
      .map((li) => {
        const pasos = (li.metadatos.checklist_items ?? [])
          .map((item) => indicePorItem.get(item))
          .filter((i): i is number => i !== undefined);
        const proveedorId = origenDe(li.id)?.origen_id ?? null;
        return { li, pasos, proveedorId };
      })
      .sort(
        (a, b) =>
          (a.pasos[0] ?? -1) - (b.pasos[0] ?? -1) ||
          (ordenProveedor.get(a.proveedorId ?? "") ?? 0) - (ordenProveedor.get(b.proveedorId ?? "") ?? 0),
      );

    // Salidas agrupadas por cliente.
    const ordenCliente = new Map(clientes.map((c, i) => [c.id, i]));
    const salidas = salidasRaw
      .map((s) => ({ s, clienteId: destinoDe(s.id)?.destino_id ?? null }))
      .sort(
        (a, b) =>
          (ordenCliente.get(a.clienteId ?? "") ?? 999) - (ordenCliente.get(b.clienteId ?? "") ?? 999),
      );

    // Geometría
    const filas = Math.max(lotesInsumo.length, salidas.length, proveedores.length, clientes.length, 3);
    const alto = (filas - 1) * ESPACIADO_Y + MARGEN_Y * 2 + 30;
    const minY = MARGEN_Y;
    const maxY = alto - MARGEN_Y - 30;
    const centroY = (minY + maxY) / 2;
    const columna = (n: number) => centroY - ((n - 1) * ESPACIADO_Y) / 2;

    const xP = 110;
    const xL = xP + COL;
    const xIni = xL + COL + 40;
    const xPaso = (i: number) => xIni + PASO * (i + 1);
    const xFin = xIni + PASO * (tareas.length + 1);
    const xS = xFin + COL;
    const xC = xS + COL;
    const ancho = xC + 120;

    // Eje central
    const estadoLote = grafo.estado_lote;
    nodos.ini = {
      id: "ini",
      x: xIni,
      y: centroY,
      radio: RADIO,
      tipo: "Ini",
      marca: "Ini",
      linea1: "Inicio",
      linea2: truncar(nodoLote?.subtitulo ?? `Lote ${grafo.numero_lote}`, 20),
      tooltip: `Inicio de elaboración · Lote ${grafo.numero_lote}`,
      paleta: PALETAS.elaboracion,
      grafo: nodoLote,
    };
    let previo = "ini";
    tareas.forEach((t, i) => {
      const id = `paso_${i}`;
      const completa = t.estado === "completado";
      nodos[id] = {
        id,
        x: xPaso(i),
        y: centroY,
        radio: RADIO,
        tipo: "Paso",
        marca: String(i + 1),
        linea1: truncar(t.titulo, 20),
        linea2: completa ? (t.tiene_desvio ? "Con desperdicio" : "Completada") : "Pendiente",
        tooltip: t.titulo,
        paleta: completa ? (t.tiene_desvio ? PALETAS.pendiente : PALETAS.completo) : PALETAS.pendiente,
        tarea: t,
      };
      conectar(previo, id, curvaHorizontal(nodos[previo].x + RADIO, centroY, xPaso(i) - RADIO, centroY));
      previo = id;
    });
    const terminado = estadoLote === "terminado";
    const unidadLote = nodoLote?.metadatos.unidad;
    nodos.fin = {
      id: "fin",
      x: xFin,
      y: centroY,
      radio: RADIO + 2,
      tipo: "Fin",
      marca: terminado ? "✓" : estadoLote === "cancelado" ? "✕" : "…",
      linea1: terminado ? "Lote cerrado" : estadoLote === "cancelado" ? "Lote cancelado" : "Sin cerrar",
      linea2: nodoLote?.metadatos.producido
        ? `${cantidadConUnidad(nodoLote.metadatos.producido, unidadLote)} producidos`
        : "Sin cantidad producida",
      tooltip: `${grafo.producto_nombre} · Lote ${grafo.numero_lote}`,
      paleta: terminado ? PALETAS.completo : estadoLote === "cancelado" ? PALETAS.cancelado : PALETAS.pendiente,
      grafo: nodoLote,
      tarea: cierre,
    };
    conectar(previo, "fin", curvaHorizontal(nodos[previo].x + RADIO, centroY, xFin - RADIO - 2, centroY));

    // Lotes de insumo
    const yInsumo = columna(lotesInsumo.length);
    lotesInsumo.forEach(({ li, pasos }, i) => {
      const y = yInsumo + i * ESPACIADO_Y;
      nodos[li.id] = {
        id: li.id,
        x: xL,
        y,
        radio: RADIO,
        tipo: "L",
        marca: "L",
        linea1: truncar(li.titulo, 20),
        linea2: truncar(li.metadatos.numero_lote ?? li.subtitulo, 20),
        tooltip: `${li.titulo} · ${li.subtitulo ?? ""}`,
        paleta: PALETAS.insumo,
        grafo: li,
      };
      const destinos = pasos.length > 0 ? [...new Set(pasos)].map((p) => `paso_${p}`) : ["ini"];
      let primera: string | null = null;
      destinos.forEach((destino) => {
        const n = nodos[destino];
        const x1 = xL + RADIO;
        let d: string;
        if (Math.abs(y - centroY) < RADIO * 1.5) {
          d = curvaHorizontal(x1, y, n.x - n.radio, centroY);
        } else if (destino === "ini") {
          d = curvaHorizontal(x1, y, n.x - n.radio, centroY);
        } else {
          d = curvaHaciaEje(x1, y, n.x, y < centroY ? centroY - n.radio : centroY + n.radio);
        }
        const id = conectar(li.id, destino, d);
        primera ??= id;
      });
      // Lo que salió de ese lote de insumo hacia este lote (consumo + desperdicio).
      if (primera && li.metadatos.cantidad_usada !== undefined) {
        const total = Number(li.metadatos.cantidad_usada) + Number(li.metadatos.cantidad_desperdicio ?? 0);
        const texto = cantidadConUnidad(total, li.metadatos.unidad);
        pastillas.push({ id: `p_${li.id}`, aristaId: primera, x: xL + RADIO + 10, y, alinear: "inicio", texto });
      }
    });

    // Proveedores: a la altura promedio de sus lotes, sin pisarse
    const provOrdenados = proveedores
      .map((p) => {
        const hijos = lotesInsumo.filter((l) => l.proveedorId === p.id).map((l) => nodos[l.li.id].y);
        const deseada = hijos.length ? hijos.reduce((a, b) => a + b, 0) / hijos.length : centroY;
        return { p, deseada };
      })
      .sort((a, b) => a.deseada - b.deseada);
    const yProv = repartir(provOrdenados.map((x) => x.deseada), minY, maxY);
    provOrdenados.forEach(({ p }, i) => {
      nodos[p.id] = {
        id: p.id,
        x: xP,
        y: yProv[i],
        radio: RADIO,
        tipo: "P",
        marca: "P",
        linea1: truncar(p.titulo, 20),
        linea2: p.badge ?? "Sin certificación",
        tooltip: p.titulo,
        paleta: PALETAS.proveedor,
        grafo: p,
      };
    });
    lotesInsumo.forEach(({ li, proveedorId }) => {
      if (!proveedorId || !nodos[proveedorId]) return;
      const p = nodos[proveedorId];
      conectar(proveedorId, li.id, curvaHorizontal(p.x + RADIO, p.y, xL - RADIO, nodos[li.id].y));
    });

    // Salidas
    const ySalida = columna(salidas.length);
    salidas.forEach(({ s }, i) => {
      const y = ySalida + i * ESPACIADO_Y;
      const estado = s.metadatos.estado_salida ?? s.badge;
      nodos[s.id] = {
        id: s.id,
        x: xS,
        y,
        radio: RADIO,
        tipo: "S",
        marca: "S",
        linea1: s.titulo,
        linea2: etiquetaEstadoSalida(estado),
        tooltip: `${s.titulo} · ${s.subtitulo ?? ""}`,
        paleta: estado === "RECHAZADA" ? PALETAS.cancelado : PALETAS.salida,
        grafo: s,
      };
      const arista = conectar("fin", s.id, curvaHorizontal(xFin + RADIO + 2, centroY, xS - RADIO, y));
      const texto = cantidadConUnidad(s.metadatos.cantidad, s.metadatos.unidad);
      pastillas.push({ id: `p_${s.id}`, aristaId: arista, x: xS - RADIO - 10, y, alinear: "fin", texto });
    });

    // Clientes: a la altura promedio de sus salidas
    const cliOrdenados = clientes
      .map((c) => {
        const hijas = salidas.filter((s) => s.clienteId === c.id).map((s) => nodos[s.s.id].y);
        const deseada = hijas.length ? hijas.reduce((a, b) => a + b, 0) / hijas.length : centroY;
        return { c, deseada };
      })
      .sort((a, b) => a.deseada - b.deseada);
    const yCli = repartir(cliOrdenados.map((x) => x.deseada), minY, maxY);
    cliOrdenados.forEach(({ c }, i) => {
      const cantidad = salidas.filter((s) => s.clienteId === c.id).length;
      nodos[c.id] = {
        id: c.id,
        x: xC,
        y: yCli[i],
        radio: RADIO,
        tipo: "C",
        marca: "C",
        linea1: truncar(c.titulo, 20),
        linea2: cantidad === 1 ? "1 salida" : `${cantidad} salidas`,
        tooltip: c.titulo,
        paleta: PALETAS.cliente,
        grafo: c,
      };
    });
    salidas.forEach(({ s, clienteId }) => {
      if (!clienteId || !nodos[clienteId]) return;
      const c = nodos[clienteId];
      conectar(s.id, clienteId, curvaHorizontal(xS + RADIO, nodos[s.id].y, c.x - RADIO, c.y));
    });

    return { nodos, aristas, pastillas, adelante, atras, ancho, alto };
  }, [grafo, timeline]);

  // Al elegir un nodo se iluminan todos sus ancestros y descendientes.
  const activos = useMemo(() => {
    if (!seleccionId) return null;
    const visto = new Set<string>([seleccionId]);
    for (const ady of [layout.atras, layout.adelante]) {
      const cola = [seleccionId];
      while (cola.length) {
        const actual = cola.shift()!;
        for (const vecino of ady[actual] ?? []) {
          if (!visto.has(vecino)) {
            visto.add(vecino);
            cola.push(vecino);
          }
        }
      }
    }
    return visto;
  }, [seleccionId, layout]);

  const nodoActivo = (id: string) => !activos || activos.has(id);
  const aristaActiva = (a: Arista) => !activos || (activos.has(a.origenId) && activos.has(a.destinoId));
  const resaltar = !!activos;
  const seleccionado = seleccionId ? layout.nodos[seleccionId] : null;
  const alternar = (id: string) => setSeleccionId((actual) => (actual === id ? null : id));
  const aristasPorId = new Map(layout.aristas.map((a) => [a.id, a]));

  return (
    <Box>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap="3" mb="3">
        <Box>
          <HStack gap="2">
            <Heading size="sm" color="fg">
              Árbol de trazabilidad
            </Heading>
            {seleccionId && (
              <Badge size="xs" colorPalette="blue" variant="solid">
                Filtro activo
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="fg.muted">
            Hacé clic en un nodo para ver de dónde viene, a dónde fue y sus datos.
          </Text>
        </Box>
        <HStack gap="3" flexWrap="wrap">
          {LEYENDA.map((l) => (
            <HStack key={l.texto} gap="1.5">
              <Box w="10px" h="10px" rounded="full" bg={l.color} />
              <Text fontSize="xs" color="fg.muted">
                {l.texto}
              </Text>
            </HStack>
          ))}
          {seleccionId && (
            <BotonCancelar size="xs" onClick={() => setSeleccionId(null)}>
              <LuRotateCcw /> Limpiar selección
            </BotonCancelar>
          )}
        </HStack>
      </HStack>

      <Box
        overflowX="auto"
        bg="bg.subtle"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="border.subtle"
        minH="200px"
        // Los tokens del tema con punto ("fg.muted", "bg.panel") no generan
        // `--chakra-colors-fg-muted`: el SVG usaba ese nombre a mano, no
        // existía y textos y pastillas salían negros en modo oscuro. El nombre
        // real de cada variable lo da el sistema de Chakra.
        style={{
          ["--traza-borde" as string]: system.token.var("colors.border.emphasized"),
        }}
      >
        {!timelineListo ? (
          <Text p="6" fontSize="sm" color="fg.muted">
            Armando el árbol…
          </Text>
        ) : (
          <svg
            width={layout.ancho}
            height={layout.alto}
            viewBox={`0 0 ${layout.ancho} ${layout.alto}`}
            style={{ display: "block" }}
            role="img"
            aria-label={`Árbol de trazabilidad del lote ${grafo.numero_lote}`}
          >
            <g>
              {layout.aristas.map((a) => {
                const activa = aristaActiva(a);
                return (
                  <path
                    key={a.id}
                    d={a.d}
                    fill="none"
                    stroke={activa && resaltar ? "#2563EB" : "var(--traza-borde)"}
                    strokeWidth={activa && resaltar ? 3 : 2}
                    strokeLinecap="round"
                    opacity={activa ? 1 : 0.18}
                    style={{ transition: "opacity 0.2s, stroke 0.2s" }}
                  />
                );
              })}
            </g>

            <g>
              {layout.pastillas.map((p) => {
                const arista = aristasPorId.get(p.aristaId);
                const activa = !arista || aristaActiva(arista);
                const { ancho, alto } = CAJA_PASTILLA;
                return (
                  <foreignObject
                    key={p.id}
                    x={p.alinear === "inicio" ? p.x : p.x - ancho}
                    y={p.y - alto / 2}
                    width={ancho}
                    height={alto}
                    opacity={activa ? 1 : 0.18}
                    style={{ pointerEvents: "none", userSelect: "none", overflow: "visible" }}
                  >
                    <Box
                      h="full"
                      display="flex"
                      alignItems="center"
                      justifyContent={p.alinear === "inicio" ? "flex-start" : "flex-end"}
                    >
                      <PastillaCantidad texto={p.texto} resaltada={activa && resaltar} />
                    </Box>
                  </foreignObject>
                );
              })}
            </g>

            <g>
              {Object.values(layout.nodos).map((n) => {
                const activo = nodoActivo(n.id);
                const elegido = seleccionId === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    opacity={activo ? 1 : 0.25}
                    cursor="pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${NOMBRE_TIPO[n.tipo]}: ${n.tooltip}`}
                    onClick={() => alternar(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        alternar(n.id);
                      }
                    }}
                    style={{ transition: "opacity 0.2s", outline: "none" }}
                  >
                    <title>{`${NOMBRE_TIPO[n.tipo]}: ${n.tooltip}`}</title>
                    {elegido && (
                      <circle r={n.radio + 7} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeDasharray="4 2" />
                    )}
                    <circle
                      r={n.radio}
                      fill={n.paleta.bg}
                      stroke={elegido ? "#2563EB" : n.paleta.borde}
                      strokeWidth={elegido ? 3 : 2}
                    />
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fill={n.paleta.texto}
                      fontSize="12"
                      fontWeight="bold"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {n.marca}
                    </text>
                    {/* Globo con el nombre y el detalle, separado del círculo y de las líneas. */}
                    <foreignObject
                      x={-CAJA_GLOBO.ancho / 2}
                      y={n.radio + 6}
                      width={CAJA_GLOBO.ancho}
                      height={CAJA_GLOBO.alto}
                      style={{ pointerEvents: "none", userSelect: "none", overflow: "visible" }}
                    >
                      <Box display="flex" justifyContent="center" alignItems="flex-start">
                        <Globo titulo={n.linea1} detalle={n.linea2} elegido={elegido} />
                      </Box>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </Box>

      <Box mt="4">
        {seleccionado ? (
          <FichaNodo
            nodo={seleccionado}
            grafo={grafo}
            onCerrar={() => setSeleccionId(null)}
            onIr={(ruta) => navigate(ruta)}
          />
        ) : (
          <Text fontSize="xs" color="fg.muted" textAlign="center">
            Elegí un proveedor, lote de insumo, etapa, salida o cliente para ver su recorrido y sus datos.
          </Text>
        )}
      </Box>
    </Box>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <Box minW="0">
      <Text fontSize="xs" color="fg.muted" fontWeight="semibold">
        {etiqueta}
      </Text>
      <Box fontSize="sm" fontWeight="medium" overflowWrap="anywhere">
        {children}
      </Box>
    </Box>
  );
}

/** A dónde lleva "Ver detalle" según el tipo de nodo. Proveedores solo tienen pantalla de edición. */
function accionDetalle(
  nodo: NodoDibujo,
  grafo: GrafoTrazabilidadResponse,
): { texto: string; ruta: string } | null {
  const m = nodo.grafo?.metadatos ?? {};
  switch (nodo.tipo) {
    case "P":
      return m.id ? { texto: "Ver proveedor", ruta: `/proveedores/${m.id}/editar` } : null;
    case "L":
      return m.lote_insumo_id
        ? { texto: "Ver lote de insumo", ruta: `/trazabilidad/lotes-insumo/${m.lote_insumo_id}` }
        : null;
    case "Ini":
    case "Paso":
    case "Fin":
      return { texto: "Ver lote de producción", ruta: `/lotes/${grafo.lote_id}` };
    case "S":
      return m.salida_id ? { texto: "Ver salida", ruta: `/salidas/${m.salida_id}/detalle` } : null;
    case "C":
      return m.cliente_id ? { texto: "Ver cliente", ruta: `/clientes/${m.cliente_id}/detalle` } : null;
  }
}

function FichaNodo({
  nodo,
  grafo,
  onCerrar,
  onIr,
}: {
  nodo: NodoDibujo;
  grafo: GrafoTrazabilidadResponse;
  onCerrar: () => void;
  onIr: (ruta: string) => void;
}) {
  const g = nodo.grafo;
  const m = g?.metadatos ?? {};
  const tarea = nodo.tarea;
  let titulo = g?.titulo ?? tarea?.titulo ?? "";
  let subtitulo = g?.subtitulo ?? null;
  let contenido: ReactNode = null;

  switch (nodo.tipo) {
    case "P":
      contenido = (
        <>
          <Dato etiqueta="Razón social">{g?.titulo}</Dato>
          <Dato etiqueta="Matrícula (RNE/RPE)">{m.matricula || "-"}</Dato>
          <Dato etiqueta="CUIT">{m.cuit || "-"}</Dato>
          <Dato etiqueta="Estado">
            {m.es_certificado ? "Con certificación requerida" : "Sin certificación requerida"}
            {" · "}
            {m.activo === false ? "Dado de baja" : "Activo"}
          </Dato>
        </>
      );
      break;
    case "L": {
      const desperdicio = Number(m.cantidad_desperdicio ?? 0);
      contenido = (
        <>
          <Dato etiqueta="Ingrediente">{g?.titulo}</Dato>
          <Dato etiqueta="Marca">{m.marca || "-"}</Dato>
          <Dato etiqueta="Lote del proveedor">{m.numero_lote || "-"}</Dato>
          <Dato etiqueta="Ingreso">{formatoFecha(m.fecha_ingreso)}</Dato>
          <Dato etiqueta="Vencimiento">{m.vence ? formatoFecha(m.vence) : "Sin vencimiento"}</Dato>
          <Dato etiqueta="Usado en este lote">{cantidadConUnidad(m.cantidad_usada, m.unidad)}</Dato>
          {desperdicio > 0 && <Dato etiqueta="Desperdicio">{cantidadConUnidad(desperdicio, m.unidad)}</Dato>}
        </>
      );
      break;
    }
    case "Ini":
      titulo = `Lote ${grafo.numero_lote}`;
      subtitulo = grafo.producto_nombre;
      contenido = (
        <>
          <Dato etiqueta="Producto">{grafo.producto_nombre}</Dato>
          <Dato etiqueta="Receta">{m.version_receta ? `Versión ${m.version_receta}` : "-"}</Dato>
          <Dato etiqueta="Inicio">{formatoFechaHora(m.inicio)}</Dato>
          <Dato etiqueta="Creado por">{m.operario || "-"}</Dato>
        </>
      );
      break;
    case "Paso": {
      const consumos = tarea?.detalle.ingredientes_consumidos ?? [];
      const desperdicios = tarea?.detalle.desperdicios ?? [];
      subtitulo = nodo.linea2;
      contenido = (
        <>
          <Dato etiqueta="Etapa">{tarea?.titulo}</Dato>
          <Dato etiqueta="Completada por">{tarea?.detalle.operario_nombre || "-"}</Dato>
          <Dato etiqueta="Fecha">{tarea?.fecha_hora ? formatoFechaHora(tarea.fecha_hora) : "Pendiente"}</Dato>
          <Dato etiqueta="Desperdicio">
            {desperdicios.length === 0
              ? "Sin desperdicio registrado"
              : desperdicios.map((d, i) => (
                  <Text key={i}>
                    {cantidadConUnidad(d.cantidad, d.unidad_medida)}
                    {d.motivo ? ` · ${d.motivo}` : ""}
                  </Text>
                ))}
          </Dato>
          {consumos.length > 0 && (
            <Box gridColumn="1 / -1">
              <Dato etiqueta="Insumos consumidos">
                {consumos.map((c, i) => (
                  <Text key={i} fontWeight="normal">
                    {c.ingrediente_nombre} · lote {c.lote_insumo_codigo}: {cantidadConUnidad(c.cantidad, c.unidad_medida)}
                  </Text>
                ))}
              </Dato>
            </Box>
          )}
        </>
      );
      break;
    }
    case "Fin":
      titulo = `${grafo.producto_nombre} · Lote ${grafo.numero_lote}`;
      subtitulo = null;
      contenido = (
        <>
          <Dato etiqueta="Estado del lote">
            {g?.badge ? <EtiquetaEstado tono={(g.tono_badge ?? "neutro") as TonoEstado}>{g.badge}</EtiquetaEstado> : "-"}
          </Dato>
          <Dato etiqueta="Cantidad producida">
            {m.producido ? cantidadConUnidad(m.producido, m.unidad) : "Sin registrar"}
          </Dato>
          <Dato etiqueta="Cantidad objetivo">{cantidadConUnidad(m.objetivo, m.unidad)}</Dato>
          <Dato etiqueta="Vencimiento">{m.vencimiento ? formatoFecha(m.vencimiento) : "-"}</Dato>
          <Dato etiqueta="Cierre">{tarea?.fecha_hora ? formatoFechaHora(tarea.fecha_hora) : "-"}</Dato>
        </>
      );
      break;
    case "S": {
      const certificaciones = m.certificaciones_transportista ?? [];
      contenido = (
        <>
          <Dato etiqueta="Cantidad">{cantidadConUnidad(m.cantidad, m.unidad)}</Dato>
          <Dato etiqueta="Estado">
            <EtiquetaEstado tono={(g?.tono_badge ?? "neutro") as TonoEstado}>
              {etiquetaEstadoSalida(m.estado_salida)}
            </EtiquetaEstado>
          </Dato>
          <Dato etiqueta="Entrega">{FORMA_ENTREGA[m.forma_entrega ?? ""] ?? m.forma_entrega ?? "-"}</Dato>
          <Dato etiqueta="Transportista">
            {m.transportista || "-"}
            {certificaciones.length > 0 && (
              <Text fontSize="xs" color="fg.muted" fontWeight="normal">
                Certificaciones: {certificaciones.join(", ")}
              </Text>
            )}
          </Dato>
          <Dato etiqueta="Reserva">{formatoFecha(m.fecha_reserva)}</Dato>
          <Dato etiqueta="Despacho">{formatoFecha(m.fecha_despacho)}</Dato>
          <Dato etiqueta="Entrega">{formatoFecha(m.fecha_entrega)}</Dato>
          <Dato etiqueta="Recibido por">{m.recibido_por || "-"}</Dato>
        </>
      );
      break;
    }
    case "C": {
      const salidas = grafo.nodos.filter(
        (n) => n.columna === "despacho" && n.metadatos.cliente_id === m.cliente_id,
      );
      contenido = (
        <>
          <Dato etiqueta="Cliente">{g?.titulo}</Dato>
          <Dato etiqueta="CUIT / DNI">{m.documento || "-"}</Dato>
          <Dato etiqueta="Domicilio">{m.direccion || "-"}</Dato>
          <Dato etiqueta="Salidas de este lote">
            {salidas.map((s) => (
              <Text key={s.id} fontWeight="normal">
                {s.titulo}: {cantidadConUnidad(s.metadatos.cantidad, s.metadatos.unidad)} ·{" "}
                {etiquetaEstadoSalida(s.metadatos.estado_salida)}
              </Text>
            ))}
          </Dato>
        </>
      );
      break;
    }
  }

  const accion = accionDetalle(nodo, grafo);

  return (
    <Tarjeta p="5">
      <Stack gap="4">
        <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="2">
          <HStack gap="3" minW="0">
            <Box
              flexShrink={0}
              w="40px"
              h="40px"
              rounded="full"
              bg={nodo.paleta.bg}
              borderWidth="2px"
              borderColor={nodo.paleta.borde}
              color={nodo.paleta.texto}
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontWeight="bold"
            >
              {nodo.marca}
            </Box>
            <Box minW="0">
              <HStack gap="2" flexWrap="wrap">
                <Heading size="sm" color="fg">
                  {titulo}
                </Heading>
                <Badge size="xs" colorPalette="blue" variant="subtle">
                  {NOMBRE_TIPO[nodo.tipo]}
                </Badge>
              </HStack>
              {subtitulo && (
                <Text fontSize="xs" color="fg.muted">
                  {subtitulo}
                </Text>
              )}
            </Box>
          </HStack>
          <HStack gap="2">
            {accion && (
              <Button size="xs" variant="outline" onClick={() => onIr(accion.ruta)}>
                {accion.texto} <LuArrowRight />
              </Button>
            )}
            <BotonCancelar size="xs" onClick={onCerrar}>
              <LuX /> Cerrar
            </BotonCancelar>
          </HStack>
        </HStack>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4" bg="bg.muted" p="4" rounded="md">
          {contenido}
        </SimpleGrid>
      </Stack>
    </Tarjeta>
  );
}
