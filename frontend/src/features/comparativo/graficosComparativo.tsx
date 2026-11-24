import { Box, Flex, Grid, HStack, Stack, Text, useBreakpointValue } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { LuTarget, LuTrendingUp, LuTrophy } from "react-icons/lu";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EtiquetaEstado, Tarjeta } from "../../components/ui/patrones";
import { Tooltip as TooltipChakra } from "../../components/ui/tooltip";
import { useColorModeValue } from "../../components/ui/color-mode";
import { useEsCelular } from "../../common/hooks/useEsCelular";
import { CajaTooltip, FilaTooltip, Punto } from "../dashboard/components/graficos";
import {
  COLOR_OTRAS,
  COLOR_PEOR,
  COLOR_PROMEDIO,
  COLOR_PROPIA,
  ETIQUETA_CORTA,
  desvio,
  destacados,
  nombreCorto,
  puestosPropios,
  sedesConDato,
  textoDesvio,
  textoPuesto,
  textoValor,
  type IndicadorComparativo,
  type Sede,
} from "./comparativo.utils";

const COLOR_EJE = "var(--chakra-colors-gray-500)";
const COLOR_GRILLA = "var(--chakra-colors-gray-100)";
const COLOR_TEXTO = "var(--chakra-colors-fg)";
/** Violeta de la paleta categórica de referencia (paso propio en modo oscuro). */
const COLOR_PROMEDIO_RADAR = { claro: "#6250d6", oscuro: "#9085e9" };
/*
 * Las otras sedes del detalle: azul y naranja, validados con el teal de la
 * propia en los dos modos (todos los pares, también con daltonismo). Desde la
 * tercera sede extra, gris: no se inventa un tono más. El promedio es una
 * marca vertical violeta, distinta por forma de los puntos.
 */
const COLORES_OTRAS_SEDES = { claro: ["#2a78d6", "#eb6834"], oscuro: ["#3987e5", "#d95926"] };

/* ───────────────────────────── Piezas comunes ───────────────────────────── */

/** Líneas del tooltip de una sede en un indicador: valor, desvío y puesto. */
function DetalleSede({
  indicador,
  valor,
  color,
  texto,
}: {
  indicador: IndicadorComparativo;
  valor: number | null;
  color: string;
  texto?: string;
}) {
  const d = desvio(indicador, valor);
  const puesto = textoPuesto(indicador, valor);
  const extra = [d ? `${d.texto} vs. promedio` : null, puesto].filter(Boolean).join(" · ");
  return (
    <Box _notFirst={{ mt: "1.5" }}>
      <FilaTooltip color={color} texto={texto ?? indicador.etiqueta} valor={textoValor(valor, indicador.formato)} />
      {extra ? (
        <Text fontSize="2xs" color="fg.muted" pl="4">
          {extra}
        </Text>
      ) : null}
    </Box>
  );
}

/** Pie del tooltip: el promedio de la empresa. */
function PieTooltipPromedio({ indicador }: { indicador: IndicadorComparativo }) {
  return (
    <Text fontSize="2xs" color="fg.muted" mt="1.5" pt="1.5" borderTopWidth="1px" borderColor="border.subtle">
      Promedio de la empresa: {textoValor(indicador.promedio_empresa, indicador.formato)}
      {indicador.mejor === "bajo" ? " · menos es mejor" : ""}
    </Text>
  );
}

/** Muestra de la línea punteada del promedio, para las leyendas. */
function MuestraPromedio({ color = "gray.500" }: { color?: string }) {
  return (
    <Box
      as="span"
      w="4"
      h="0"
      borderTopWidth="2px"
      borderStyle="dashed"
      borderColor={color}
      flexShrink={0}
      aria-hidden
    />
  );
}

function ItemLeyenda({ muestra, children }: { muestra: ReactNode; children: ReactNode }) {
  return (
    <HStack gap="2">
      {muestra}
      <Text as="span" fontSize="sm" color="fg.muted" whiteSpace="nowrap">
        {children}
      </Text>
    </HStack>
  );
}

/**
 * Nombre de la sede en el eje X; la propia en negrita y con "Tu sede" debajo
 * (la identidad no va solo por color).
 */
function tickSede(nombres: Map<number, string>, propia: number, largo = 20) {
  return function TickSede(props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
    const { x = 0, y = 0, payload } = props;
    const id = Number(payload?.value ?? 0);
    const esPropia = id === propia;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          dy={12}
          textAnchor="middle"
          fontSize={12}
          fontWeight={esPropia ? 700 : 400}
          fill={esPropia ? COLOR_TEXTO : COLOR_EJE}
        >
          <title>{nombres.get(id) ?? `Sede ${id}`}</title>
          {nombreCorto(nombres.get(id) ?? `Sede ${id}`, largo)}
        </text>
        {esPropia ? (
          <text dy={27} textAnchor="middle" fontSize={11} fontWeight={600} fill={COLOR_PROPIA}>
            Tu sede
          </text>
        ) : null}
      </g>
    );
  };
}

/* ─────────────────────────── Resumen ejecutivo ─────────────────────────── */

function TarjetaResumen({
  icono: Icono,
  etiqueta,
  children,
}: {
  icono: IconType;
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <Tarjeta p="5" display="flex" flexDirection="column" gap="2">
      <HStack gap="1.5" fontSize="xs" fontWeight="medium" color="fg.muted">
        <Box color="brand.600" aria-hidden>
          <Icono size={14} />
        </Box>
        {etiqueta}
      </HStack>
      {children}
    </Tarjeta>
  );
}

/**
 * Tres tarjetas en vez de una por indicador: en qué puestos está la sede, su
 * mayor fortaleza y su mayor oportunidad de mejora frente al promedio.
 */
export function ResumenEjecutivo({
  indicadores,
  sedes,
}: {
  indicadores: IndicadorComparativo[];
  sedes: number;
}) {
  const puestos = puestosPropios(indicadores);
  const comparables = puestos.reduce((t, [, n]) => t + n, 0);
  const { fortaleza, oportunidad } = destacados(indicadores);
  const [primero, ...resto] = puestos;

  return (
    <Grid templateColumns={{ base: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }} gap="5" mb="5">
      <TarjetaResumen icono={LuTrophy} etiqueta="Posición de tu sede">
        {primero ? (
          <>
            <Text fontSize="2xl" fontWeight="extrabold" lineHeight="1.1" color="fg" letterSpacing="-0.02em">
              {primero[0]}° en {primero[1]} {primero[1] === 1 ? "indicador" : "indicadores"}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {resto.length > 0 ? `${resto.map(([p, n]) => `${p}° en ${n}`).join(" · ")} · ` : ""}
              de {comparables} indicadores, entre {sedes} establecimientos
            </Text>
          </>
        ) : (
          <Text fontSize="sm" color="fg.muted">
            Todavía no hay datos para comparar.
          </Text>
        )}
      </TarjetaResumen>

      <TarjetaResumen icono={LuTrendingUp} etiqueta="Mayor fortaleza">
        {fortaleza ? (
          <>
            <Text fontSize="xl" fontWeight="bold" lineHeight="1.2" color="fg">
              {fortaleza.indicador.etiqueta}
            </Text>
            <Flex gap="2" align="center" flexWrap="wrap">
              <EtiquetaEstado tono="ok">{textoDesvio(fortaleza.desvio)}</EtiquetaEstado>
              <Text fontSize="sm" color="fg.muted">
                {textoValor(fortaleza.indicador.valor_propio, fortaleza.indicador.formato)} · empresa{" "}
                {textoValor(fortaleza.indicador.promedio_empresa, fortaleza.indicador.formato)}
              </Text>
            </Flex>
          </>
        ) : (
          <Text fontSize="sm" color="fg.muted">
            Ningún indicador por encima del promedio de la empresa.
          </Text>
        )}
      </TarjetaResumen>

      <TarjetaResumen icono={LuTarget} etiqueta="Mayor oportunidad de mejora">
        {oportunidad ? (
          <>
            <Text fontSize="xl" fontWeight="bold" lineHeight="1.2" color="fg">
              {oportunidad.indicador.etiqueta}
            </Text>
            <Flex gap="2" align="center" flexWrap="wrap">
              <EtiquetaEstado tono="alerta">{textoDesvio(oportunidad.desvio)}</EtiquetaEstado>
              <Text fontSize="sm" color="fg.muted">
                {textoValor(oportunidad.indicador.valor_propio, oportunidad.indicador.formato)} · empresa{" "}
                {textoValor(oportunidad.indicador.promedio_empresa, oportunidad.indicador.formato)}
              </Text>
            </Flex>
          </>
        ) : (
          <Text fontSize="sm" color="fg.muted">
            Tu sede está en el promedio o mejor en todos los indicadores.
          </Text>
        )}
      </TarjetaResumen>
    </Grid>
  );
}

/* ─────────────────────── Perfil de cumplimiento (radar) ─────────────────────── */

/**
 * Los cinco porcentajes de cumplimiento en un solo radar, solo dos formas: la
 * sede propia como área teal y el promedio de la empresa en una línea
 * punteada violeta (contrasta con el teal, también con daltonismo; validado
 * en los dos modos). El resto de las sedes está en el detalle de al lado.
 */
export function RadarCumplimiento({
  indicadores,
  sedes,
  propia,
}: {
  indicadores: IndicadorComparativo[];
  sedes: Sede[];
  propia: number;
}) {
  const colorPromedio = useColorModeValue(COLOR_PROMEDIO_RADAR.claro, COLOR_PROMEDIO_RADAR.oscuro);
  // En el celular el polígono se achica para que entren los nombres de los
  // ejes, y las marcas de la escala (que se pisaban) no se escriben.
  const esCelular = useEsCelular();
  const datos = indicadores.map((i) => ({
    clave: i.clave,
    eje: ETIQUETA_CORTA[i.clave] ?? i.etiqueta,
    promedio: i.promedio_empresa,
    ...Object.fromEntries(i.valores.map((v) => [`s${v.establecimiento_id}`, v.valor])),
  }));
  const nombre = (id: number) => sedes.find((s) => s.id === id)?.nombre ?? `Sede ${id}`;

  const contenidoTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: { clave?: string } }>;
  }) => {
    const indicador = indicadores.find((i) => i.clave === payload?.[0]?.payload?.clave);
    if (!active || !indicador) return null;
    const valorDe = (id: number) => indicador.valores.find((v) => v.establecimiento_id === id)?.valor ?? null;
    return (
      <CajaTooltip titulo={indicador.etiqueta}>
        <DetalleSede
          indicador={indicador}
          valor={valorDe(propia)}
          color={COLOR_PROPIA}
          texto={`${nombre(propia)} (tu sede)`}
        />
        <Box mt="1.5">
          <FilaTooltip
            color={colorPromedio}
            texto="Promedio de la empresa"
            valor={textoValor(indicador.promedio_empresa, indicador.formato)}
          />
        </Box>
      </CajaTooltip>
    );
  };

  return (
    <Box display="flex" flexDirection="column" flex="1" minW="0">
      <HStack gap="5" mb="2" flexWrap="wrap">
        <ItemLeyenda muestra={<Punto color={COLOR_PROPIA} />}>
          <Text as="span" fontWeight="semibold" color="fg">
            {nombre(propia)}
          </Text>{" "}
          (tu sede)
        </ItemLeyenda>
        <ItemLeyenda muestra={<MuestraPromedio color={colorPromedio} />}>Promedio de la empresa</ItemLeyenda>
      </HStack>
      <Box
        w="full"
        flex="1"
        minH="300px"
        role="img"
        aria-label={`Cumplimiento de ${nombre(propia)} frente al promedio de la empresa: ${indicadores
          .map((i) => `${i.etiqueta} ${textoValor(i.valor_propio, i.formato)} (empresa ${textoValor(i.promedio_empresa, i.formato)})`)
          .join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={datos}
            outerRadius={esCelular ? "54%" : "72%"}
            margin={esCelular ? { top: 8, right: 8, bottom: 8, left: 8 } : { top: 8, right: 24, bottom: 8, left: 24 }}
          >
            <PolarGrid stroke={COLOR_GRILLA} />
            <PolarAngleAxis
              dataKey="eje"
              tick={{ fontSize: esCelular ? 11 : 12, fill: COLOR_EJE }}
              // El más largo no entra a la izquierda del polígono en el celular.
              tickFormatter={(v: string) => (esCelular && v === "Documentación" ? "Documentos" : v)}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tickCount={5}
              // Entre dos ejes (con cinco, cada 72°): las marcas no pisan los nombres.
              angle={54}
              axisLine={false}
              tick={esCelular ? false : { fontSize: 10, fill: COLOR_EJE }}
              tickFormatter={(v: number) => (v === 0 ? "" : `${v}%`)}
            />
            <Tooltip content={contenidoTooltip} />
            <Radar
              dataKey="promedio"
              name="Promedio de la empresa"
              stroke={colorPromedio}
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="none"
              dot={{ r: 2.5, fill: colorPromedio, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
            <Radar
              dataKey={`s${propia}`}
              name={nombre(propia)}
              stroke={COLOR_PROPIA}
              strokeWidth={2.25}
              fill={COLOR_PROPIA}
              fillOpacity={0.22}
              dot={{ r: 3, fill: COLOR_PROPIA, strokeWidth: 0 }}
              connectNulls
              animationDuration={500}
            />
          </RadarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

/* ──────────────────────── Detalle por indicador ──────────────────────── */

/**
 * Una fila por indicador de cumplimiento: el valor de la sede y su puesto, una
 * franja de 0 a 100 % con un punto por sede (la propia en teal) y la marca
 * del promedio, y el desvío en una etiqueta. Al pasar o enfocar la fila, el
 * valor de cada sede.
 */
export function DetalleCumplimiento({
  indicadores,
  sedes,
  propia,
}: {
  indicadores: IndicadorComparativo[];
  sedes: Sede[];
  propia: number;
}) {
  const nombre = (id: number) => sedes.find((s) => s.id === id)?.nombre ?? `Sede ${id}`;
  const colorPromedio = useColorModeValue(COLOR_PROMEDIO_RADAR.claro, COLOR_PROMEDIO_RADAR.oscuro);
  const paleta = useColorModeValue(COLORES_OTRAS_SEDES.claro, COLORES_OTRAS_SEDES.oscuro);
  // El color sigue a la sede (orden del backend), no a su puesto en cada fila.
  const otrasSedes = sedes.filter((s) => s.id !== propia);
  const colorDe = new Map<number, string>([
    [propia, COLOR_PROPIA],
    ...otrasSedes.map((s, i): [number, string] => [s.id, paleta[i] ?? COLOR_OTRAS]),
  ]);
  return (
    <Stack as="ul" listStyleType="none" m="0" p="0" gap="1">
      {indicadores.map((indicador) => {
        const d = desvio(indicador, indicador.valor_propio);
        const puesto = textoPuesto(indicador, indicador.valor_propio);
        const otras = indicador.valores.filter((v) => v.establecimiento_id !== propia && v.valor !== null);
        const contenido = (
          <CajaTooltip titulo={indicador.etiqueta}>
            {[...indicador.valores]
              .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1))
              .map((v) => (
                <DetalleSede
                  key={v.establecimiento_id}
                  indicador={indicador}
                  valor={v.valor}
                  color={colorDe.get(v.establecimiento_id) ?? COLOR_OTRAS}
                  texto={`${nombre(v.establecimiento_id)}${v.establecimiento_id === propia ? " (tu sede)" : ""}`}
                />
              ))}
            <Box mt="1.5" pt="1.5" borderTopWidth="1px" borderColor="border.subtle">
              <FilaTooltip
                color={colorPromedio}
                texto="Promedio de la empresa"
                valor={textoValor(indicador.promedio_empresa, indicador.formato)}
              />
            </Box>
          </CajaTooltip>
        );
        return (
          <TooltipChakra
            key={indicador.clave}
            content={contenido}
            positioning={{ placement: "left" }}
            openDelay={150}
            contentProps={{ bg: "transparent", p: "0", boxShadow: "none", maxW: "none" }}
          >
            <Box
              as="li"
              tabIndex={0}
              px="2"
              py="2.5"
              rounded="md"
              cursor="default"
              _hover={{ bg: "bg.muted" }}
              _focusVisible={{ outline: "2px solid", outlineColor: "brand.400" }}
            >
              <Flex justify="space-between" align="baseline" gap="3" mb="2">
                <Text fontSize="sm" color="fg" lineClamp={1} title={indicador.etiqueta}>
                  {indicador.etiqueta}
                </Text>
                <HStack gap="2" flexShrink={0} align="baseline">
                  <Text fontSize="sm" fontWeight="bold" color="fg" fontVariantNumeric="tabular-nums">
                    {textoValor(indicador.valor_propio, indicador.formato)}
                  </Text>
                  {puesto ? (
                    <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                      {puesto}
                    </Text>
                  ) : null}
                </HStack>
              </Flex>
              <Flex align="center" gap="3">
                {/* Franja 0–100 %: un punto por sede y la marca del promedio. */}
                <Box position="relative" h="3" flex="1" minW="0" aria-hidden>
                  <Box position="absolute" insetX="0" top="50%" h="2px" mt="-1px" bg="bg.muted" rounded="full" />
                  {indicador.promedio_empresa !== null ? (
                    <Box
                      position="absolute"
                      top="-1"
                      bottom="-1"
                      w="2px"
                      rounded="full"
                      bg={colorPromedio}
                      left={`calc((100% - 12px) * ${Math.min(indicador.promedio_empresa / 100, 1)} + 5px)`}
                    />
                  ) : null}
                  {otras.map((v) => (
                    <Box
                      key={v.establecimiento_id}
                      position="absolute"
                      top="50%"
                      w="2.5"
                      h="2.5"
                      mt="-5px"
                      rounded="full"
                      bg={colorDe.get(v.establecimiento_id) ?? COLOR_OTRAS}
                      borderWidth="2px"
                      borderColor="bg.panel"
                      left={`calc((100% - 12px) * ${Math.min((v.valor ?? 0) / 100, 1)} + 1px)`}
                    />
                  ))}
                  {indicador.valor_propio !== null ? (
                    <Box
                      position="absolute"
                      top="50%"
                      w="3"
                      h="3"
                      mt="-6px"
                      rounded="full"
                      bg={COLOR_PROPIA}
                      borderWidth="2px"
                      borderColor="bg.panel"
                      left={`calc((100% - 12px) * ${Math.min(indicador.valor_propio / 100, 1)})`}
                    />
                  ) : null}
                </Box>
                <Box flexShrink={0} minW="104px" display="flex" justifyContent="flex-end">
                  {d ? (
                    <EtiquetaEstado tono={d.tono}>{d.texto}</EtiquetaEstado>
                  ) : (
                    <EtiquetaEstado tono="neutro">Sin datos</EtiquetaEstado>
                  )}
                </Box>
              </Flex>
            </Box>
          </TooltipChakra>
        );
      })}
      <Flex align="center" gap="4" mt="2" px="2" fontSize="xs" color="fg.muted" flexWrap="wrap">
        <HStack gap="1.5">
          <Punto color={COLOR_PROPIA} />
          Tu sede
        </HStack>
        {otrasSedes.map((s) => (
          <HStack gap="1.5" key={s.id}>
            <Punto color={colorDe.get(s.id) ?? COLOR_OTRAS} />
            {s.nombre}
          </HStack>
        ))}
        <HStack gap="1.5">
          <Box w="2px" h="3" rounded="full" bg={colorPromedio} aria-hidden />
          Promedio de la empresa
        </HStack>
      </Flex>
    </Stack>
  );
}

/* ───────────────────────── Lotes por sede (agrupadas) ───────────────────────── */

const COLORES_LOTES = ["#2a78d6", "#1baf7a"];

/**
 * Iniciados y terminados lado a lado para cada sede, con una línea punteada
 * por serie en el promedio de la empresa. La sede propia va a pleno color y
 * las demás atenuadas; en el eje, la propia dice "Tu sede".
 */
export function BarrasLotes({
  indicadores,
  sedes,
  propia,
}: {
  indicadores: IndicadorComparativo[];
  sedes: Sede[];
  propia: number;
}) {
  const nombres = new Map(sedes.map((s) => [s.id, s.nombre]));
  // En el celular las columnas son angostas: nombres más cortos en el eje.
  const largoNombre = useBreakpointValue({ base: 9, md: 20 }) ?? 20;
  // La propia primero; después las demás en el orden del backend (por nombre).
  const orden = [propia, ...sedes.map((s) => s.id).filter((id) => id !== propia)];
  const datos = orden.map((id) => ({
    id,
    ...Object.fromEntries(
      indicadores.map((i) => [i.clave, i.valores.find((v) => v.establecimiento_id === id)?.valor ?? null]),
    ),
  }));

  const contenidoTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: Record<string, number | null> }>;
  }) => {
    const punto = payload?.[0]?.payload;
    if (!active || !punto) return null;
    const id = Number(punto.id);
    return (
      <CajaTooltip titulo={`${nombres.get(id) ?? `Sede ${id}`}${id === propia ? " · Tu sede" : ""}`}>
        {indicadores.map((i, n) => (
          <DetalleSede key={i.clave} indicador={i} valor={punto[i.clave] ?? null} color={COLORES_LOTES[n]} />
        ))}
        <Text fontSize="2xs" color="fg.muted" mt="1.5" pt="1.5" borderTopWidth="1px" borderColor="border.subtle">
          Promedio de la empresa:{" "}
          {indicadores.map((i) => `${i.etiqueta.toLowerCase()} ${textoValor(i.promedio_empresa, i.formato)}`).join(" · ")}
        </Text>
      </CajaTooltip>
    );
  };

  return (
    <Box display="flex" flexDirection="column" flex="1" minW="0">
      <HStack gap="5" mb="3" flexWrap="wrap">
        {indicadores.map((i, n) => (
          <ItemLeyenda key={i.clave} muestra={<Punto color={COLORES_LOTES[n]} />}>
            {i.etiqueta}
          </ItemLeyenda>
        ))}
        <ItemLeyenda muestra={<MuestraPromedio />}>Promedio de la empresa (de cada serie)</ItemLeyenda>
      </HStack>
      <Box w="full" h="280px" role="img" aria-label={`Lotes iniciados y terminados por establecimiento`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} barGap={4} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={COLOR_GRILLA} />
            <XAxis
              dataKey="id"
              tickLine={false}
              axisLine={false}
              interval={0}
              height={40}
              tick={tickSede(nombres, propia, largoNombre)}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={34}
              tick={{ fontSize: 12, fill: COLOR_EJE }}
              domain={[0, (max: number) => Math.max(4, Math.ceil(max / 4) * 4)]}
            />
            <Tooltip content={contenidoTooltip} cursor={{ fill: "rgba(128, 128, 128, 0.12)" }} />
            {indicadores.map((i, n) => (
              <Bar
                key={i.clave}
                dataKey={i.clave}
                name={i.etiqueta}
                fill={COLORES_LOTES[n]}
                radius={[5, 5, 0, 0]}
                maxBarSize={44}
                animationDuration={500}
              >
                {datos.map((d) => (
                  <Cell key={d.id} fillOpacity={d.id === propia ? 1 : 0.5} />
                ))}
              </Bar>
            ))}
            {indicadores.map((i, n) =>
              i.promedio_empresa !== null ? (
                <ReferenceLine
                  key={`prom-${i.clave}`}
                  y={i.promedio_empresa}
                  stroke={COLORES_LOTES[n]}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              ) : null,
            )}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

/* ─────────────────────── Calidad y riesgo (menos es mejor) ─────────────────────── */

/**
 * Una barra por sede con el promedio de la empresa en línea punteada. Menos
 * es mejor: la propia va en teal si está en el promedio o por debajo, y en
 * naranja si lo supera. Las demás, en gris.
 */
export function BarrasRiesgo({
  indicador,
  sedes,
  propia,
}: {
  indicador: IndicadorComparativo;
  sedes: Sede[];
  propia: number;
}) {
  const nombres = new Map(sedes.map((s) => [s.id, s.nombre]));
  const esCelular = useEsCelular();
  const orden = [propia, ...sedes.map((s) => s.id).filter((id) => id !== propia)];
  const datos = orden.map((id) => ({
    id,
    valor: indicador.valores.find((v) => v.establecimiento_id === id)?.valor ?? null,
  }));
  const promedio = indicador.promedio_empresa;
  const peor = (v: number | null) =>
    v !== null && promedio !== null && (indicador.mejor === "bajo" ? v > promedio : v < promedio);
  const colorDe = (id: number, v: number | null) => (id !== propia ? COLOR_OTRAS : peor(v) ? COLOR_PEOR : COLOR_PROPIA);

  const contenidoTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: { id: number; valor: number | null } }>;
  }) => {
    const punto = payload?.[0]?.payload;
    if (!active || !punto) return null;
    return (
      <CajaTooltip titulo={`${nombres.get(punto.id) ?? `Sede ${punto.id}`}${punto.id === propia ? " · Tu sede" : ""}`}>
        <DetalleSede indicador={indicador} valor={punto.valor} color={colorDe(punto.id, punto.valor)} />
        <PieTooltipPromedio indicador={indicador} />
      </CajaTooltip>
    );
  };

  return (
    <Box display="flex" flexDirection="column" flex="1" minW="0">
      <Box
        w="full"
        h="220px"
        role="img"
        aria-label={`${indicador.etiqueta} por establecimiento: ${datos
          .map((d) => `${nombres.get(d.id)} ${textoValor(d.valor, indicador.formato)}`)
          .join(", ")}; promedio ${textoValor(promedio, indicador.formato)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={COLOR_GRILLA} />
            {/* Columna angosta: nombres cortos (el completo, en el tooltip). */}
            <XAxis
              dataKey="id"
              tickLine={false}
              axisLine={false}
              interval={0}
              height={40}
              tick={tickSede(nombres, propia, esCelular ? 10 : 12)}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={30}
              tick={{ fontSize: 12, fill: COLOR_EJE }}
              domain={[0, (max: number) => Math.max(4, Math.ceil(max / 4) * 4)]}
            />
            <Tooltip content={contenidoTooltip} cursor={{ fill: "rgba(128, 128, 128, 0.12)" }} />
            <Bar dataKey="valor" name={indicador.etiqueta} radius={[5, 5, 0, 0]} maxBarSize={40} animationDuration={500}>
              {datos.map((d) => (
                <Cell key={d.id} fill={colorDe(d.id, d.valor)} />
              ))}
            </Bar>
            {promedio !== null ? (
              <ReferenceLine
                y={promedio}
                stroke={COLOR_PROMEDIO}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </Box>
      {promedio !== null ? (
        <HStack gap="2" mt="2" fontSize="xs" color="fg.muted">
          <MuestraPromedio />
          Promedio de la empresa: {textoValor(promedio, indicador.formato)}
        </HStack>
      ) : null}
    </Box>
  );
}

/** Cifra de la sede en un indicador de riesgo, para la cabecera de su bloque. */
export function CifraRiesgo({ indicador }: { indicador: IndicadorComparativo }) {
  const d = desvio(indicador, indicador.valor_propio);
  const puesto = textoPuesto(indicador, indicador.valor_propio);
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      mb="4"
      pb="4"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      flexWrap="wrap"
    >
      <Box>
        <Text fontSize="xs" fontWeight="medium" color="fg.muted">
          Tu sede
        </Text>
        <HStack gap="2" align="baseline">
          <Text fontSize="3xl" fontWeight="extrabold" lineHeight="1" color="fg" fontVariantNumeric="tabular-nums">
            {textoValor(indicador.valor_propio, indicador.formato)}
          </Text>
          {puesto ? (
            <Text fontSize="sm" color="fg.muted">
              {puesto}
            </Text>
          ) : null}
        </HStack>
      </Box>
      {d ? (
        <EtiquetaEstado tono={d.tono}>{textoDesvio(d)}</EtiquetaEstado>
      ) : sedesConDato(indicador) === 0 ? null : (
        <EtiquetaEstado tono="neutro">Sin datos</EtiquetaEstado>
      )}
    </Flex>
  );
}
