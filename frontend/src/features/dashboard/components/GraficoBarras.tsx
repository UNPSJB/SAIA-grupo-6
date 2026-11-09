import { Box, HStack, Text } from "@chakra-ui/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoSerie } from "../types/dashboard";

/*
 * Colores de serie validados (contraste, saturación y separación para
 * daltonismo) con el script del skill de visualización:
 *   naranja #eb6834 (iniciados) · teal #009b8f (resueltos), ΔE CVD 11,9.
 *
 * Antes eran rojo y verde: esos son colores de ESTADO (peligro / ok) y acá
 * "iniciados" y "resueltos" son dos categorías, no un semáforo. El teal es
 * el de la marca un poco más saturado: el brand.600 no llega al mínimo de
 * saturación y como color de serie se lee gris.
 */
const COLOR_INICIADOS = "#eb6834";
const COLOR_RESUELTOS = "#009b8f";
const COLOR_EJE = "var(--chakra-colors-gray-500)";
const COLOR_GRILLA = "var(--chakra-colors-gray-100)";

/** Alto mínimo: el gráfico se estira para llenar la tarjeta. */
const ALTO_MINIMO = 200;

interface GraficoBarrasProps {
  datos: PuntoSerie[];
}

function TooltipSemana({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PuntoSerie }>;
  label?: string | number;
}) {
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="md"
      boxShadow="card"
      px="3"
      py="2"
      minW="140px"
    >
      <Text fontSize="xs" fontWeight="semibold" color="fg" mb="1.5">
        {punto.rotulo ?? label}
      </Text>
      <FilaTooltip color={COLOR_INICIADOS} texto="Iniciados" valor={punto.iniciados} />
      <FilaTooltip color={COLOR_RESUELTOS} texto="Resueltos" valor={punto.resueltos} />
    </Box>
  );
}

function FilaTooltip({ color, texto, valor }: { color: string; texto: string; valor: number }) {
  return (
    <HStack justify="space-between" gap="4" fontSize="xs">
      <HStack gap="1.5">
        <Box w="2" h="2" rounded="full" bg={color} aria-hidden />
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

/**
 * Incidentes iniciados contra resueltos, por semana.
 *
 * Diseño (pautas del skill de visualización):
 *   - barras finas (hasta 20px), extremo redondeado de 4px y base recta;
 *   - 2px de aire entre las dos barras de cada semana, sin bordes;
 *   - grilla horizontal de 1px, sólida y apenas visible; sin línea de eje;
 *   - sin números sobre cada barra: los totales van en la leyenda y el
 *     detalle de cada semana en el tooltip;
 *   - tabla oculta para lectores de pantalla con los mismos datos.
 */
export function GraficoBarras({ datos }: GraficoBarrasProps) {
  const totalIniciados = datos.reduce((s, p) => s + p.iniciados, 0);
  const totalResueltos = datos.reduce((s, p) => s + p.resueltos, 0);

  const resumen = `Incidentes del mes por semana: ${datos
    .map((p) => `${p.etiqueta} ${p.iniciados} iniciados y ${p.resueltos} resueltos`)
    .join(", ")}.`;

  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0">
      {/* Leyenda arriba, con los totales del mes: es lo primero que se lee. */}
      <HStack gap="5" mb="3" flexWrap="wrap">
        <Leyenda color={COLOR_INICIADOS} texto="Iniciados" total={totalIniciados} />
        <Leyenda color={COLOR_RESUELTOS} texto="Resueltos" total={totalResueltos} />
      </HStack>

      <Box w="full" flex="1" minH={`${ALTO_MINIMO}px`} role="img" aria-label={resumen}>
        <ResponsiveContainer width="100%" height="100%" minHeight={ALTO_MINIMO}>
          <BarChart
            data={datos}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="30%"
          >
            <CartesianGrid vertical={false} stroke={COLOR_GRILLA} strokeWidth={1} />
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: COLOR_EJE }}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fontSize: 12, fill: COLOR_EJE }}
              tickCount={5}
              domain={[0, (max: number) => Math.max(4, Math.ceil(max / 4) * 4)]}
            />
            <Tooltip
              content={<TooltipSemana />}
              cursor={{ fill: "var(--chakra-colors-gray-50)" }}
            />
            <Bar
              dataKey="iniciados"
              name="Iniciados"
              fill={COLOR_INICIADOS}
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              animationDuration={500}
            />
            <Bar
              dataKey="resueltos"
              name="Resueltos"
              fill={COLOR_RESUELTOS}
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box as="table" srOnly>
        <caption>Incidentes iniciados y resueltos por semana</caption>
        <thead>
          <tr>
            <th>Semana</th>
            <th>Iniciados</th>
            <th>Resueltos</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((p) => (
            <tr key={p.clave}>
              <td>{p.etiqueta}</td>
              <td>{p.iniciados}</td>
              <td>{p.resueltos}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

function Leyenda({ color, texto, total }: { color: string; texto: string; total: number }) {
  return (
    <HStack gap="2">
      <Box as="span" w="2.5" h="2.5" rounded="full" bg={color} flexShrink={0} aria-hidden />
      <Text as="span" fontSize="sm" color="fg.muted" whiteSpace="nowrap">
        {texto}{" "}
        <Text as="span" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
          {total}
        </Text>
      </Text>
    </HStack>
  );
}
