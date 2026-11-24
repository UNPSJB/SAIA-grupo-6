import { Table, Text } from "@chakra-ui/react";
import { useState } from "react";
import { IngredienteItem } from "./IngredienteItem";
import { ResumenIngredienteDialog } from "./ResumenIngredienteDialog";
import type { Ingrediente } from "../types/ingrediente";
import type { ColumnaOrdenIngrediente } from "../services/ingredienteService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface IngredienteTableProps {
  ingredientes: Ingrediente[];
  orden: OrdenTabla<ColumnaOrdenIngrediente, string>;
  onEdit: (ingrediente: Ingrediente) => void;
  onDelete: (ingrediente: Ingrediente) => void;
  onReactivar: (ingrediente: Ingrediente) => void;
  onNutricion: (ingrediente: Ingrediente) => void;
}

export function IngredienteTable({
  ingredientes,
  orden,
  onEdit,
  onDelete,
  onReactivar,
  onNutricion,
}: IngredienteTableProps) {
  const [resumenId, setResumenId] = useState<number | null>(null);
  const resumen = ingredientes.find((ingrediente) => ingrediente.id === resumenId);

  if (ingredientes.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay ingredientes para mostrar.</Text>
      </Tarjeta>
    );
  }

  return (
    <>
      <Tarjeta overflowX="auto">
        <Table.Root variant="outline" w="100%" minW="980px">
          <Table.Header>
            <FilaEncabezado>
              <EncabezadoOrdenable columna="nombre" orden={orden}>
                Nombre
              </EncabezadoOrdenable>
              <EncabezadoOscuro width="12%">Aditivo</EncabezadoOscuro>
              <EncabezadoOrdenable columna="unidad" orden={orden} ancho="media" center>
                Unidad Medida
              </EncabezadoOrdenable>
              <EncabezadoOscuro numero width="10%">Densidad g/ml</EncabezadoOscuro>
              <EncabezadoOscuro numero width="10%">Peso unitario g</EncabezadoOscuro>
              <EncabezadoOscuro width="18%">Proveedores</EncabezadoOscuro>
              <EncabezadoOscuro center minW="180px">
                Acciones
              </EncabezadoOscuro>
            </FilaEncabezado>
          </Table.Header>
          <Table.Body>
            {ingredientes.map((ingrediente) => (
              <IngredienteItem
                key={ingrediente.id}
                ingrediente={ingrediente}
                onEdit={onEdit}
                onDelete={onDelete}
                onReactivar={onReactivar}
                onNutricion={onNutricion}
                onResumen={setResumenId}
              />
            ))}
          </Table.Body>
        </Table.Root>
      </Tarjeta>
      {resumen && (
        <ResumenIngredienteDialog
          key={resumen.id}
          ingrediente={resumen}
          onCerrar={() => setResumenId(null)}
          onNutricion={() => { setResumenId(null); onNutricion(resumen); }}
        />
      )}
    </>
  );
}
