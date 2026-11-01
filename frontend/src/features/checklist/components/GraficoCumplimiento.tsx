import { Box, Text } from "@chakra-ui/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoDiario } from "../types/cumplimiento";

const COLOR_LINEA = "var(--chakra-colors-brand-500)";
const COLOR_TEXTO = "var(--chakra-colors-gray-600)";

interface GraficoCumplimientoProps {
  datos: PuntoDiario[];
  /** Alto en píxeles. El ancho lo toma del contenedor. */
  alto?: number;
}

/** `2026-11-05` -> `05/11/2026`. */
function fechaLarga(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Tooltip: la fecha, el porcentaje y las tareas que lo explican. */
function TooltipDia({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PuntoDiario }>;
}) {
  const punto = payload?.[0]?.payload;
  if (!active || !punto || punto.porcentaje === null) return null;

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
        {fechaLarga(punto.fecha)}
      </Text>
      <Text fontSize="xs" color="fg.muted">
        <b>{punto.porcentaje}%</b> · {punto.cumplidas} de {punto.total} tareas
      </Text>
    </Box>
  );
}

/**
 * Evolución del porcentaje de cumplimiento de limpieza, día por día.
 *
 * Los días sin tareas no se dibujan como 0%: la línea los salta y une los
 * puntos que sí tienen datos. Cada punto es un día con checklist.
 */
export function GraficoCumplimiento({ datos, alto = 320 }: GraficoCumplimientoProps) {
  return (
    <Box
      w="full"
      h={`${alto}px`}
      role="img"
      aria-label="Evolución del porcentaje diario de cumplimiento de limpieza en el período elegido"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--chakra-colors-gray-100)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="etiqueta"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COLOR_TEXTO }}
            dy={4}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            width={42}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(valor: number) => `${valor}%`}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COLOR_TEXTO }}
          />
          <Tooltip
            content={<TooltipDia />}
            cursor={{ stroke: "var(--chakra-colors-gray-300)", strokeDasharray: "4 4" }}
          />
          <Line
            type="monotone"
            dataKey="porcentaje"
            name="Cumplimiento"
            stroke={COLOR_LINEA}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR_LINEA, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}