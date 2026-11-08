import { Box, Text } from "@chakra-ui/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatoCantidad } from "../../../common/utils/numeros";
import type { ProduccionPorProducto } from "../types/lote";

/*
 * Un solo color para todas las barras.
 *
 * Antes cada producto tenía su propio color (cinco tonos de teal y azul): el
 * color sugería una categoría distinta que no existía, porque el gráfico
 * compara una sola medida. El teal de marca alcanza; el producto lo dice el eje.
 */
const COLOR_BARRA = "var(--chakra-colors-brand-500)";
const COLOR_TEXTO = "var(--chakra-colors-gray-600)";
/** Alto mínimo: la tarjeta lo estira para emparejar la columna del panel. */
const ALTO_MINIMO = 240;
/** Más largo que esto se corta con "…" en el eje; el nombre entero va en el tooltip. */
const MAX_ETIQUETA = 14;

interface GraficoProduccionProps {
  datos: ProduccionPorProducto[];
}

function etiquetaCorta(texto: string) {
  return texto.length > MAX_ETIQUETA ? `${texto.slice(0, MAX_ETIQUETA - 1).trimEnd()}…` : texto;
}

function TooltipProduccion({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload?: ProduccionPorProducto }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  const punto = payload[0]?.payload;

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="md"
      boxShadow="card"
      px="3"
      py="2"
    >
      <Text fontSize="xs" fontWeight="semibold" color="fg" mb="1">
        {label}
      </Text>
      <Text fontSize="xs" color="fg.muted">
        Producido: <b>{formatoCantidad(payload[0]?.value as number)}</b>
      </Text>
      {punto ? (
        <Text fontSize="xs" color="fg.muted">
          Lotes: <b>{formatoCantidad(punto.cantidad_lotes)}</b>
        </Text>
      ) : null}
    </Box>
  );
}

export function GraficoProduccion({ datos }: GraficoProduccionProps) {
  const resumen = `Producción por producto: ${datos
    .map((punto) => `${punto.producto} ${formatoCantidad(punto.cantidad_producida)}`)
    .join(", ")}.`;

  /*
   * Etiquetas inclinadas cuando no entran derechas: con cinco productos de
   * nombre largo ("Alfajor de maicena Clásica") ya se pisaban entre sí.
   */
  const inclinar = datos.length > 4 || datos.some((p) => p.producto.length > MAX_ETIQUETA);

  return (
    <Box w="full" flex="1" minH={`${ALTO_MINIMO}px`} role="img" aria-label={resumen}>
      <ResponsiveContainer width="100%" height="100%" minHeight={ALTO_MINIMO}>
        <BarChart
          data={datos}
          margin={{ top: 20, right: 8, bottom: 8, left: 0 }}
          barCategoryGap="24%"
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--chakra-colors-gray-100)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="producto"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COLOR_TEXTO }}
            tickFormatter={etiquetaCorta}
            interval={0}
            angle={inclinar ? -30 : 0}
            textAnchor={inclinar ? "end" : "middle"}
            height={inclinar ? 64 : 30}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COLOR_TEXTO }}
            tickFormatter={(valor: number) => formatoCantidad(valor)}
            tickCount={5}
            width={48}
          />
          <Tooltip content={<TooltipProduccion />} cursor={{ fill: "var(--chakra-colors-brand-50)" }} />
          <Bar
            dataKey="cantidad_producida"
            name="Cantidad producida"
            fill={COLOR_BARRA}
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          >
            <LabelList
              dataKey="cantidad_producida"
              position="top"
              fontSize={12}
              fill={COLOR_TEXTO}
              formatter={(valor: unknown) =>
                Number(valor) > 0 ? formatoCantidad(Number(valor)) : ""
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
