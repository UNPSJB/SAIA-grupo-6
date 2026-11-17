import { Box } from "@chakra-ui/react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatoPorcentajeFino } from "../../../common/utils/numeros";
import type { Composicion } from "../types/receta";

const COLORES = ["#2f6f4f", "#4a90a4", "#d9a441", "#b5623e", "#7a5c99", "#8a9a5b", "#6b7280"];

export function GraficoComposicion({ composicion, alto = 320 }: { composicion: Composicion; alto?: number }) {
  const totalAditivos = composicion.aditivos.reduce((s, a) => s + Number(a.porcentaje), 0);
  const datos = [
    ...composicion.ingredientes.map((i) => ({ nombre: i.insumo.nombre, valor: Number(i.porcentaje) })),
    ...(totalAditivos > 0 ? [{ nombre: "Aditivos", valor: totalAditivos }] : []),
  ];

  return (
    <Box
      w="full"
      h={`${alto}px`}
      role="img"
      aria-label="Gráfico de torta con el porcentaje de cada ingrediente y de los aditivos en conjunto"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="nombre" innerRadius={60} outerRadius={100}>
            {datos.map((_, i) => (
              <Cell key={i} fill={COLORES[i % COLORES.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatoPorcentajeFino(Array.isArray(v) ? v[0] : v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}