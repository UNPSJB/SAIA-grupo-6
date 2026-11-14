import { useMemo } from "react";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  listarStockInsumos,
  listarStockLotes,
} from "../../../lotesInsumo/services/loteInsumoService";
import type { StockInsumo, StockLoteInsumo } from "../../../lotesInsumo/types/loteInsumo";
import { listarProveedores } from "../../../proveedores/services/proveedorService";
import type { Proveedor } from "../../../proveedores/types/proveedor";
import { useBloque } from "../../hooks/useBloque";
import {
  DIAS_PERIODO,
  FILAS_LISTA,
  contarPor,
  diasHasta,
  estadoPlazo,
} from "../../types/panelCategoria";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  GrillaIndicadores,
  Indicador,
  ListaPanel,
  VerTodos,
} from "../piezasPanel";

const cargarStock = () => listarStockInsumos();
const cargarLotes = () => listarStockLotes();
const cargarProveedores = () => listarProveedores();

/**
 * Panel de Inventario: si hay materia prima para producir (insumos sin
 * stock), qué se está por perder (lotes por vencer o vencidos con saldo) y de
 * quién se recibe.
 *
 * No hay un gráfico de "stock por insumo": cada insumo se mide en su unidad
 * (kg, litros, unidades) y ponerlos en una misma escala compararía cosas que
 * no se comparan.
 */
export function PanelInventario() {
  const stock = useBloque<StockInsumo[]>(cargarStock, [], "No se pudo cargar el stock de insumos");
  const lotes = useBloque<StockLoteInsumo[]>(cargarLotes, [], "No se pudieron cargar los lotes recibidos");
  const proveedores = useBloque<Proveedor[]>(
    cargarProveedores,
    [],
    "No se pudieron cargar los proveedores",
  );

  const sinStock = stock.datos.filter((s) => Number(s.stock) <= 0);
  const conVencido = stock.datos.filter((s) => Number(s.stock_vencido) > 0).length;

  const vencimientos = useMemo(() => {
    // Solo lotes que todavía tienen saldo: uno vencido y ya consumido no pide nada.
    const conSaldo = lotes.datos
      .filter((l) => l.activo && Number(l.saldo) > 0 && l.fecha_vencimiento !== null)
      .map((l) => ({ lote: l, dias: diasHasta(l.fecha_vencimiento as string) }))
      .sort((a, b) => a.dias - b.dias);
    return {
      vencidos: conSaldo.filter((x) => x.dias < 0).length,
      porVencer: conSaldo.filter((x) => x.dias >= 0 && x.dias <= DIAS_PERIODO).length,
      proximos: conSaldo.filter((x) => x.dias <= DIAS_PERIODO),
    };
  }, [lotes.datos]);

  const porProveedor = useMemo(
    () => contarPor(lotes.datos.filter((l) => l.activo), (l) => l.proveedor_nombre),
    [lotes.datos],
  );

  return (
    <>
      <GrillaIndicadores>
        <Indicador
          titulo="Insumos con stock"
          valor={stock.datos.length - sinStock.length}
          detalle={`De ${stock.datos.length} insumos`}
          to="/stock-insumos"
          loading={stock.loading}
          error={stock.error}
        />
        <Indicador
          titulo="Insumos sin stock"
          valor={sinStock.length}
          detalle={sinStock.length > 0 ? "No se pueden usar en un lote" : "Ninguno en falta"}
          tono={sinStock.length > 0 ? "peligro" : undefined}
          loading={stock.loading}
          error={stock.error}
        />
        <Indicador
          titulo="Lotes por vencer"
          valor={vencimientos.porVencer}
          detalle={`Con saldo, en los próximos ${DIAS_PERIODO} días`}
          tono={vencimientos.porVencer > 0 ? "alerta" : undefined}
          loading={lotes.loading}
          error={lotes.error}
        />
        <Indicador
          titulo="Lotes vencidos con saldo"
          valor={vencimientos.vencidos}
          detalle={
            conVencido > 0
              ? `Afecta a ${conVencido} ${conVencido === 1 ? "insumo" : "insumos"}`
              : "Sin stock vencido"
          }
          tono={vencimientos.vencidos > 0 ? "peligro" : undefined}
          loading={lotes.loading || stock.loading}
          error={lotes.error}
        />
        <Indicador
          titulo="Proveedores activos"
          valor={proveedores.datos.filter((p) => p.activo).length}
          to="/proveedores"
          loading={proveedores.loading}
          error={proveedores.error}
        />
      </GrillaIndicadores>

      <GrillaBloques>
        <Bloque
          titulo="Lotes por vencer o vencidos"
          descripcion={`Lotes recibidos con saldo, ya vencidos o que vencen dentro de ${DIAS_PERIODO} días`}
          loading={lotes.loading}
          error={lotes.error}
          vacio={vencimientos.proximos.length === 0 && "No hay lotes por vencer en el período."}
        >
          <ListaPanel
            filas={vencimientos.proximos.slice(0, FILAS_LISTA).map(({ lote, dias }) => ({
              clave: lote.lote_insumo_id,
              titulo: `${lote.insumo_nombre} · lote ${lote.numero_lote}`,
              detalle: `${lote.proveedor_nombre} · vence el ${formatoFecha(lote.fecha_vencimiento)}`,
              estado: estadoPlazo(dias),
            }))}
          />
          <VerTodos to="/stock-insumos">Ver el stock de insumos</VerTodos>
        </Bloque>

        <Bloque
          titulo="Insumos sin stock"
          descripcion="Insumos que hoy no tienen saldo disponible"
          loading={stock.loading}
          error={stock.error}
          vacio={sinStock.length === 0 && "Todos los insumos tienen stock."}
        >
          <ListaPanel
            filas={sinStock.slice(0, FILAS_LISTA).map((s) => ({
              clave: s.insumo_id,
              titulo: s.insumo_nombre,
              detalle: `Recibido en total: ${cantidadConUnidad(s.cantidad_recibida, s.unidad)}`,
              estado: { tono: "peligro" as const, texto: "Sin stock" },
            }))}
          />
        </Bloque>

        <Bloque
          titulo="Lotes recibidos por proveedor"
          descripcion="Cantidad de lotes de insumo activos de cada proveedor"
          loading={lotes.loading}
          error={lotes.error}
          vacio={porProveedor.length === 0 && "Todavía no se recibieron lotes."}
        >
          <BarrasHorizontales datos={porProveedor.slice(0, 8)} unidad="lotes" />
        </Bloque>
      </GrillaBloques>
    </>
  );
}
