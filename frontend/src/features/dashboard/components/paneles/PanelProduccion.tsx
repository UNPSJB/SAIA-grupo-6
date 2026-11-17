import { Text } from "@chakra-ui/react";
import { LuCircleCheckBig, LuFactory, LuScale } from "react-icons/lu";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { usePanel } from "../../hooks/usePanel";
import {
  plural,
  sinValores,
  textoGranularidad,
  textoPeriodo,
  type PanelProduccion as DatosProduccion,
} from "../../types/paneles";
import { GraficoDona, GraficoPaleta, GraficoSerie } from "../graficos";
import { ProduccionDiaria } from "../ProduccionDiaria";
import {
  COLOR_CALIDO,
  COLOR_ESTADO,
  COLOR_SERIE,
  conColor,
  serieVacia,
} from "../../types/coloresGraficos";
import {
  Bloque,
  GrillaBloques,
  ListaPanel,
  ListaPendientes,
  MarcoPanel,
  MetricasBloque,
  VerTodos,
  type Metrica,
} from "../piezasPanel";

const SERIES_LOTES = [
  { clave: "iniciados", etiqueta: "Iniciados", color: COLOR_SERIE.azul },
  { clave: "terminados", etiqueta: "Terminados", color: COLOR_SERIE.aqua },
];

const SERIES_SALIDAS = [
  { clave: "salidas", etiqueta: "Salidas registradas", color: COLOR_SERIE.azul },
  { clave: "retiros", etiqueta: "Retiros iniciados", color: COLOR_SERIE.naranja },
];

/** Los estados de un lote o de una salida son un semáforo: colores de estado. */
const SERIES_ESTADO_LOTE = [
  { clave: "terminado", etiqueta: "Terminados", color: COLOR_ESTADO.ok },
  { clave: "en_proceso", etiqueta: "En proceso", color: COLOR_ESTADO.info },
  { clave: "cancelado", etiqueta: "Cancelados", color: COLOR_ESTADO.neutro },
];

/*
 * Salidas: tonos cálidos de la marca. Del más claro (recién reservada) al
 * salvia (entregada); terracota para la rechazada y piedra para la cancelada.
 */
const COLOR_SALIDA = {
  RESERVADO: COLOR_CALIDO.crema,
  DESPACHADO: COLOR_CALIDO.ocre,
  ENTREGADO: COLOR_CALIDO.salvia,
  CANCELADO: COLOR_CALIDO.piedra,
  RECHAZADA: COLOR_CALIDO.terracota,
};

/**
 * Números de cabecera del bloque de lotes: lo que hay abierto hoy y qué
 * parte de lo iniciado en el período ya se terminó.
 */
function metricasLotes(d: DatosProduccion): Metrica[] {
  // Completitud: de los lotes INICIADOS en el período, cuántos ya están
  // terminados. Con los terminados del período sobre los iniciados podría
  // pasar del 100 % (se terminan lotes empezados antes).
  const iniciados = d.lotes_por_estado.reduce((t, c) => t + c.valor, 0);
  const terminados = d.lotes_por_estado.find((c) => c.clave === "terminado")?.valor ?? 0;
  const completitud = iniciados === 0 ? null : Math.round((terminados / iniciados) * 100);

  return [
    {
      clave: "activos",
      etiqueta: "Lotes activos hoy",
      valor: formatoCantidad(d.lotes_en_proceso),
      icono: LuFactory,
      detalle: "En proceso de elaboración ahora",
    },
    {
      clave: "completitud",
      etiqueta: "Eficiencia de completitud",
      valor: completitud === null ? null : `${completitud}%`,
      icono: LuCircleCheckBig,
      avance: completitud,
      detalle: `${formatoCantidad(terminados)} de ${plural(iniciados, "lote iniciado", "lotes iniciados")} ya terminados`,
    },
  ];
}

/** Total del bloque "Elaborado por producto": los kilos que desglosa. */
function metricaKilos(d: DatosProduccion, dias: string): Metrica {
  const kilos = d.elaborado_por_producto.reduce((t, c) => t + c.valor, 0);
  return {
    clave: "kilos",
    etiqueta: "Kilos producidos",
    // Un decimal: "148,777 kg" en un número grande se lee como miles.
    valor: `${formatoCantidad(Math.round(kilos * 10) / 10)} kg`,
    icono: LuScale,
    detalle: `${plural(d.lotes_terminados, "lote terminado", "lotes terminados")} en los ${textoPeriodo(dias)}`,
  };
}

/**
 * Panel de Producción: qué se está elaborando, cuánto se terminó, qué salió
 * de planta y qué hubo que retirar. Quien administra ve además qué productos
 * del catálogo tienen pendientes (receta, información nutricional o rótulo).
 */
export function PanelProduccion() {
  const panel = usePanel<DatosProduccion>("produccion", "producto_id");

  return (
    <MarcoPanel
      panel={panel}
      filtro={{
        label: "Producto",
        todos: "Todos los productos",
        opciones: panel.datos?.productos ?? [],
      }}
    >
      {(d) => (
        <>
          <GrillaBloques principal>
            <Bloque
              titulo="Lotes iniciados por estado"
              descripcion={`Lotes iniciados ${textoGranularidad(d.serie_lotes_por_estado)}, apilados según su estado actual`}
              vacio={sinValores(d.lotes_por_estado) && "No se iniciaron lotes en el período."}
              acciones={<MetricasBloque metricas={metricasLotes(d)} enCabecera />}
            >
              <GraficoSerie
                serie={d.serie_lotes_por_estado}
                series={SERIES_ESTADO_LOTE}
                tipo="apiladas"
                resumen="Lotes iniciados por período, según su estado actual"
                llenar
              />
            </Bloque>

            <Bloque
              titulo="Salidas por estado"
              descripcion="Estado actual de las salidas registradas en el período"
              vacio={sinValores(d.salidas_por_estado) && "No se registraron salidas en el período."}
            >
              <GraficoDona partes={conColor(d.salidas_por_estado, COLOR_SALIDA)} unidad="salidas" />
              <VerTodos to="/salidas">Ver las salidas</VerTodos>
            </Bloque>
          </GrillaBloques>

          {/* Lo producido: día a día y por producto, con el mismo criterio
              (lotes terminados, por día de cierre). */}
          <GrillaBloques principal>
            <Bloque
              titulo="Producción diaria"
              descripcion="Cantidad terminada cada día, en la unidad de cada producto; se pueden comparar productos"
              vacio={d.produccion_por_dia.length === 0 && "No se terminaron lotes en el período."}
            >
              {/* `key`: al cambiar de período o de producto, los productos
                  comparados vuelven a cero. */}
              <ProduccionDiaria
                key={`${d.periodo.desde}-${d.periodo.hasta}-${panel.filtro}`}
                porDia={d.produccion_por_dia}
                periodo={d.periodo}
              />
            </Bloque>

            <Bloque
              titulo="Elaborado por producto"
              descripcion="Kilos producidos en los lotes terminados del período; los que se elaboran por unidad se pesan con su peso por unidad"
              vacio={
                d.elaborado_por_producto.length === 0 &&
                d.elaborado_sin_peso.length === 0 &&
                "No se terminaron lotes en el período."
              }
            >
              <MetricasBloque metricas={[metricaKilos(d, panel.dias)]} />
              {d.elaborado_por_producto.length > 0 ? (
                <GraficoPaleta datos={d.elaborado_por_producto} unidad="kg" />
              ) : null}
              {d.elaborado_sin_peso.length > 0 ? (
                <Text fontSize="xs" color="fg.muted" mt={d.elaborado_por_producto.length > 0 ? "4" : "0"}>
                  Sin pasar a kg por no tener cargado el peso por unidad (o la densidad) en su
                  información nutricional:{" "}
                  {d.elaborado_sin_peso.map((c) => `${c.etiqueta} (${c.detalle})`).join(", ")}.
                </Text>
              ) : null}
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Salidas y retiros"
              descripcion={`Salidas registradas y retiros de lote iniciados ${textoGranularidad(d.serie_salidas_retiros)}`}
              vacio={
                serieVacia(d.serie_salidas_retiros, ["salidas", "retiros"]) &&
                "No hubo salidas ni retiros en el período."
              }
            >
              <GraficoSerie
                serie={d.serie_salidas_retiros}
                series={SERIES_SALIDAS}
                tipo="area"
                resumen="Salidas de producto y retiros de lote por período"
              />
            </Bloque>

            <Bloque
              titulo="Ritmo de elaboración"
              descripcion={`Lotes iniciados y terminados ${textoGranularidad(d.serie_lotes)}`}
              vacio={
                serieVacia(d.serie_lotes, ["iniciados", "terminados"]) && "No hubo lotes en el período."
              }
            >
              <GraficoSerie
                serie={d.serie_lotes}
                series={SERIES_LOTES}
                tipo="area"
                resumen="Lotes iniciados y terminados por período"
              />
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Lotes en proceso"
              descripcion="Los que llevan más tiempo abiertos, con el avance de su checklist"
              vacio={d.en_proceso.length === 0 && "No hay lotes en proceso."}
            >
              <ListaPanel filas={d.en_proceso} acento />
              <VerTodos to="/lotes">Ver todos los lotes</VerTodos>
            </Bloque>

            {d.catalogo ? (
              <Bloque
                titulo="Productos con pendientes"
                descripcion="Qué le falta a cada uno: receta, información nutricional o rótulo"
                vacio={d.catalogo.pendientes.length === 0 && "Todos los productos están completos."}
              >
                <ListaPendientes filas={d.catalogo.pendientes} />
                <VerTodos to="/productos">Ver los productos</VerTodos>
              </Bloque>
            ) : null}
          </GrillaBloques>
        </>
      )}
    </MarcoPanel>
  );
}
