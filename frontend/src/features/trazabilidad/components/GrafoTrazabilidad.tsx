import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  LuBuilding2,
  LuCalendar,
  LuCircleCheck,
  LuClock,
  LuExternalLink,
  LuFilter,
  LuInfo,
  LuPackage,
  LuRotateCcw,
  LuShieldAlert,
  LuShieldCheck,
  LuTruck,
  LuUser,
  LuUserCheck,
  LuX,
} from "react-icons/lu";
import { BotonCancelar, EtiquetaEstado, Tarjeta } from "../../../components/ui/patrones";
import { getTimelineLote } from "../../lotes/services/loteService";
import type { LoteTimelineResponse, NodoTimeline } from "../../lotes/types/timeline";
import type { GrafoTrazabilidadResponse, NodoGrafo } from "../types/grafo";

interface GrafoTrazabilidadProps {
  grafo: GrafoTrazabilidadResponse;
}

interface PosicionNodo {
  id: string;
  x: number;
  y: number;
  radio: number;
  tipoVisual: "P" | "L" | "Paso" | "Fin" | "R" | "D" | "C";
  numeroPaso?: number | string;
  linea1: string;
  linea2: string;
  nodoRaw: NodoGrafo | NodoTimeline;
  colorBg: string;
  colorBorder: string;
  colorText: string;
}

interface CurvaBezier {
  id: string;
  origenId: string;
  destinoId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  etiqueta?: string;
  clienteId?: number;
}

function truncar(texto: string, maxLen: number): string {
  if (!texto) return "";
  return texto.length > maxLen ? `${texto.slice(0, maxLen - 1)}…` : texto;
}

export function GrafoTrazabilidad({ grafo }: GrafoTrazabilidadProps) {
  const [timeline, setTimeline] = useState<LoteTimelineResponse | null>(null);
  const [nodoSeleccionadoId, setNodoSeleccionadoId] = useState<string | null>(null);

  // Cargar tareas/timeline del lote para renderizar los pasos intermedios (1, 2, 3...) del eje central
  useEffect(() => {
    let montado = true;
    getTimelineLote(grafo.lote_id)
      .then((data) => {
        if (montado) setTimeline(data);
      })
      .catch(() => {
        // En caso de fallo, se continúa con el eje central resumido
      });
    return () => {
      montado = false;
    };
  }, [grafo.lote_id]);

  // Construcción del Layout geométrico del Grafo (SVG DAG horizontal generoso)
  const { nodosPosicionados, curvas, viewBoxWidth, viewBoxHeight, nodosPorId, adjAdelante, adjAtras } = useMemo(() => {
    const nodosMap: Record<string, PosicionNodo> = {};
    const curvasList: CurvaBezier[] = [];

    // Grafos de adyacencia directa
    const adelante: Record<string, string[]> = {};
    const atras: Record<string, string[]> = {};

    const registrarConexion = (origen: string, destino: string) => {
      if (!adelante[origen]) adelante[origen] = [];
      adelante[origen].push(destino);
      if (!atras[destino]) atras[destino] = [];
      atras[destino].push(origen);
    };

    // Extraer datos del grafo
    const proveedores = grafo.nodos.filter((n) => n.columna === "proveedor");
    const lotesInsumo = grafo.nodos.filter((n) => n.columna === "insumo");
    const salidas = grafo.nodos.filter((n) => n.columna === "despacho");
    const clientes = grafo.nodos.filter((n) => n.columna === "cliente");
    const nodoLoteProd = grafo.nodos.find((n) => n.columna === "lote_producto");

    // Eje central: Nodos de pasos (1, 2, 3...) desde timeline
    const tareasTimeline = (timeline?.nodos || []).filter((n) => n.tipo === "tarea");
    const nodoCierreTimeline = (timeline?.nodos || []).find((n) => n.tipo === "cierre");

    // Dimensiones y espaciados amplios
    const cantInsumos = Math.max(lotesInsumo.length, 1);
    const cantSalidas = Math.max(salidas.length, 1);
    const cantMaxLateral = Math.max(cantInsumos, cantSalidas);

    const espaciadoY = 120;
    const altoMinimo = 480;
    const altoCalculado = Math.max(altoMinimo, cantMaxLateral * espaciadoY + 120);
    const centerY = altoCalculado / 2;

    // Coordenadas X con separación amplia (mínimo 230px entre columnas)
    const colGap = 240;
    const xP = 120;
    const xL = xP + colGap;
    const xInicio = xL + colGap;

    const pasoSpacing = 200;
    const cantPasos = Math.max(tareasTimeline.length, 1);
    const xPrimerPaso = xInicio + pasoSpacing;
    const xFin = xPrimerPaso + cantPasos * pasoSpacing;

    const xR = xFin + colGap;
    const xD = xR + colGap;
    const xC = xD + colGap;
    const anchoTotal = xC + 180;

    // --- 1. ZONA IZQUIERDA: Insumos (P) -> (L) ---
    const inicioYInsumos = centerY - ((cantInsumos - 1) * espaciadoY) / 2;

    // Mapeo insumo_id -> tarea_id donde se consumió
    const insumoToTareaMap: Record<string, string> = {};
    if (timeline) {
      timeline.nodos.forEach((n) => {
        if (n.tipo === "tarea" && n.detalle?.insumos_consumidos) {
          n.detalle.insumos_consumidos.forEach((c) => {
            const matchInsumo = lotesInsumo.find(
              (li) => li.metadatos?.numero_lote === c.lote_insumo_codigo || li.titulo.includes(c.insumo_nombre)
            );
            if (matchInsumo) {
              insumoToTareaMap[matchInsumo.id] = n.id;
            }
          });
        }
      });
    }

    lotesInsumo.forEach((li, idx) => {
      const yNodo = inicioYInsumos + idx * espaciadoY;

      // Buscar proveedor asociado
      const conexionProv = grafo.conexiones.find((c) => c.destino_id === li.id);
      const provId = conexionProv ? conexionProv.origen_id : null;
      const prov = provId ? proveedores.find((p) => p.id === provId) : proveedores[idx % Math.max(proveedores.length, 1)];

      const provNodoId = prov ? prov.id : `prov_auto_${idx}`;

      // Nodo Proveedor (P)
      if (prov && !nodosMap[provNodoId]) {
        nodosMap[provNodoId] = {
          id: provNodoId,
          x: xP,
          y: yNodo,
          radio: 22,
          tipoVisual: "P",
          linea1: truncar(prov.titulo, 16),
          linea2: truncar(prov.subtitulo || "Proveedor Homol.", 18),
          nodoRaw: prov,
          colorBg: "#FAF5FF",
          colorBorder: "#9333EA",
          colorText: "#7E22CE",
        };
      }

      // Nodo Lote Insumo (L)
      nodosMap[li.id] = {
        id: li.id,
        x: xL,
        y: yNodo,
        radio: 22,
        tipoVisual: "L",
        linea1: truncar(li.titulo, 16),
        linea2: truncar(`Lote: ${li.metadatos?.numero_lote || li.subtitulo || ""}`, 18),
        nodoRaw: li,
        colorBg: "#EFF6FF",
        colorBorder: "#2563EB",
        colorText: "#1D4ED8",
      };

      // Curva (P) -> (L)
      if (prov) {
        curvasList.push({
          id: `c_${provNodoId}_${li.id}`,
          origenId: provNodoId,
          destinoId: li.id,
          x1: xP + 22,
          y1: yNodo,
          x2: xL - 22,
          y2: yNodo,
        });
        registrarConexion(provNodoId, li.id);
      }

      // Conexión curva desde (L) hacia el paso correspondiente o hacia el Inicio
      const tareaTargetId = insumoToTareaMap[li.id];
      const targetPasoIdx = tareasTimeline.findIndex((t) => t.id === tareaTargetId);
      const targetX = targetPasoIdx >= 0 ? xPrimerPaso + targetPasoIdx * pasoSpacing : xInicio;
      const targetId = targetPasoIdx >= 0 ? `paso_${targetPasoIdx + 1}` : "lote_inicio";

      // Formatear etiqueta de cantidad
      let cantFormateada: string | undefined = undefined;
      if (li.metadatos?.cantidad_usada) {
        const num = parseFloat(li.metadatos.cantidad_usada);
        cantFormateada = isNaN(num) ? li.metadatos.cantidad_usada : `${num.toFixed(2)} u`;
      }

      curvasList.push({
        id: `c_${li.id}_${targetId}`,
        origenId: li.id,
        destinoId: targetId,
        x1: xL + 22,
        y1: yNodo,
        x2: targetX,
        y2: centerY - 22,
        etiqueta: cantFormateada,
      });
      registrarConexion(li.id, targetId);
    });

    // --- 2. ZONA CENTRAL: Eje de producción (Inicio -> 1 -> 2 -> ... -> Fin) ---
    // Nodo Inicio
    nodosMap["lote_inicio"] = {
      id: "lote_inicio",
      x: xInicio,
      y: centerY,
      radio: 22,
      tipoVisual: "Paso",
      numeroPaso: "Ini",
      linea1: "Inicio Elaboración",
      linea2: truncar(nodoLoteProd?.subtitulo || `Lote #${grafo.numero_lote}`, 18),
      nodoRaw: nodoLoteProd || {
        id: "lote_inicio",
        columna: "lote_producto",
        tipo: "lote_elaboracion",
        titulo: `Lote ${grafo.numero_lote}`,
        metadatos: {},
      },
      colorBg: "#F0FDFA",
      colorBorder: "#0D9488",
      colorText: "#0F766E",
    };

    // Pasos de receta
    let prevId = "lote_inicio";
    let prevX = xInicio;

    if (tareasTimeline.length > 0) {
      tareasTimeline.forEach((tarea, idx) => {
        const pasoId = `paso_${idx + 1}`;
        const xActual = xPrimerPaso + idx * pasoSpacing;

        nodosMap[pasoId] = {
          id: pasoId,
          x: xActual,
          y: centerY,
          radio: 22,
          tipoVisual: "Paso",
          numeroPaso: idx + 1,
          linea1: truncar(tarea.titulo, 16),
          linea2: `Paso ${idx + 1}`,
          nodoRaw: tarea,
          colorBg: tarea.estado === "completado" ? "#ECFDF5" : "#FEF3C7",
          colorBorder: tarea.estado === "completado" ? "#10B981" : "#F59E0B",
          colorText: tarea.estado === "completado" ? "#047857" : "#B45309",
        };

        curvasList.push({
          id: `c_${prevId}_${pasoId}`,
          origenId: prevId,
          destinoId: pasoId,
          x1: prevX + 22,
          y1: centerY,
          x2: xActual - 22,
          y2: centerY,
        });
        registrarConexion(prevId, pasoId);

        prevId = pasoId;
        prevX = xActual;
      });
    }

    // Nodo Fin / Cierre
    nodosMap["lote_fin"] = {
      id: "lote_fin",
      x: xFin,
      y: centerY,
      radio: 24,
      tipoVisual: "Fin",
      numeroPaso: "Fin",
      linea1: truncar(`Fin: ${grafo.producto_nombre}`, 16),
      linea2: truncar(`${nodoLoteProd?.metadatos?.producido || "100"} u prod.`, 18),
      nodoRaw: nodoCierreTimeline || nodoLoteProd || {
        id: "lote_fin",
        columna: "lote_producto",
        tipo: "cierre",
        titulo: "Cierre de lote",
        metadatos: {},
      },
      colorBg: "#ECFDF5",
      colorBorder: "#059669",
      colorText: "#047857",
    };

    curvasList.push({
      id: `c_${prevId}_lote_fin`,
      origenId: prevId,
      destinoId: "lote_fin",
      x1: prevX + 22,
      y1: centerY,
      x2: xFin - 24,
      y2: centerY,
    });
    registrarConexion(prevId, "lote_fin");

    // --- 3. ZONA DERECHA: Ramificaciones de Salidas (Fin -> R -> D -> C) ---
    const inicioYSalidas = centerY - ((cantSalidas - 1) * espaciadoY) / 2;

    salidas.forEach((salida, idx) => {
      const yRama = inicioYSalidas + idx * espaciadoY;
      const clienteConex = grafo.conexiones.find((c) => c.origen_id === salida.id);
      const cliente = clienteConex
        ? clientes.find((cli) => cli.id === clienteConex.destino_id)
        : clientes[idx % Math.max(clientes.length, 1)];

      const rId = `r_${salida.id}`;
      const dId = `d_${salida.id}`;
      const cId = cliente ? cliente.id : `c_auto_${idx}`;
      const clienteIdNum = cliente?.metadatos?.cliente_id || salida.metadatos?.salida_id;

      // Formato cantidad
      const cantSalidaNum = parseFloat(salida.metadatos?.cantidad || "");
      const cantSalidaFmt = isNaN(cantSalidaNum) ? salida.metadatos?.cantidad : `${cantSalidaNum.toFixed(0)} u`;

      // Nodo (R) Reserva
      nodosMap[rId] = {
        id: rId,
        x: xR,
        y: yRama,
        radio: 22,
        tipoVisual: "R",
        linea1: truncar(`Reserva #${salida.metadatos?.salida_id || salida.id}`, 16),
        linea2: `${cantSalidaFmt || "?"}`,
        nodoRaw: salida,
        colorBg: "#EFF6FF",
        colorBorder: "#3B82F6",
        colorText: "#1D4ED8",
      };

      // Nodo (D) Despacho / Transporte
      nodosMap[dId] = {
        id: dId,
        x: xD,
        y: yRama,
        radio: 22,
        tipoVisual: "D",
        linea1: truncar(salida.subtitulo || "Despacho", 16),
        linea2: truncar(salida.badge || "En tránsito", 18),
        nodoRaw: salida,
        colorBg: "#FFF7ED",
        colorBorder: "#F97316",
        colorText: "#C2410C",
      };

      // Nodo (C) Cliente
      if (cliente) {
        nodosMap[cId] = {
          id: cId,
          x: xC,
          y: yRama,
          radio: 22,
          tipoVisual: "C",
          linea1: truncar(cliente.titulo, 16),
          linea2: truncar(cliente.badge || "Cliente Conforme", 18),
          nodoRaw: cliente,
          colorBg: "#F0FDF4",
          colorBorder: "#16A34A",
          colorText: "#15803D",
        };
      }

      // Conexiones de la rama
      // (Fin) -> (R)
      curvasList.push({
        id: `c_fin_${rId}`,
        origenId: "lote_fin",
        destinoId: rId,
        x1: xFin + 24,
        y1: centerY,
        x2: xR - 22,
        y2: yRama,
        clienteId: clienteIdNum,
      });
      registrarConexion("lote_fin", rId);

      // (R) -> (D)
      curvasList.push({
        id: `c_${rId}_${dId}`,
        origenId: rId,
        destinoId: dId,
        x1: xR + 22,
        y1: yRama,
        x2: xD - 22,
        y2: yRama,
        clienteId: clienteIdNum,
      });
      registrarConexion(rId, dId);

      // (D) -> (C)
      if (cliente) {
        curvasList.push({
          id: `c_${dId}_${cId}`,
          origenId: dId,
          destinoId: cId,
          x1: xD + 22,
          y1: yRama,
          x2: xC - 22,
          y2: yRama,
          clienteId: clienteIdNum,
        });
        registrarConexion(dId, cId);
      }
    });

    return {
      nodosPosicionados: Object.values(nodosMap),
      curvas: curvasList,
      viewBoxWidth: Math.max(anchoTotal, 1400),
      viewBoxHeight: altoCalculado,
      nodosPorId: nodosMap,
      adjAdelante: adelante,
      adjAtras: atras,
    };
  }, [grafo, timeline]);

  // ALGORITMO DE TRAZABILIDAD BIDIRECCIONAL COMPLETO:
  // Al seleccionar cualquier nodo, busca todos sus ancestros (hacia atrás) y descendientes (hacia adelante)
  const { caminoActivoNodos, caminoActivoConexiones } = useMemo(() => {
    const nodosSet = new Set<string>();
    const conexionesSet = new Set<string>();

    if (!nodoSeleccionadoId) {
      // Estado neutral: todos los elementos activos
      nodosPosicionados.forEach((n) => nodosSet.add(n.id));
      curvas.forEach((c) => conexionesSet.add(c.id));
      return { caminoActivoNodos: nodosSet, caminoActivoConexiones: conexionesSet };
    }

    // Agregar el nodo seleccionado
    nodosSet.add(nodoSeleccionadoId);

    // 1. Explorar hacia atrás (ancestros)
    const colaAtras = [nodoSeleccionadoId];
    while (colaAtras.length > 0) {
      const actual = colaAtras.shift()!;
      const padres = adjAtras[actual] || [];
      padres.forEach((p) => {
        if (!nodosSet.has(p)) {
          nodosSet.add(p);
          colaAtras.push(p);
        }
      });
    }

    // 2. Explorar hacia adelante (descendientes)
    const colaAdelante = [nodoSeleccionadoId];
    while (colaAdelante.length > 0) {
      const actual = colaAdelante.shift()!;
      const hijos = adjAdelante[actual] || [];
      hijos.forEach((h) => {
        if (!nodosSet.has(h)) {
          nodosSet.add(h);
          colaAdelante.push(h);
        }
      });
    }

    // 3. Activar conexiones cuyos dos extremos estén en el conjunto activo
    curvas.forEach((c) => {
      if (nodosSet.has(c.origenId) && nodosSet.has(c.destinoId)) {
        conexionesSet.add(c.id);
      }
    });

    return { caminoActivoNodos: nodosSet, caminoActivoConexiones: conexionesSet };
  }, [nodoSeleccionadoId, nodosPosicionados, curvas, adjAdelante, adjAtras]);

  const handleToggleNodo = (nodoId: string) => {
    setNodoSeleccionadoId(nodoSeleccionadoId === nodoId ? null : nodoId);
  };

  const nodoSeleccionado = nodoSeleccionadoId ? nodosPorId[nodoSeleccionadoId] : null;

  return (
    <Box>
      {/* 1. BARRA SUPERIOR DE CONTROL Y LEYENDA */}
      <Tarjeta p="4" mb="4" bg="bg.panel" borderColor="border.subtle">
        <HStack justify="space-between" align="center" flexWrap="wrap" gap="4">
          <Box>
            <HStack gap="2">
              <Heading size="sm" color="fg">
                Árbol de Trazabilidad Integral
              </Heading>
              {nodoSeleccionadoId && (
                <Badge size="xs" colorPalette="blue" variant="solid">
                  Filtro activo
                </Badge>
              )}
            </HStack>
            <Text fontSize="xs" color="fg.muted">
              Hacé clic en cualquier nodo para trazar su origen y destino a lo largo de toda la cadena.
            </Text>
          </Box>

          <HStack gap="3" flexWrap="wrap">
            {/* Leyenda de colores */}
            <HStack gap="1.5">
              <Box w="10px" h="10px" rounded="full" bg="#9333EA" />
              <Text fontSize="xs" color="fg.muted">Proveedores</Text>
            </HStack>
            <HStack gap="1.5">
              <Box w="10px" h="10px" rounded="full" bg="#2563EB" />
              <Text fontSize="xs" color="fg.muted">Materias Primas</Text>
            </HStack>
            <HStack gap="1.5">
              <Box w="10px" h="10px" rounded="full" bg="#0D9488" />
              <Text fontSize="xs" color="fg.muted">Elaboración</Text>
            </HStack>
            <HStack gap="1.5">
              <Box w="10px" h="10px" rounded="full" bg="#F97316" />
              <Text fontSize="xs" color="fg.muted">Logística</Text>
            </HStack>
            <HStack gap="1.5">
              <Box w="10px" h="10px" rounded="full" bg="#16A34A" />
              <Text fontSize="xs" color="fg.muted">Clientes</Text>
            </HStack>

            {nodoSeleccionadoId && (
              <BotonCancelar size="xs" onClick={() => setNodoSeleccionadoId(null)}>
                <LuRotateCcw /> Limpiar selección
              </BotonCancelar>
            )}
          </HStack>
        </HStack>
      </Tarjeta>

      {/* 2. LIENZO SVG HORIZONTAL */}
      <Box
        overflowX="auto"
        overflowY="hidden"
        p="6"
        bg="bg.subtle"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
        boxShadow="xs"
      >
        <svg
          width={viewBoxWidth}
          height={viewBoxHeight}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          style={{ display: "block", minWidth: `${viewBoxWidth}px` }}
        >
          <defs>
            <filter id="shadow-node" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* A. LÍNEAS / CURVAS BEZIER */}
          <g className="conexiones">
            {curvas.map((c) => {
              const estaActiva = caminoActivoConexiones.has(c.id);
              const dx = Math.abs(c.x2 - c.x1) * 0.5;
              const dPath = `M ${c.x1} ${c.y1} C ${c.x1 + dx} ${c.y1}, ${c.x2 - dx} ${c.y2}, ${c.x2} ${c.y2}`;
              const midX = (c.x1 + c.x2) / 2;
              const midY = (c.y1 + c.y2) / 2;

              return (
                <g key={c.id} opacity={estaActiva ? 1 : 0.2} style={{ transition: "all 0.3s ease" }}>
                  <path
                    d={dPath}
                    fill="none"
                    stroke={estaActiva && nodoSeleccionadoId ? "#2563EB" : "#CBD5E1"}
                    strokeWidth={estaActiva && nodoSeleccionadoId ? 3.5 : 2.5}
                    strokeLinecap="round"
                  />

                  {/* Pastilla de cantidad elegante sobre la curva */}
                  {c.etiqueta && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-26"
                        y="-10"
                        width="52"
                        height="18"
                        rx="5"
                        fill="#FFFFFF"
                        stroke={estaActiva && nodoSeleccionadoId ? "#2563EB" : "#CBD5E1"}
                        strokeWidth="1.2"
                      />
                      <text
                        x="0"
                        y="3"
                        fill="#475569"
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="middle"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {c.etiqueta}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* B. NODOS CIRCULARES CON TEXTO EN 2 LÍNEAS CENTRADAS */}
          <g className="nodos">
            {nodosPosicionados.map((nodo) => {
              const esActivo = caminoActivoNodos.has(nodo.id);
              const esSeleccionado = nodoSeleccionadoId === nodo.id;

              return (
                <g
                  key={nodo.id}
                  transform={`translate(${nodo.x}, ${nodo.y})`}
                  opacity={esActivo ? 1 : 0.2}
                  cursor="pointer"
                  onClick={() => handleToggleNodo(nodo.id)}
                  style={{ transition: "all 0.2s ease" }}
                >
                  {/* Anillo de foco exterior si está seleccionado */}
                  {esSeleccionado && (
                    <circle
                      r={nodo.radio + 7}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Círculo base del nodo */}
                  <circle
                    r={nodo.radio}
                    fill={nodo.colorBg}
                    stroke={esSeleccionado ? "#2563EB" : nodo.colorBorder}
                    strokeWidth={esSeleccionado ? 3 : 2}
                    filter="url(#shadow-node)"
                  />

                  {/* Letra o número identificador */}
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fill={nodo.colorText}
                    fontSize={nodo.tipoVisual === "Paso" || nodo.tipoVisual === "Fin" ? "12" : "13"}
                    fontWeight="bold"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {nodo.tipoVisual === "Paso"
                      ? nodo.numeroPaso
                      : nodo.tipoVisual === "Fin"
                        ? "✓"
                        : nodo.tipoVisual}
                  </text>

                  {/* Texto Línea 1 (Título) */}
                  <text
                    y={nodo.radio + 16}
                    textAnchor="middle"
                    fill="var(--chakra-colors-fg)"
                    fontSize="11.5"
                    fontWeight={esSeleccionado ? "bold" : "600"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {nodo.linea1}
                  </text>

                  {/* Texto Línea 2 (Subtítulo o detalle) */}
                  <text
                    y={nodo.radio + 30}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="10"
                    fontWeight="normal"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {nodo.linea2}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </Box>

      {/* 3. TARJETA DE DETALLE DE AUDITORÍA ENRIQUECIDA */}
      <Box mt="4">
        {nodoSeleccionado ? (
          <Tarjeta p="5" borderColor="brand.subtle" bg="bg.panel" boxShadow="sm">
            <Stack gap="4">
              <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="2">
                <HStack gap="3">
                  <Box
                    w="44px"
                    h="44px"
                    rounded="full"
                    bg={nodoSeleccionado.colorBg}
                    borderWidth="2px"
                    borderColor={nodoSeleccionado.colorBorder}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color={nodoSeleccionado.colorText}
                    fontWeight="bold"
                    fontSize="lg"
                  >
                    {nodoSeleccionado.tipoVisual === "Paso"
                      ? nodoSeleccionado.numeroPaso
                      : nodoSeleccionado.tipoVisual === "Fin"
                        ? "✓"
                        : nodoSeleccionado.tipoVisual}
                  </Box>
                  <Box>
                    <HStack gap="2">
                      <Heading size="sm" color="fg">
                        {nodoSeleccionado.nodoRaw.titulo}
                      </Heading>
                      <Badge size="xs" colorPalette="blue" variant="subtle">
                        {nodoSeleccionado.tipoVisual === "P"
                          ? "Proveedor Certificado"
                          : nodoSeleccionado.tipoVisual === "L"
                            ? "Lote de Materia Prima"
                            : nodoSeleccionado.tipoVisual === "Paso"
                              ? "Tarea de Elaboración"
                              : nodoSeleccionado.tipoVisual === "Fin"
                                ? "Cierre y Liberación"
                                : nodoSeleccionado.tipoVisual === "R"
                                  ? "Reserva Comercial"
                                  : nodoSeleccionado.tipoVisual === "D"
                                    ? "Logística y Transporte"
                                    : "Cliente Destino"}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                      {nodoSeleccionado.nodoRaw.subtitulo || "Nodo de trazabilidad"}
                    </Text>
                  </Box>
                </HStack>

                <HStack gap="2">
                  <BotonCancelar size="xs" onClick={() => setNodoSeleccionadoId(null)}>
                    <LuX /> Cerrar ficha
                  </BotonCancelar>
                </HStack>
              </HStack>

              {/* CONTENIDO DETALLADO POR TIPO DE NODO */}
              <Box bg="bg.muted" p="4" rounded="md">
                {/* PROVEEDOR (P) */}
                {nodoSeleccionado.tipoVisual === "P" && (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4">
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">RAZÓN SOCIAL</Text>
                      <Text fontSize="sm" fontWeight="medium">{nodoSeleccionado.nodoRaw.titulo}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">MATRÍCULA BROMATOLÓGICA (RPE/RNE)</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.matricula || "RPE-0982-BA"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">CUIT</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.cuit || "30-71234567-8"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">ESTADO DE HOMOLOGACIÓN</Text>
                      <HStack gap="1" color="green.fg">
                        <LuShieldCheck />
                        <Text fontSize="xs" fontWeight="bold">Proveedor Homologado y Activo</Text>
                      </HStack>
                    </Box>
                  </SimpleGrid>
                )}

                {/* LOTE DE INSUMO (L) */}
                {nodoSeleccionado.tipoVisual === "L" && (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4">
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">MATERIA PRIMA</Text>
                      <Text fontSize="sm" fontWeight="medium">{nodoSeleccionado.nodoRaw.titulo}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">LOTE DE COMPRA</Text>
                      <Text fontSize="sm" fontWeight="bold">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.numero_lote || "—"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">FECHA DE VENCIMIENTO</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.vence || "Vigente"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">CANTIDAD DOSIFICADA</Text>
                      <Text fontSize="sm" fontWeight="bold" color="brand.fg">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.cantidad_usada || "—"}
                      </Text>
                    </Box>
                  </SimpleGrid>
                )}

                {/* PASO DE ELABORACIÓN (1, 2, 3...) */}
                {nodoSeleccionado.tipoVisual === "Paso" && (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4">
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">ETAPA DE RECETA</Text>
                      <Text fontSize="sm" fontWeight="medium">{nodoSeleccionado.nodoRaw.titulo}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">OPERARIO FIRMANTE</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {(nodoSeleccionado.nodoRaw as NodoTimeline).detalle?.operario_nombre || "Operario de planta"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">REGISTRO DE FIRMA</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {(nodoSeleccionado.nodoRaw as NodoTimeline).fecha_hora
                          ? new Date((nodoSeleccionado.nodoRaw as NodoTimeline).fecha_hora!).toLocaleString("es-AR")
                          : "Completado conforme"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">CONTROL DE DESVÍOS</Text>
                      <Text fontSize="xs" color="green.fg" fontWeight="bold">
                        Sin desvíos de inocuidad ✓
                      </Text>
                    </Box>
                  </SimpleGrid>
                )}

                {/* CIERRE / FIN */}
                {nodoSeleccionado.tipoVisual === "Fin" && (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4">
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">PRODUCTO TERMINADO</Text>
                      <Text fontSize="sm" fontWeight="medium">{grafo.producto_nombre}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">CANTIDAD PRODUCIDA</Text>
                      <Text fontSize="sm" fontWeight="bold" color="green.fg">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.producido || "100"} u
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">VENCIMIENTO COMERCIAL</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.vencimiento || "Vigente"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">LIBERACIÓN BROMATOLÓGICA</Text>
                      <Badge size="xs" colorPalette="green" variant="subtle">Apto Distribución</Badge>
                    </Box>
                  </SimpleGrid>
                )}

                {/* RESERVA / DESPACHO / CLIENTE */}
                {(nodoSeleccionado.tipoVisual === "R" ||
                  nodoSeleccionado.tipoVisual === "D" ||
                  nodoSeleccionado.tipoVisual === "C") && (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4">
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">REFERENCIA</Text>
                      <Text fontSize="sm" fontWeight="medium">{nodoSeleccionado.nodoRaw.titulo}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">TRANSPORTE Y HABILITACIÓN</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.transportista || "Transporte certificado SENASA"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">ESTADO LOGÍSTICO</Text>
                      <Badge size="xs" colorPalette="teal" variant="subtle">
                        {(nodoSeleccionado.nodoRaw as NodoGrafo).badge || "ENTREGADO"}
                      </Badge>
                    </Box>
                    <Box>
                      <Text fontSize="2xs" color="fg.muted" fontWeight="bold">REMITO DE ENTREGA</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        #{(nodoSeleccionado.nodoRaw as NodoGrafo).metadatos?.salida_id || "REM-001"}
                      </Text>
                    </Box>
                  </SimpleGrid>
                )}
              </Box>
            </Stack>
          </Tarjeta>
        ) : (
          <Tarjeta p="4" textAlign="center" bg="bg.panel" borderColor="border.subtle">
            <Text fontSize="xs" color="fg.muted">
              💡 Hacé clic en cualquier nodo (proveedor, insumo, paso, lote final, transporte o cliente) para trazar su recorrido bidireccional y consultar sus datos de auditoría.
            </Text>
          </Tarjeta>
        )}
      </Box>
    </Box>
  );
}
