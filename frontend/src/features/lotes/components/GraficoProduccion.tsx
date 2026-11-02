import { Box, HStack, Text } from "@chakra-ui/react";
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
import type { ProduccionPorProducto } from "../types/lote";

const COLOR_BARRAS = "var(--chakra-colors-brand-500)";
const COLOR_TEXTO = "var(--chakra-colors-gray-600)";
const ALTO = 240;

interface GraficoProduccionProps {
  datos: ProduccionPorProducto[];
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
        Producido: <b>{String(payload[0]?.value ?? 0)}</b>
      </Text>
      {punto ? (
        <Text fontSize="xs" color="fg.muted">
          Lotes: <b>{punto.cantidad_lotes}</b>
        </Text>
      ) : null}
    </Box>
  );
}

export function GraficoProduccion({ datos }: GraficoProduccionProps) {
  const resumen = `Producción por producto: ${datos
    .map((punto) => `${punto.producto} ${punto.cantidad_producida}`)
    .join(", ")}.`;

  return (
    <Box w="full" h={`${ALTO}px`} role="img" aria-label={resumen}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          margin={{ top: 20, right: 8, bottom: 8, left: -10 }}
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
            interval={0}
            angle={datos.length > 6 ? -25 : 0}
            textAnchor={datos.length > 6 ? "end" : "middle"}
            height={datos.length > 6 ? 60 : 30}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COLOR_TEXTO }}
            tickCount={5}
          />
          <Tooltip content={<TooltipProduccion />} cursor={{ fill: "var(--chakra-colors-brand-50)" }} />
          <Bar
            dataKey="cantidad_producida"
            name="Cantidad producida"
            fill={COLOR_BARRAS}
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          >
            <LabelList
              dataKey="cantidad_producida"
              position="top"
              fontSize={12}
              fill={COLOR_TEXTO}
              formatter={(valor: unknown) =>
                Number(valor) > 0 ? String(valor) : ""
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <HStack justify="center" mt="1">
        <Text fontSize="xs" color="fg.muted">
          Cantidad producida por producto en el período seleccionado
        </Text>
      </HStack>
    </Box>
  );
}
