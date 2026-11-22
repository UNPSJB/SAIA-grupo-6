import { useId } from "react";
import { Box, Text } from "@chakra-ui/react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { esPeriodoDeUnMes, useFechasEje } from "../../dashboard/components/ejeFechas";
import type { PuntoDiario } from "../types/cumplimiento";

/** brand.500 en hex (igual en claro y oscuro): el degradado del área (`<stop>`) necesita un color literal. */
const COLOR_LINEA = "#468189";
const COLOR_TEXTO = "var(--chakra-colors-fg-muted)";

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
  // Id del degradado, único por gráfico.
  const idDegradado = `cumplimiento-${useId().replace(/:/g, "")}`;
  const { ref: refEjeFechas, ticks: ticksFechas, tick: tickFecha } = useFechasEje(
    datos.map((d) => d.etiqueta),
    10,
    COLOR_TEXTO,
    datos.map((d) => d.fecha),
  );
  return (
    <Box
      ref={refEjeFechas}
      w="full"
      h={`${alto}px`}
      role="img"
      aria-label="Evolución del porcentaje diario de cumplimiento de limpieza en el período elegido"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={datos}
          // En diagonal, las fechas de las puntas asoman unos píxeles: margen extra.
          margin={
            esPeriodoDeUnMes(datos.length)
              ? { top: 8, right: 16, bottom: 4, left: 10 }
              : { top: 8, right: 22, bottom: 0, left: 6 }
          }
        >
          {/* Curva suavizada con un degradado debajo, como las áreas de los paneles. */}
          <defs>
            <linearGradient id={idDegradado} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_LINEA} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLOR_LINEA} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chakra-colors-bg-muted)" strokeDasharray="4 4" />
          {/* Período de 30 días: fechas en diagonal y todas visibles. En los
              demás períodos, derechas y salteando las que no entran. */}
          {esPeriodoDeUnMes(datos.length) ? (
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: COLOR_TEXTO }}
              angle={-45}
              textAnchor="end"
              height={48}
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
              tickMargin={4}
              interval={0}
            />
          )}
          <YAxis
            width={42}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(valor: number) => `${valor}%`}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: COLOR_TEXTO }}
          />
          <Tooltip
            content={<TooltipDia />}
            cursor={{ stroke: "var(--chakra-colors-border-emphasized)", strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="porcentaje"
            name="Cumplimiento"
            stroke={COLOR_LINEA}
            strokeWidth={2.25}
            fill={`url(#${idDegradado})`}
            fillOpacity={1}
            dot={{ r: 3, fill: COLOR_LINEA, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}
