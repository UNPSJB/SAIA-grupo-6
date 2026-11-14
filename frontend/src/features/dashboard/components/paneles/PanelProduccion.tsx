import { useMemo } from "react";
import { Box } from "@chakra-ui/react";
import { haceDiasISO } from "../../../../common/utils/fechas";
import { TarjetaProduccion } from "../../../lotes/components/TarjetaProduccion";
import { listarLotes } from "../../../lotes/services/loteService";
import type { LoteResumen } from "../../../lotes/types/lote";
import { listarProductos } from "../../../productos/services/productoService";
import type { Producto } from "../../../productos/types/producto";
import { listarRecetas } from "../../../recetas/services/recetaService";
import type { Receta } from "../../../recetas/types/receta";
import { useBloque } from "../../hooks/useBloque";
import { DIAS_PERIODO, FILAS_LISTA, contarPor } from "../../types/panelCategoria";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  GrillaIndicadores,
  Indicador,
  ListaPanel,
  VerTodos,
} from "../piezasPanel";

const cargarLotes = () => listarLotes();
const cargarRecetas = () => listarRecetas();
const cargarProductos = () => listarProductos();

/**
 * Panel de Producción: en qué está la planta hoy (lotes en proceso), qué se
 * terminó en el último mes y si el catálogo está completo (productos sin
 * receta). Los productos y las cantidades producidas son de administración.
 */
export function PanelProduccion({ administra }: { administra: boolean }) {
  const lotes = useBloque<LoteResumen[]>(cargarLotes, [], "No se pudieron cargar los lotes");
  const recetas = useBloque<Receta[]>(cargarRecetas, [], "No se pudieron cargar las recetas");
  const productos = useBloque<Producto[]>(
    cargarProductos,
    [],
    "No se pudieron cargar los productos",
    administra,
  );

  const resumen = useMemo(() => {
    const desde = haceDiasISO(DIAS_PERIODO);
    const enProceso = lotes.datos.filter((l) => l.estado === "en_proceso");
    const cerradosEnPeriodo = lotes.datos.filter(
      (l) => l.fecha_cierre !== null && l.fecha_cierre.slice(0, 10) >= desde,
    );
    const terminados = cerradosEnPeriodo.filter((l) => l.estado === "terminado");
    return {
      enProceso,
      terminados,
      cancelados: cerradosEnPeriodo.filter((l) => l.estado === "cancelado").length,
      porProducto: contarPor(terminados, (l) => l.producto_nombre),
    };
  }, [lotes.datos]);

  const recetasActivas = recetas.datos.filter((r) => r.activo);
  const sinVersion = recetasActivas.filter((r) => r.version_vigente === null).length;

  const productosActivos = productos.datos.filter((p) => p.activo);
  const conReceta = new Set(recetasActivas.map((r) => r.producto_id));
  const sinReceta = productosActivos.filter((p) => !conReceta.has(p.id)).length;

  return (
    <>
      <GrillaIndicadores>
        <Indicador
          titulo="Lotes en proceso"
          valor={resumen.enProceso.length}
          detalle="Iniciados y sin cerrar"
          to="/lotes"
          loading={lotes.loading}
          error={lotes.error}
        />
        <Indicador
          titulo="Lotes terminados"
          valor={resumen.terminados.length}
          detalle={`Últimos ${DIAS_PERIODO} días`}
          loading={lotes.loading}
          error={lotes.error}
        />
        <Indicador
          titulo="Lotes cancelados"
          valor={resumen.cancelados}
          detalle={`Últimos ${DIAS_PERIODO} días`}
          tono={resumen.cancelados > 0 ? "alerta" : undefined}
          loading={lotes.loading}
          error={lotes.error}
        />
        <Indicador
          titulo="Recetas activas"
          valor={recetasActivas.length}
          detalle={sinVersion > 0 ? `${sinVersion} sin versión vigente` : "Todas con versión vigente"}
          to="/recetas"
          loading={recetas.loading}
          error={recetas.error}
        />
        {administra && (
          <Indicador
            titulo="Productos activos"
            valor={productosActivos.length}
            detalle={sinReceta > 0 ? `${sinReceta} sin receta` : "Todos con receta"}
            tono={sinReceta > 0 ? "alerta" : undefined}
            to="/productos"
            loading={productos.loading || recetas.loading}
            error={productos.error}
          />
        )}
      </GrillaIndicadores>

      <GrillaBloques>
        <Bloque
          titulo="Lotes en proceso"
          descripcion="Avance del checklist de producción de cada lote abierto"
          loading={lotes.loading}
          error={lotes.error}
          vacio={resumen.enProceso.length === 0 && "No hay lotes en proceso."}
        >
          <ListaPanel
            filas={resumen.enProceso.slice(0, FILAS_LISTA).map((l) => ({
              clave: l.id,
              titulo: `${l.numero_lote} · ${l.producto_nombre}`,
              detalle: l.creado_por_nombre ? `Iniciado por ${l.creado_por_nombre}` : undefined,
              estado: {
                tono: l.items_total > 0 && l.items_completados === l.items_total ? "ok" : "info",
                texto: `${l.items_completados}/${l.items_total} tareas`,
              },
              to: `/lotes/${l.id}`,
            }))}
          />
          <VerTodos to="/lotes">Ver todos los lotes</VerTodos>
        </Bloque>

        <Bloque
          titulo="Lotes terminados por producto"
          descripcion={`Cantidad de lotes cerrados en los últimos ${DIAS_PERIODO} días`}
          loading={lotes.loading}
          error={lotes.error}
          vacio={resumen.porProducto.length === 0 && "No se terminaron lotes en el período."}
        >
          <BarrasHorizontales datos={resumen.porProducto} unidad="lotes" />
        </Bloque>
      </GrillaBloques>

      {/* Cantidades producidas: el endpoint es de administración. */}
      {administra && (
        <Box mt="6">
          <TarjetaProduccion />
        </Box>
      )}
    </>
  );
}
