import { Box } from "@chakra-ui/react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatoPorcentajeFino } from "../../../common/utils/numeros";
import type { Composicion } from "../types/receta";

const COLORES = ["#b5623e", "#7a5c99", "#4a90a4", "#d9a441", "#2f6f4f", "#8a9a5b", "#6b7280"];

export function GraficoAditivos({ composicion, alto = 320 }: { composicion: Composicion; alto?: number }) {
  if (composicion.aditivos.length === 0) return null;

  const datos = composicion.aditivos.map((a) => ({
    nombre: a.insumo.nombre,
    valor: Number(a.porcentaje),
  }));

  return (
    <Box
      w="full"
      h={`${alto}px`}
      role="img"
      aria-label="Gráfico de torta con el porcentaje de cada aditivo"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="nombre" innerRadius={60} outerRadius={100}>
            {datos.map((_, i) => (
              <Cell key={i} fill={COLORES[i % COLORES.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) =>
              `${formatoPorcentajeFino(Array.isArray(v) ? v[0] : v)} de la formulación`
            }
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}