import { Box, HStack, Text } from "@chakra-ui/react";
import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoSerie } from "../types/dashboard";

// Rojo = abierto, verde = resuelto: el mismo código que los badges de estado.
// Tokens del tema: el gráfico sigue a la paleta igual que el resto de la app.
const COLOR_INICIADOS = "var(--chakra-colors-red-500)";
const COLOR_RESUELTOS = "var(--chakra-colors-green-600)";
const COLOR_TEXTO = "var(--chakra-colors-gray-600)";

/** Alto del gráfico. El ancho lo toma de la tarjeta. */
const ALTO = 210;

interface GraficoBarrasProps {
  datos: PuntoSerie[];
}

/**
 * Incidentes iniciados contra resueltos, por semana.
 *
 * Usa `recharts` en vez del SVG a mano que tenía antes: la librería resuelve
 * sola la escala del eje, las líneas de guía y la
 * animación de entrada, y escala con la tarjeta (`ResponsiveContainer`).
 *
 * Los colores van como variables CSS de Chakra: `fill` es un atributo SVG y
 * acepta `var(...)`, así el gráfico sigue al tema. Las barras llevan un
 * degradado suave (más claro arriba) y esquinas superiores redondeadas, y el
 * valor va escrito arriba de cada una porque con cifras chicas (1, 0, 2) la
 * altura sola no se distingue.
 *
 * Los `id` de los degradados salen de `useId`: si hubiera dos gráficos en la
 * misma página, con un `id` fijo el segundo tomaría el degradado del primero.
 */
export function GraficoBarras({ datos }: GraficoBarrasProps) {
  const base = useId().replace(/:/g, "");
  const idIniciados = `${base}-iniciados`;
  const idResueltos = `${base}-resueltos`;

  const resumen = `Incidentes del mes por semana: ${datos
    .map((p) => `${p.etiqueta} ${p.iniciados} iniciados y ${p.resueltos} resueltos`)
    .join(", ")}.`;

  return (
    <Box>
      <Box w="full" h={`${ALTO}px`} role="img" aria-label={resumen}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={datos}
            margin={{ top: 18, right: 8, bottom: 0, left: 0 }}
            barGap={3}
            barCategoryGap="28%"
          >
            <defs>
              <linearGradient id={idIniciados} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_INICIADOS} stopOpacity={0.75} />
                <stop offset="100%" stopColor={COLOR_INICIADOS} stopOpacity={1} />
              </linearGradient>
              <linearGradient id={idResueltos} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_RESUELTOS} stopOpacity={0.75} />
                <stop offset="100%" stopColor={COLOR_RESUELTOS} stopOpacity={1} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="var(--chakra-colors-gray-200)"
              strokeOpacity={0.7}
              strokeDasharray="3 5"
            />

            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: COLOR_TEXTO }}
              dy={4}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={30}
              tickMargin={4}
              tick={{ fontSize: 12, fill: COLOR_TEXTO }}
              tickCount={5}
              domain={[0, (max: number) => Math.max(4, Math.ceil(max / 4) * 4)]}
            />

            <Bar
              dataKey="iniciados"
              name="Iniciados"
              fill={`url(#${idIniciados})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
              animationDuration={600}
              isAnimationActive
            >
              <LabelList
                dataKey="iniciados"
                position="top"
                fontSize={12}
                fontWeight={600}
                fill={COLOR_INICIADOS}
                formatter={(valor: unknown) => (Number(valor) > 0 ? String(valor) : "")}
              />
            </Bar>
            <Bar
              dataKey="resueltos"
              name="Resueltos"
              fill={`url(#${idResueltos})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
              animationDuration={600}
            >
              <LabelList
                dataKey="resueltos"
                position="top"
                fontSize={12}
                fontWeight={600}
                fill={COLOR_RESUELTOS}
                formatter={(valor: unknown) => (Number(valor) > 0 ? String(valor) : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <HStack justify="center" gap="5" mt="2" flexWrap="wrap">
        <Leyenda color={COLOR_INICIADOS} texto="Iniciados" />
        <Leyenda color={COLOR_RESUELTOS} texto="Resueltos" />
      </HStack>
    </Box>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <HStack gap="2">
      <Box as="span" w="3" h="3" rounded="sm" bg={color} flexShrink={0} aria-hidden />
      <Text as="span" fontSize="xs" color="fg.muted" whiteSpace="nowrap">
        {texto}
      </Text>
    </HStack>
  );
}
