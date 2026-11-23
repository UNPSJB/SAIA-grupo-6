import { useId, useState } from "react";
import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TonoEstado } from "../../../components/ui/patrones";
import { formatoCantidad } from "../../../common/utils/numeros";
import type { Conteo, MapaCalor as DatosMapa, Serie } from "../types/paneles";
import { COLOR_ESTADO, type ParteDona } from "../types/coloresGraficos";
import { esPeriodoDeUnMes, useFechasEje } from "./ejeFechas";

/*
 * Gráficos de los paneles de categoría. Cada forma responde a una pregunta:
 *   - `GraficoSerie`: algo que cambia en el tiempo. Barras agrupadas para
 *     comparar conteos, apiladas para ver cómo se compone un total, líneas
 *     para seguir la tendencia de dos medidas y área para un porcentaje.
 *   - `GraficoDona`: cómo se reparte un total entre pocas partes (hasta 5).
 *   - `BarraEstados`: un total repartido en estados, en una sola barra.
 *   - `Medidor`: un porcentaje solo, contra su 100 %.
 *   - `MapaCalor`: una medida cruzada por categoría y por tramo de tiempo.
 *   - `GraficoPaleta` (lollipop): una cantidad por categoría, cuando importa
 *     el valor de cada una más que llenar una barra (cantidad producida).
 * Para comparar muchas categorías con nombre están las `BarrasHorizontales`
 * de `piezasPanel`.
 *
 * Colores (en `types/coloresGraficos.ts`). Las SERIES usan tres tonos de la paleta categórica de referencia
 * del skill de visualización (validados entre sí, también para daltonismo);
 * nunca más de tres por gráfico. Los ESTADOS (al día / por vencer / vencido)
 * usan la paleta de estado, que no se reutiliza como color de serie, y van
 * siempre con su nombre al lado: el color nunca es la única señal.
 */

const COLOR_EJE = "var(--chakra-colors-gray-500)";
const COLOR_GRILLA = "var(--chakra-colors-gray-100)";
/** Radio de las esquinas superiores de una barra (o del tope de una pila). */
const RADIO_BARRA = 5;

/**
 * En una pila, `true` si esta serie es la última con valor del tramo: es la
 * que se ve arriba y la única que lleva las esquinas redondeadas. Si se
 * redondeara siempre la misma serie, un tramo donde esa serie vale 0 quedaría
 * con el tope cuadrado.
 */
function esTopeDePila(punto: Record<string, unknown> | undefined, clave: string, claves: string[]) {
  if (!punto) return false;
  return claves.slice(claves.indexOf(clave) + 1).every((c) => !punto[c]);
}

/* ─────────────────────────── Leyenda y tooltip ─────────────────────────── */

export function Punto({ color }: { color: string }) {
  return <Box as="span" w="2.5" h="2.5" rounded="full" bg={color} flexShrink={0} aria-hidden />;
}

export function FilaTooltip({ color, texto, valor }: { color: string; texto: string; valor: string }) {
  return (
    <HStack justify="space-between" gap="4" fontSize="xs">
      <HStack gap="1.5">
        <Punto color={color} />
        <Text as="span" color="fg.muted">
          {texto}
        </Text>
      </HStack>
      <Text as="span" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
        {valor}
      </Text>
    </HStack>
  );
}

export function CajaTooltip({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="md"
      boxShadow="card"
      px="3"
      py="2"
      minW="150px"
      maxW="300px"
    >
      <Text fontSize="xs" fontWeight="semibold" color="fg" mb="1.5">
        {titulo}
      </Text>
      {children}
    </Box>
  );
}

/* ───────────────────────────── Serie temporal ───────────────────────────── */

export interface SerieGrafico {
  clave: string;
  etiqueta: string;
  color: string;
}

const TITULO_TRAMO = { dia: "Día", semana: "Semana del" } as const;

const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** `YYYY-MM-DD` → "Noviembre de 2026": el título del cartel de un mes. */
function mesLargo(iso: string): string {
  const mes = MESES_LARGOS[Number(iso.slice(5, 7)) - 1];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${iso.slice(0, 4)}`;
}

function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

interface GraficoSerieProps {
  serie: Serie;
  series: SerieGrafico[];
  /**
   * `barras`: conteos lado a lado. `apiladas`: partes de un total.
   * `lineas`: tendencia de una o dos medidas. `area`: una medida continua.
   */
  tipo?: "barras" | "apiladas" | "lineas" | "area";
  /** Sufijo del valor ("%"). Con "%" el eje va de 0 a 100 y no se suman totales. */
  unidad?: string;
  /** Qué se mide, para el lector de pantalla: "Lotes por período". */
  resumen: string;
  alto?: number;
  /**
   * El gráfico se estira hasta ocupar el alto libre del bloque (`alto` pasa a
   * ser el mínimo). Para el bloque ancho de una fila cuyo vecino es más alto:
   * sin esto queda un hueco en blanco debajo del gráfico.
   */
  llenar?: boolean;
  /** Líneas extra del tooltip, calculadas a partir del punto. */
  /**
   * Detalle extra del tooltip, calculado a partir del punto (`clave` es el
   * primer día del tramo). Un texto va como una línea atenuada; un elemento
   * (p. ej. una lista) se muestra tal cual, debajo de una línea divisoria.
   */
  extraTooltip?: (valores: Record<string, number | null>, clave: string) => React.ReactNode;
  /**
   * Con 30 días, escribir cada fecha en diagonal (por defecto). En un gráfico
   * angosto se pisan: con `false` se escriben solo las que entran, derechas.
   */
  fechasEnDiagonal?: boolean;
}

/**
 * Evolución en el tiempo. El backend ya eligió el tramo (día, semana o mes)
 * según el largo del período y manda todos los tramos, también los vacíos.
 *
 * Leyenda arriba con el total del período de cada serie; el detalle de cada
 * tramo va en el tooltip, no escrito sobre las barras. Debajo hay una tabla
 * solo para lectores de pantalla con los mismos datos.
 */
export function GraficoSerie({
  serie,
  series,
  tipo = "barras",
  unidad,
  resumen,
  alto = 240,
  llenar = false,
  extraTooltip,
  fechasEnDiagonal = true,
}: GraficoSerieProps) {
  const esPorcentaje = unidad === "%";
  /** Período de 30 días mostrado día por día (no 7 días, ni 90, ni 12 meses). */
  const diasDelMes =
    fechasEnDiagonal && serie.granularidad === "dia" && esPeriodoDeUnMes(serie.puntos.length);
  // En diagonal, la primera y la última fecha asoman unos píxeles por los
  // costados y por abajo: un poco de margen para que no se corten.
  const margen = diasDelMes
    ? { top: 6, right: 12, bottom: 4, left: 6 }
    : // A la derecha, lugar para media fecha: la última va centrada en su día.
      { top: 6, right: 22, bottom: 0, left: 0 };
  // Ids de los degradados del área: únicos por gráfico, puede haber varios en pantalla.
  const idDegradado = `degradado-${useId().replace(/:/g, "")}`;
  const claves = series.map((s) => s.clave);
  const datos = serie.puntos.map((p) => ({ clave: p.clave, etiqueta: p.etiqueta, ...p.valores }));
  const formato = (valor: number | null | undefined) =>
    valor === null || valor === undefined ? "Sin datos" : `${formatoCantidad(valor)}${unidad ?? ""}`;
  const { ref: refEjeFechas, ticks: ticksFechas, tick: tickFecha } = useFechasEje(
    serie.puntos.map((p) => p.etiqueta),
    12,
    COLOR_EJE,
    serie.granularidad === "semana" ? undefined : serie.puntos.map((p) => p.clave),
    serie.granularidad === "mes",
  );

  const contenidoTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: Record<string, unknown> }>;
  }) => {
    const punto = payload?.[0]?.payload;
    if (!active || !punto) return null;
    const valores = punto as Record<string, number | null>;
    const extra = extraTooltip?.(valores, String(punto.clave));
    return (
      <CajaTooltip
        titulo={
          serie.granularidad === "mes"
            ? mesLargo(String(punto.clave))
            : `${TITULO_TRAMO[serie.granularidad]} ${fechaCorta(String(punto.clave))}`
        }
      >
        {series.map((s) => (
          <FilaTooltip key={s.clave} color={s.color} texto={s.etiqueta} valor={formato(valores[s.clave])} />
        ))}
        {typeof extra === "string" ? (
          <Text fontSize="xs" color="fg.muted" mt="1">
            {extra}
          </Text>
        ) : extra ? (
          <Box mt="2" pt="2" borderTopWidth="1px" borderColor="border.subtle">
            {extra}
          </Box>
        ) : null}
      </CajaTooltip>
    );
  };

  const ejes = (
    <>
      <CartesianGrid vertical={false} stroke={COLOR_GRILLA} strokeWidth={1} />
      {/* Período de un mes, día por día: fechas en diagonal y todas visibles
          (si no, se saltea un día de por medio). Con 7 días entran derechas y
          con 90 días o 12 meses son demasiadas: ahí se dejan sin rotar. */}
      {diasDelMes ? (
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: COLOR_EJE }}
          angle={-45}
          textAnchor="end"
          height={50}
          tickMargin={4}
          interval={0}
        />
      ) : (
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          ticks={ticksFechas}
          tick={tickFecha}
          tickMargin={8}
          interval={0}
        />
      )}
      <YAxis
        allowDecimals={false}
        tickLine={false}
        axisLine={false}
        width={esPorcentaje ? 48 : 30}
        tick={{ fontSize: 12, fill: COLOR_EJE }}
        tickCount={5}
        tickFormatter={(v: number) => `${v}${unidad ?? ""}`}
        domain={esPorcentaje ? [0, 100] : [0, (max: number) => Math.max(4, Math.ceil(max / 4) * 4)]}
      />
    </>
  );

  return (
    <Box display="flex" flexDirection="column" flex="1" minW="0">
      {/* Con una sola serie el título del bloque ya dice qué es: sin leyenda. */}
      {series.length > 1 || !esPorcentaje ? (
        <HStack gap="5" mb="3" flexWrap="wrap">
          {series.map((s) => (
            <HStack gap="2" key={s.clave}>
              <Punto color={s.color} />
              <Text as="span" fontSize="sm" color="fg.muted" whiteSpace="nowrap">
                {s.etiqueta}
                {esPorcentaje ? null : (
                  <>
                    {" "}
                    <Text as="span" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
                      {formatoCantidad(serie.puntos.reduce((t, p) => t + (p.valores[s.clave] ?? 0), 0))}
                    </Text>
                  </>
                )}
              </Text>
            </HStack>
          ))}
        </HStack>
      ) : null}

      <Box
        ref={refEjeFechas}
        w="full"
        {...(llenar ? { flex: "1", minH: `${alto}px` } : { h: `${alto}px` })}
        role="img"
        aria-label={resumen}
      >
        <ResponsiveContainer width="100%" height="100%">
          {tipo === "area" ? (
            <AreaChart data={datos} margin={margen}>
              {/* Debajo de cada curva, un degradado del color de la serie que
                  se desvanece hacia el eje: marca el volumen sin tapar la
                  grilla ni la otra serie. */}
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.clave} id={`${idDegradado}-${s.clave}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={series.length > 1 ? 0.22 : 0.3} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {ejes}
              <Tooltip content={contenidoTooltip} cursor={{ stroke: COLOR_EJE, strokeWidth: 1 }} />
              {series.map((s) => (
                <Area
                  key={s.clave}
                  type="monotone"
                  dataKey={s.clave}
                  name={s.etiqueta}
                  stroke={s.color}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  fill={`url(#${idDegradado}-${s.clave})`}
                  fillOpacity={1}
                  // Un tramo sin dato corta la línea: no se inventa un valor.
                  connectNulls={false}
                  // Con pocos tramos, un punto en cada uno ayuda a leer el
                  // valor; con muchos, ensucia la curva.
                  dot={datos.length <= 14 ? { r: 2.5, fill: s.color, strokeWidth: 0 } : false}
                  activeDot={{ r: 5, stroke: "var(--chakra-colors-bg-panel)", strokeWidth: 2 }}
                  animationDuration={500}
                />
              ))}
            </AreaChart>
          ) : tipo === "lineas" ? (
            <LineChart data={datos} margin={margen}>
              {ejes}
              <Tooltip content={contenidoTooltip} cursor={{ stroke: COLOR_EJE, strokeWidth: 1 }} />
              {series.map((s) => (
                <Line
                  key={s.clave}
                  type="monotone"
                  dataKey={s.clave}
                  name={s.etiqueta}
                  stroke={s.color}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={datos.length <= 31 ? { r: 2.5, fill: s.color, strokeWidth: 0 } : false}
                  activeDot={{ r: 5, stroke: "var(--chakra-colors-bg-panel)", strokeWidth: 2 }}
                  animationDuration={500}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={datos} margin={margen} barGap={2} barCategoryGap="25%">
              {ejes}
              <Tooltip content={contenidoTooltip} cursor={{ fill: "var(--chakra-colors-gray-50)" }} />
              {series.map((s) => (
                <Bar
                  key={s.clave}
                  dataKey={s.clave}
                  name={s.etiqueta}
                  fill={s.color}
                  // Apiladas: un solo total por tramo, con una línea del color
                  // de la superficie separando las partes.
                  stackId={tipo === "apiladas" ? "total" : undefined}
                  stroke={tipo === "apiladas" ? "var(--chakra-colors-bg-panel)" : undefined}
                  strokeWidth={tipo === "apiladas" ? 1 : 0}
                  radius={tipo === "apiladas" ? 0 : [RADIO_BARRA, RADIO_BARRA, 0, 0]}
                  shape={
                    tipo === "apiladas"
                      ? (props: unknown) => {
                          const forma = props as React.ComponentProps<typeof Rectangle> & {
                            payload?: Record<string, unknown>;
                          };
                          const tope = esTopeDePila(forma.payload, s.clave, claves);
                          return (
                            <Rectangle {...forma} radius={tope ? [RADIO_BARRA, RADIO_BARRA, 0, 0] : 0} />
                          );
                        }
                      : undefined
                  }
                  maxBarSize={tipo === "apiladas" ? 28 : 18}
                  animationDuration={500}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>

      <Box as="table" srOnly>
        <caption>{resumen}</caption>
        <thead>
          <tr>
            <th>Tramo</th>
            {series.map((s) => (
              <th key={s.clave}>{s.etiqueta}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {serie.puntos.map((p) => (
            <tr key={p.clave}>
              <td>{p.etiqueta}</td>
              {series.map((s) => (
                <td key={s.clave}>{formato(p.valores[s.clave])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

/* ───────────────────────────────── Dona ───────────────────────────────── */

const LADO = 160;
const CENTRO = LADO / 2;
const GROSOR = 22;
const RADIO = 76 - GROSOR / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
/** Aire entre porciones: separa sin dibujar bordes. */
const HUECO = 1.8;

/**
 * Reparto de un total entre pocas partes: anillo con el total en el centro y
 * la leyenda al costado (debajo si no entra) con nombre, cantidad y
 * porcentaje. Al pasar por una porción o por su fila, las demás se atenúan y
 * el centro muestra esa parte.
 */
export function GraficoDona({
  partes,
  unidad,
  centro,
}: {
  partes: ParteDona[];
  unidad: string;
  /**
   * Qué va en el centro sin nada señalado. Por defecto, el total y la
   * `unidad`; p. ej. "94%" y "120 tareas" cuando el dato es un porcentaje.
   */
  centro?: { valor: string; texto: string };
}) {
  const [activa, setActiva] = useState<string | null>(null);
  const visibles = partes.filter((p) => p.valor > 0);
  const total = visibles.reduce((t, p) => t + p.valor, 0);
  const porcentaje = (valor: number) => (total === 0 ? 0 : Math.round((valor / total) * 100));
  const parteActiva = visibles.find((p) => p.clave === activa) ?? null;

  const tramos = visibles.map((parte, i) => ({
    parte,
    largo: (parte.valor / total) * CIRCUNFERENCIA,
    desplazamiento: (visibles.slice(0, i).reduce((t, p) => t + p.valor, 0) / total) * CIRCUNFERENCIA,
  }));

  const resumen = `${partes.map((p) => `${p.etiqueta}: ${p.valor} (${porcentaje(p.valor)}%)`).join(", ")}. Total: ${total} ${unidad}.`;

  return (
    <Flex
      gap="6"
      align="center"
      justify="center"
      flexWrap="wrap"
      my="auto"
      onMouseLeave={() => setActiva(null)}
    >
      <Box position="relative" w="180px" h="180px" flexShrink={0}>
        <svg
          viewBox={`0 0 ${LADO} ${LADO}`}
          role="img"
          aria-label={resumen}
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {tramos.map(({ parte, largo, desplazamiento }) => {
            const visible = Math.max(largo - (visibles.length > 1 ? HUECO : 0), 0);
            return (
              <circle
                key={parte.clave}
                cx={CENTRO}
                cy={CENTRO}
                r={RADIO}
                fill="none"
                stroke={parte.color}
                strokeWidth={activa === parte.clave ? GROSOR + 4 : GROSOR}
                strokeDasharray={`${visible} ${CIRCUNFERENCIA - visible}`}
                strokeDashoffset={-desplazamiento}
                transform={`rotate(-90 ${CENTRO} ${CENTRO})`}
                opacity={activa !== null && activa !== parte.clave ? 0.3 : 1}
                style={{ transition: "opacity 0.15s ease, stroke-width 0.15s ease" }}
                onMouseEnter={() => setActiva(parte.clave)}
              />
            );
          })}
        </svg>
        <Box
          position="absolute"
          inset={0}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
          textAlign="center"
          px="10"
        >
          <Text
            fontSize="3xl"
            fontWeight="extrabold"
            lineHeight="1"
            letterSpacing="-0.02em"
            color="fg"
            fontVariantNumeric="tabular-nums"
          >
            {parteActiva ? formatoCantidad(parteActiva.valor) : (centro?.valor ?? formatoCantidad(total))}
          </Text>
          <Text fontSize="xs" color="fg.muted" mt="1" lineClamp={2}>
            {parteActiva
              ? `${parteActiva.etiqueta} · ${porcentaje(parteActiva.valor)}%`
              : (centro?.texto ?? unidad)}
          </Text>
        </Box>
      </Box>

      <Stack as="ul" listStyleType="none" m="0" p="0" gap="1" flex="1" minW="230px" maxW="340px">
        {partes.map((parte) => {
          const seleccionada = activa === parte.clave;
          return (
            <HStack
              as="li"
              key={parte.clave}
              tabIndex={0}
              gap="2.5"
              px="2"
              py="1.5"
              rounded="md"
              bg={seleccionada ? "bg.muted" : "transparent"}
              opacity={activa !== null && !seleccionada ? 0.55 : 1}
              transition="opacity 0.15s ease, background 0.15s ease"
              onMouseEnter={() => setActiva(parte.clave)}
              onFocus={() => setActiva(parte.clave)}
              onBlur={() => setActiva(null)}
              _focusVisible={{ outline: "2px solid", outlineColor: "brand.400" }}
            >
              <Punto color={parte.color} />
              <Text fontSize="sm" color="fg" flex="1" minW="0" lineClamp={1} title={parte.etiqueta}>
                {parte.etiqueta}
              </Text>
              <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                {formatoCantidad(parte.valor)}
              </Text>
              <Text
                fontSize="sm"
                fontWeight="semibold"
                color="fg"
                fontVariantNumeric="tabular-nums"
                minW="10"
                textAlign="right"
              >
                {porcentaje(parte.valor)}%
              </Text>
            </HStack>
          );
        })}
      </Stack>
    </Flex>
  );
}

/* ─────────────────────────── Barra de estados ─────────────────────────── */

export interface SegmentoEstado {
  clave: string;
  etiqueta: string;
  valor: number;
  tono: TonoEstado;
}

/**
 * Un total repartido en estados, en una sola barra apilada, con la leyenda
 * debajo (nombre y cantidad). Sirve para poner dos repartos uno sobre otro y
 * compararlos (calibración y mantenimiento).
 */
export function BarraEstados({
  titulo,
  segmentos,
  vacio,
}: {
  titulo?: string;
  segmentos: SegmentoEstado[];
  vacio: string;
}) {
  const total = segmentos.reduce((t, s) => t + s.valor, 0);
  return (
    <Box>
      {titulo ? (
        <Flex justify="space-between" gap="3" mb="1.5">
          <Text fontSize="sm" fontWeight="medium" color="fg">
            {titulo}
          </Text>
          <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
            {total}
          </Text>
        </Flex>
      ) : null}
      {total === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          {vacio}
        </Text>
      ) : (
        <>
          <Flex h="3" gap="2px" rounded="full" overflow="hidden" aria-hidden>
            {segmentos
              .filter((s) => s.valor > 0)
              .map((s) => (
                <Box
                  key={s.clave}
                  bg={COLOR_ESTADO[s.tono]}
                  flexGrow={s.valor}
                  flexBasis="0"
                  minW="6px"
                  title={`${s.etiqueta}: ${s.valor}`}
                />
              ))}
          </Flex>
          <HStack gap="4" mt="2" flexWrap="wrap">
            {segmentos.map((s) => (
              <HStack gap="1.5" key={s.clave}>
                <Punto color={COLOR_ESTADO[s.tono]} />
                <Text as="span" fontSize="xs" color="fg.muted">
                  {s.etiqueta}{" "}
                  <Text as="span" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
                    {s.valor}
                  </Text>
                </Text>
              </HStack>
            ))}
          </HStack>
        </>
      )}
    </Box>
  );
}

/* ─────────────────────────────── Medidor ─────────────────────────────── */

const ANCHO_MEDIDOR = 200;
const RADIO_MEDIDOR = 84;
const GROSOR_MEDIDOR = 18;
/** Largo del semicírculo. */
const ARCO = Math.PI * RADIO_MEDIDOR;

/**
 * Un porcentaje contra su 100 %: semicírculo con el valor en el centro y, al
 * pie, de qué números sale. Un solo color: el medidor dice "cuánto", no si
 * está bien o mal (eso no lo decide la pantalla).
 *
 * `valor` en `null` significa que no hay con qué calcularlo: se dibuja la
 * pista vacía y un guion, no un 0 %.
 */
export function Medidor({
  valor,
  detalle,
  color = "#009b8f",
}: {
  valor: number | null;
  detalle: string;
  color?: string;
}) {
  const avance = valor === null ? 0 : Math.min(Math.max(valor, 0), 100);
  const y = RADIO_MEDIDOR + GROSOR_MEDIDOR / 2;
  const arco = `M ${ANCHO_MEDIDOR / 2 - RADIO_MEDIDOR} ${y} A ${RADIO_MEDIDOR} ${RADIO_MEDIDOR} 0 0 1 ${ANCHO_MEDIDOR / 2 + RADIO_MEDIDOR} ${y}`;
  return (
    <Flex direction="column" align="center" my="auto" gap="1">
      <Box position="relative" w="full" maxW="260px">
        <svg
          viewBox={`0 0 ${ANCHO_MEDIDOR} ${y + 4}`}
          role="img"
          aria-label={valor === null ? "Sin datos" : `${formatoCantidad(valor)}%. ${detalle}`}
          style={{ width: "100%", display: "block" }}
        >
          <path
            d={arco}
            fill="none"
            stroke="var(--chakra-colors-gray-100)"
            strokeWidth={GROSOR_MEDIDOR}
            strokeLinecap="round"
          />
          {avance > 0 ? (
            <path
              d={arco}
              fill="none"
              stroke={color}
              strokeWidth={GROSOR_MEDIDOR}
              strokeLinecap="round"
              strokeDasharray={`${(avance / 100) * ARCO} ${ARCO}`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          ) : null}
        </svg>
        <Flex position="absolute" insetX="0" bottom="0" direction="column" align="center">
          <Text fontSize="3xl" fontWeight="bold" lineHeight="1" color="fg" fontVariantNumeric="tabular-nums">
            {valor === null ? "—" : `${formatoCantidad(valor)}%`}
          </Text>
        </Flex>
      </Box>
      <Flex justify="space-between" w="full" maxW="260px" px="1" fontSize="xs" color="fg.subtle" aria-hidden>
        <Text as="span">0%</Text>
        <Text as="span">100%</Text>
      </Flex>
      <Text fontSize="sm" color="fg.muted" textAlign="center">
        {detalle}
      </Text>
    </Flex>
  );
}

/* ───────────────────────────── Mapa de calor ───────────────────────────── */

/** `#rrggbb` + opacidad → `rgba()`: la intensidad de una celda. */
function conOpacidad(hex: string, opacidad: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${opacidad})`;
}

const TEXTO_TRAMO = { dia: "día ", semana: "semana del ", mes: "" } as const;
const RAYADO = "repeating-linear-gradient(45deg, var(--chakra-colors-gray-200) 0 2px, transparent 2px 6px)";

interface MapaCalorProps {
  mapa: DatosMapa;
  /** Un solo tono, de claro a oscuro: la intensidad es la magnitud. */
  color: string;
  /** "%": la escala va de 0 a 100. Si no, de 0 al máximo del mapa. */
  sufijo?: "%";
  /** Qué se cuenta cuando no es un porcentaje: "incidentes". */
  unidad?: string;
  resumen: string;
}

/**
 * Una medida cruzada por categoría (filas) y por tramo de tiempo (columnas).
 * Sirve para ver de un vistazo dónde y cuándo se concentra algo.
 *
 * La intensidad del color es el valor. Una celda SIN dato (un sector sin
 * tareas ese día) se dibuja rayada, distinta de un cero. El valor exacto está
 * en el `title` de cada celda y en la tabla para lectores de pantalla. Con
 * muchos tramos el mapa se desplaza dentro de su bloque, sin ensanchar la página.
 */
export function MapaCalor({ mapa, color, sufijo, unidad, resumen }: MapaCalorProps) {
  const valores = mapa.filas.flatMap((f) => f.valores).filter((v): v is number => v !== null);
  const maximo = sufijo === "%" ? 100 : Math.max(...valores, 1);
  const texto = (v: number | null) =>
    v === null ? "sin datos" : `${formatoCantidad(v)}${sufijo ?? (unidad ? ` ${unidad}` : "")}`;
  // Una etiqueta de columna cada tantas, para que no se pisen.
  const paso = Math.ceil(mapa.columnas.length / 8);
  const columnas = `minmax(96px, 150px) repeat(${mapa.columnas.length}, minmax(16px, 1fr))`;

  return (
    <Box minW="0">
      <Box overflowX="auto" pb="1" role="img" aria-label={resumen}>
        <Box display="grid" gridTemplateColumns={columnas} gap="3px" alignItems="center" minW="max-content">
          {mapa.filas.map((fila) => (
            <Box display="contents" key={fila.clave}>
              <Text fontSize="xs" color="fg" lineClamp={1} pr="2" title={fila.etiqueta}>
                {fila.etiqueta}
              </Text>
              {fila.valores.map((valor, i) => (
                <Box
                  key={`${mapa.columnas[i]}-${i}`}
                  h="6"
                  rounded="sm"
                  title={`${fila.etiqueta} · ${TEXTO_TRAMO[mapa.granularidad]}${mapa.columnas[i]}: ${texto(valor)}`}
                  bg={
                    valor === null
                      ? "transparent"
                      : valor === 0
                        ? "bg.muted"
                        : conOpacidad(color, 0.18 + 0.82 * Math.min(valor / maximo, 1))
                  }
                  backgroundImage={valor === null ? RAYADO : undefined}
                />
              ))}
            </Box>
          ))}
          <Box aria-hidden />
          {mapa.columnas.map((columna, i) => (
            <Text
              key={`${columna}-${i}`}
              fontSize="2xs"
              color="fg.subtle"
              whiteSpace="nowrap"
              overflow="visible"
              w="0"
              aria-hidden
            >
              {i % paso === 0 ? columna : ""}
            </Text>
          ))}
        </Box>
      </Box>

      <HStack gap="4" mt="3" flexWrap="wrap" fontSize="xs" color="fg.muted">
        <HStack gap="1.5">
          <Text as="span">{sufijo === "%" ? "0%" : "Menos"}</Text>
          {[0.18, 0.4, 0.6, 0.8, 1].map((o) => (
            <Box key={o} w="4" h="3" rounded="sm" bg={conOpacidad(color, o)} aria-hidden />
          ))}
          <Text as="span">{sufijo === "%" ? "100%" : `Más (máximo ${formatoCantidad(maximo)})`}</Text>
        </HStack>
        {valores.length < mapa.filas.length * mapa.columnas.length ? (
          <HStack gap="1.5">
            <Box w="4" h="3" rounded="sm" backgroundImage={RAYADO} aria-hidden />
            <Text as="span">Sin datos</Text>
          </HStack>
        ) : null}
      </HStack>

      {/* La tabla va dentro de un contenedor oculto: con tantas columnas, una
          tabla `srOnly` suelta ensancha la página. */}
      <Box srOnly>
        <table>
          <caption>{resumen}</caption>
          <thead>
            <tr>
              <th>Categoría</th>
              {mapa.columnas.map((c, i) => (
                <th key={`${c}-${i}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapa.filas.map((fila) => (
              <tr key={fila.clave}>
                <td>{fila.etiqueta}</td>
                {fila.valores.map((v, i) => (
                  <td key={`${mapa.columnas[i]}-${i}`}>{texto(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}

/* ─────────────────────────── Paletas (lollipop) ─────────────────────────── */

/** Teal de serie de la app, el mismo de las barras horizontales. */
const COLOR_PALETA = "#009b8f";

/**
 * Gráfico de paletas (lollipop): una línea fina desde cero y un punto en el
 * valor de cada categoría, ordenadas de mayor a menor. Con menos tinta que
 * una barra, la vista va al punto, que es el dato.
 *
 * Todas las filas tienen que estar en la misma `unidad` ("kg"): si no, el
 * largo de la línea compara cosas distintas. Al final de la fila va solo el
 * valor con su unidad; el `detalle` ("66 un") queda en el `title` de la fila.
 * No lleva tabla `srOnly`: la lista ya tiene en texto la etiqueta y el valor.
 */
export function GraficoPaleta({
  datos,
  unidad,
  color = COLOR_PALETA,
  maximo: tope,
  texto: textoFila,
}: {
  datos: Conteo[];
  unidad: string;
  color?: string;
  /** Contra qué se mide el largo (100 en un porcentaje); por defecto, el mayor valor. */
  maximo?: number;
  /** Lo que va a la derecha de la fila, si no es el valor con su unidad. */
  texto?: (dato: Conteo) => string;
}) {
  const filas = [...datos].sort((a, b) => b.valor - a.valor);
  const maximo = tope ?? Math.max(...filas.map((d) => d.valor), 1);

  return (
    <Stack as="ul" listStyleType="none" gap="3" m="0" p="0">
      {filas.map((dato) => {
        const valor = textoFila ? textoFila(dato) : `${formatoCantidad(dato.valor)} ${unidad}`;
        const texto = dato.detalle && !textoFila ? `${valor} (${dato.detalle})` : valor;
        const proporcion = Math.min(dato.valor / maximo, 1);
        return (
          <Box
            as="li"
            key={dato.clave}
            display="grid"
            // Nombre y valor en la primera fila; la paleta abajo, a todo el
            // ancho. Así el nombre tiene la fila entera y entra completo.
            gridTemplateColumns="minmax(0, 1fr) auto"
            columnGap="3"
            rowGap="1"
            alignItems="center"
            title={`${dato.etiqueta}: ${texto}`}
          >
            <Text fontSize="sm" color="fg">
              {dato.etiqueta}
            </Text>
            <Box position="relative" h="3" gridColumn="1 / -1" gridRow="2" aria-hidden>
              {/* Eje: dónde está el cero y hasta dónde llega el máximo. */}
              <Box position="absolute" insetX="0" top="50%" h="1px" bg="bg.muted" />
              {/* El punto se corre medio diámetro para que el del máximo no se
                  salga del contenedor. */}
              <Box
                position="absolute"
                left="0"
                top="50%"
                h="2px"
                mt="-1px"
                bg={color}
                w={`calc((100% - 12px) * ${proporcion} + 6px)`}
              />
              <Box
                position="absolute"
                top="50%"
                w="3"
                h="3"
                mt="-6px"
                rounded="full"
                bg={color}
                left={`calc((100% - 12px) * ${proporcion})`}
              />
            </Box>
            <HStack justify="flex-end" gridRow="1" gridColumn="2">
              <Text fontSize="sm" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
                {valor}
              </Text>
            </HStack>
          </Box>
        );
      })}
    </Stack>
  );
}

/* ─────────────────────── Barras por categoría ─────────────────────── */

/** "María Fernanda González" → "María F. G.": entra en el eje sin pisarse. */
function abreviarNombre(nombre: string, largo = 10): string {
  if (nombre.length <= largo) return nombre;
  const [primero, ...resto] = nombre.split(/\s+/);
  const corto = [primero, ...resto.map((p) => `${p.charAt(0)}.`)].join(" ");
  return corto.length <= largo + 4 ? corto : `${nombre.slice(0, largo + 3)}…`;
}

interface FilaCategoria extends Conteo {
  /** El nombre abreviado, para el eje. */
  corta: string;
}

/** A dónde lleva el clic en una barra. */
export interface DestinoBarra {
  to: string;
  state?: unknown;
  /** Texto al pie del tooltip: "Clic para ver incidentes". */
  pista: string;
}

/**
 * Una cantidad por categoría en barras verticales, con el nombre en el eje X
 * (abreviado y en diagonal si son varias). Para pocas categorías con nombre
 * corto (personas); con nombres largos van las `BarrasHorizontales`.
 *
 * El tooltip muestra el nombre completo, que el eje abrevia. Con `destino`
 * cada barra lleva a su detalle (con el mouse o el dedo).
 */
export function GraficoBarrasCategoria({
  datos,
  unidad,
  unidadUno,
  color,
  resumen,
  alto = 240,
  destino,
}: {
  datos: Conteo[];
  /** Qué se cuenta, en plural: "incidentes". */
  unidad: string;
  /** En singular, para cuando vale 1: "incidente". */
  unidadUno?: string;
  color: string;
  resumen: string;
  alto?: number;
  destino?: (dato: Conteo) => DestinoBarra;
}) {
  const navigate = useNavigate();
  const filas: FilaCategoria[] = [...datos]
    .sort((a, b) => b.valor - a.valor)
    .map((d) => ({ ...d, corta: abreviarNombre(d.etiqueta) }));
  const diagonal = filas.length > 4;
  const titulo = `${unidad.charAt(0).toUpperCase()}${unidad.slice(1)}`;
  const cantidad = (valor: number) =>
    `${formatoCantidad(valor)} ${valor === 1 && unidadUno ? unidadUno : unidad}`;

  const irA = (fila: FilaCategoria | undefined) => {
    if (!fila || !destino) return;
    const { to, state } = destino(fila);
    navigate(to, { state });
  };

  const contenidoTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: FilaCategoria }>;
  }) => {
    const fila = payload?.[0]?.payload;
    if (!active || !fila) return null;
    return (
      <CajaTooltip titulo={fila.etiqueta}>
        <HStack gap="1.5" fontSize="sm">
          <Punto color={color} />
          <Text as="span" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
            {cantidad(fila.valor)}
          </Text>
        </HStack>
        {destino ? (
          <Text fontSize="xs" color="fg.subtle" mt="1.5">
            {destino(fila).pista}
          </Text>
        ) : null}
      </CajaTooltip>
    );
  };

  return (
    <Box display="flex" flexDirection="column" flex="1" minW="0">
      <Box w="full" h={`${alto}px`} role="img" aria-label={resumen}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filas}
            // En diagonal, el primer nombre asoma a la izquierda del eje.
            margin={{ top: 6, right: 8, bottom: 0, left: diagonal ? 24 : 0 }}
            barCategoryGap="30%"
            // El clic vale en toda la columna (la barra y el aire de arriba):
            // una barra de 1 es muy baja para apuntarle.
            onClick={
              destino
                ? (estado) => {
                    const i = Number(estado?.activeTooltipIndex);
                    if (Number.isInteger(i)) irA(filas[i]);
                  }
                : undefined
            }
            style={destino ? { cursor: "pointer" } : undefined}
          >
            <CartesianGrid vertical={false} stroke={COLOR_GRILLA} strokeWidth={1} />
            {diagonal ? (
              <XAxis
                dataKey="corta"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 11, fill: COLOR_EJE }}
                angle={-35}
                textAnchor="end"
                height={70}
                tickMargin={4}
              />
            ) : (
              <XAxis
                dataKey="corta"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 11, fill: COLOR_EJE }}
                tickMargin={8}
              />
            )}
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={30}
              tick={{ fontSize: 12, fill: COLOR_EJE }}
              tickCount={5}
              domain={[0, (max: number) => Math.max(4, Math.ceil(max / 4) * 4)]}
            />
            {/* Gris translúcido: se ve igual de suave en modo claro y oscuro. */}
            <Tooltip content={contenidoTooltip} cursor={{ fill: "rgba(128, 128, 128, 0.12)" }} />
            <Bar
              dataKey="valor"
              name={titulo}
              fill={color}
              radius={[RADIO_BARRA, RADIO_BARRA, 0, 0]}
              maxBarSize={36}
              // La barra señalada se aclara apenas: se ve cuál se va a abrir.
              activeBar={destino ? { style: { filter: "brightness(1.15) saturate(1.1)" } } : undefined}
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box as="table" srOnly>
        <caption>{resumen}</caption>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}>
              <td>{f.etiqueta}</td>
              <td>{formatoCantidad(f.valor)}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

/* ─────────────────── Barras apiladas horizontales ─────────────────── */

export interface FilaApilada {
  clave: string;
  etiqueta: string;
  /** Una cantidad por parte, en el orden de `partes`. */
  valores: number[];
  /** Lo que va a la derecha de la fila: "12 salidas · 2 con reclamo". */
  texto: string;
}

/**
 * Un total por categoría partido en partes, una fila por categoría: el largo
 * es el total y los tramos, de qué se compone. Leyenda arriba con el total
 * de cada parte; el detalle de cada fila, a su derecha.
 */
export function BarrasApiladas({ filas, partes }: { filas: FilaApilada[]; partes: SerieGrafico[] }) {
  const totalDe = (f: FilaApilada) => f.valores.reduce((t, v) => t + v, 0);
  const maximo = Math.max(...filas.map(totalDe), 1);

  return (
    <Box>
      <HStack gap="5" mb="4" flexWrap="wrap">
        {partes.map((p, i) => (
          <HStack gap="2" key={p.clave}>
            <Punto color={p.color} />
            <Text as="span" fontSize="sm" color="fg.muted" whiteSpace="nowrap">
              {p.etiqueta}{" "}
              <Text as="span" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
                {formatoCantidad(filas.reduce((t, f) => t + (f.valores[i] ?? 0), 0))}
              </Text>
            </Text>
          </HStack>
        ))}
      </HStack>
      <Stack as="ul" listStyleType="none" gap="3" m="0" p="0">
        {filas.map((fila) => {
          const total = totalDe(fila);
          const conValor = fila.valores.map((v, i) => ({ v, parte: partes[i] })).filter((x) => x.v > 0);
          return (
            <Box as="li" key={fila.clave} title={`${fila.etiqueta}: ${fila.texto}`}>
              <Flex justify="space-between" align="baseline" gap="3" mb="1">
                <Text fontSize="sm" color="fg" lineClamp={1}>
                  {fila.etiqueta}
                </Text>
                <Text
                  fontSize="sm"
                  fontWeight="semibold"
                  color="fg"
                  flexShrink={0}
                  fontVariantNumeric="tabular-nums"
                  whiteSpace="nowrap"
                >
                  {fila.texto}
                </Text>
              </Flex>
              <Flex
                h="2.5"
                gap="2px"
                rounded="full"
                overflow="hidden"
                w={total === 0 ? "0" : `max(${(total / maximo) * 100}%, 6px)`}
                aria-hidden
              >
                {conValor.map(({ v, parte }) => (
                  <Box key={parte.clave} h="full" flexGrow={v} flexBasis="0" minW="4px" bg={parte.color} />
                ))}
              </Flex>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
