import { LuPackage, LuTimer, LuTruck } from "react-icons/lu";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { usePanel } from "../../hooks/usePanel";
import {
  plural,
  sinValores,
  textoGranularidad,
  textoPeriodo,
  type PanelInventario as DatosInventario,
} from "../../types/paneles";
import { GraficoDona, GraficoSerie } from "../graficos";
import { COLOR_ESTADO, COLOR_SERIE, conColor, serieVacia } from "../../types/coloresGraficos";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  ListaPanel,
  MarcoPanel,
  MetricasBloque,
  VerTodos,
} from "../piezasPanel";

const TIPOS_INSUMO = [
  { valor: "ingrediente", etiqueta: "Ingredientes" },
  { valor: "aditivo", etiqueta: "Aditivos" },
];

const SERIES_MOVIMIENTOS = [
  { clave: "ingresos", etiqueta: "Lotes recibidos", color: COLOR_SERIE.azul },
  { clave: "consumos", etiqueta: "Consumos", color: COLOR_SERIE.aqua },
  { clave: "desperdicios", etiqueta: "Desperdicios", color: COLOR_SERIE.naranja },
];

const COLOR_STOCK = {
  con_stock: COLOR_ESTADO.ok,
  con_vencido: COLOR_ESTADO.alerta,
  sin_stock: COLOR_ESTADO.peligro,
};

/**
 * Panel de Inventario: con qué materia prima se cuenta, qué se está por
 * vencer y cuánto se mueve el depósito.
 *
 * Los movimientos se cuentan en registros y no en cantidades: cada insumo
 * tiene su unidad (kg, l, un) y sumarlas entre insumos no significa nada.
 */
export function PanelInventario() {
  const panel = usePanel<DatosInventario>("inventario", "tipo");
  const periodo = textoPeriodo(panel.dias);

  return (
    <MarcoPanel
      panel={panel}
      filtro={{ label: "Tipo de insumo", todos: "Todos los tipos", opciones: TIPOS_INSUMO }}
    >
      {(d) => (
        <>
          <GrillaBloques principal>
            <Bloque
              titulo="Entradas y salidas del depósito"
              descripcion={`Lotes recibidos, consumos en producción y desperdicios ${textoGranularidad(d.serie_movimientos)}, en cantidad de registros`}
              vacio={
                serieVacia(d.serie_movimientos, ["ingresos", "consumos", "desperdicios"]) &&
                "No hubo movimientos en el período."
              }
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "insumos",
                      etiqueta: "Insumos activos",
                      valor: formatoCantidad(d.insumos_activos),
                      icono: LuPackage,
                      detalle: `${plural(d.insumos_sin_stock, "sin stock", "sin stock")}`,
                    },
                    {
                      clave: "por_vencer",
                      etiqueta: "Lotes por vencer",
                      valor: formatoCantidad(d.lotes_por_vencer),
                      icono: LuTimer,
                      detalle: `En 7 días o menos · ${plural(d.lotes_vencidos, "vencido", "vencidos")}`,
                    },
                  ]}
                />
              }
            >
              <GraficoSerie
                serie={d.serie_movimientos}
                series={SERIES_MOVIMIENTOS}
                resumen="Lotes de insumo recibidos, consumos y desperdicios por período"
                llenar
              />
            </Bloque>

            <Bloque
              titulo="Estado general del stock"
              descripcion="Insumos activos según el stock que tienen hoy"
              vacio={sinValores(d.estado_stock) && "No hay insumos activos."}
            >
              <GraficoDona partes={conColor(d.estado_stock, COLOR_STOCK)} unidad="insumos" />
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Lotes que vencen primero"
              descripcion="Con saldo, del más urgente al más lejano"
              vacio={d.vencen_primero.length === 0 && "No hay lotes con fecha de vencimiento."}
            >
              <ListaPanel filas={d.vencen_primero} acento />
              <VerTodos to="/stock-insumos">Ver el stock de insumos</VerTodos>
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Insumos con más movimiento"
              descripcion={`Consumos registrados en producción en los ${periodo}`}
              vacio={d.mas_movimiento.length === 0 && "No se registraron consumos en el período."}
            >
              <BarrasHorizontales datos={d.mas_movimiento} mostrar="detalle" />
            </Bloque>

            <Bloque
              titulo="Recepciones por proveedor"
              descripcion={`Lotes de insumo recibidos en los ${periodo}`}
              vacio={
                d.recepciones_por_proveedor.length === 0 && "No se recibieron lotes en el período."
              }
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "recibidos",
                      etiqueta: "Lotes recibidos",
                      valor: formatoCantidad(d.lotes_recibidos),
                      icono: LuTruck,
                      detalle: `De ${plural(d.proveedores_activos, "proveedor activo", "proveedores activos")}`,
                    },
                  ]}
                />
              }
            >
              <BarrasHorizontales
                datos={d.recepciones_por_proveedor.map((c) => ({
                  ...c,
                  detalle: plural(c.valor, "lote", "lotes"),
                }))}
                mostrar="detalle"
              />
              <VerTodos to="/proveedores">Ver los proveedores</VerTodos>
            </Bloque>
          </GrillaBloques>
        </>
      )}
    </MarcoPanel>
  );
}
