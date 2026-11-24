import { useState } from "react";
import { Text } from "@chakra-ui/react";
import { LuCircleCheckBig, LuFactory, LuScale } from "react-icons/lu";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { usePanel } from "../../hooks/usePanel";
import {
  plural,
  sinValores,
  textoGranularidad,
  textoPeriodo,
  type Conteo,
  type PanelProduccion as DatosProduccion,
  type ProduccionDelDia,
} from "../../types/paneles";
import { GraficoDona, GraficoPaleta, GraficoSerie } from "../graficos";
import { ProduccionDiaria } from "../ProduccionDiaria";
import { unidadesDe } from "../produccionDiaria.utils";
import { COLOR_CALIDO, COLOR_ESTADO, COLOR_SERIE, conColor, serieVacia } from "../../types/coloresGraficos";
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
  {
    clave: "salidas",
    etiqueta: "Salidas registradas",
    color: COLOR_SERIE.azul,
  },
  {
    clave: "retiros",
    etiqueta: "Retiros iniciados",
    color: COLOR_SERIE.naranja,
  },
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

/** Mismas filas que el ranking del backend (`FILAS_RANKING`). */
const FILAS_RANKING = 8;

const esKilos = (unidad: string | null) => unidad === null || unidad.toLowerCase() === "kg";

/** Un decimal: "148,777 kg" en un número grande se lee como miles. */
const redondear = (valor: number) => Math.round(valor * 10) / 10;

/**
 * Lo elaborado por producto en una unidad que no es kg ("un"), sumando la
 * producción diaria: solo los productos que se elaboran en esa unidad, sin
 * convertir. Mismo criterio que el ranking en kg (lote terminado, por día
 * de cierre), así los totales coinciden con el gráfico diario.
 */
function elaboradoEnUnidad(porDia: ProduccionDelDia[], unidad: string): Conteo[] {
  const totales = new Map<string, number>();
  for (const dia of porDia) {
    if (dia.unidad !== unidad) continue;
    for (const p of dia.productos) totales.set(p.producto, (totales.get(p.producto) ?? 0) + p.cantidad);
  }
  return [...totales.entries()]
    .map(([nombre, valor]) => ({
      clave: nombre,
      etiqueta: nombre,
      valor: redondear(valor),
      detalle: null,
    }))
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, "es"))
    .slice(0, FILAS_RANKING);
}

/** Total del bloque "Elaborado por producto": lo que desglosa, en su unidad. */
function metricaElaborado(d: DatosProduccion, dias: string, filas: Conteo[], unidad: string): Metrica {
  const total = filas.reduce((t, c) => t + c.valor, 0);
  return {
    clave: "elaborado",
    etiqueta: esKilos(unidad) ? "Kilos producidos" : `Producido (${unidad})`,
    valor: `${formatoCantidad(redondear(total))} ${unidad}`,
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
  /** Unidad elegida en "Producción diaria"; "Elaborado por producto" la sigue. */
  const [elegida, setElegida] = useState<string | null>(null);

  return (
    <MarcoPanel
      panel={panel}
      filtro={{
        label: "Producto",
        todos: "Todos los productos",
        opciones: panel.datos?.productos ?? [],
      }}
    >
      {(d) => {
        const unidades = unidadesDe(d.produccion_por_dia);
        const unidad = elegida && unidades.includes(elegida) ? elegida : (unidades[0] ?? null);
        // En kg va el ranking del backend, que pasa a kg también lo que se
        // elabora por unidad; en otra unidad, solo lo elaborado en ella.
        const kilos = esKilos(unidad);
        const elaborado =
          kilos || !unidad ? d.elaborado_por_producto : elaboradoEnUnidad(d.produccion_por_dia, unidad);
        const unidadElaborado = kilos || !unidad ? "kg" : unidad;
        return (
          <>
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
                  unidad={unidad}
                  onUnidad={setElegida}
                />
              </Bloque>

              <Bloque
                titulo="Elaborado por producto"
                descripcion={
                  kilos
                    ? "Kilos producidos en los lotes terminados del período; los que se elaboran por unidad se pesan con su peso por unidad"
                    : `Cantidad producida en ${unidadElaborado} en los lotes terminados del período, de los productos que se elaboran en esa unidad`
                }
                vacio={
                  elaborado.length === 0 &&
                  (!kilos || d.elaborado_sin_peso.length === 0) &&
                  "No se terminaron lotes en el período."
                }
              >
                <MetricasBloque metricas={[metricaElaborado(d, panel.dias, elaborado, unidadElaborado)]} />
                {elaborado.length > 0 ? <GraficoPaleta datos={elaborado} unidad={unidadElaborado} /> : null}
                {kilos && d.elaborado_sin_peso.length > 0 ? (
                  <Text fontSize="xs" color="fg.muted" mt={elaborado.length > 0 ? "4" : "0"}>
                    Sin pasar a kg por no tener cargado el peso por unidad (o la densidad) en su información
                    nutricional: {d.elaborado_sin_peso.map((c) => `${c.etiqueta} (${c.detalle})`).join(", ")}.
                  </Text>
                ) : null}
              </Bloque>
            </GrillaBloques>

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
                <VerTodos to="/lotes?tab=salidas">Ver las salidas</VerTodos>
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
        );
      }}
    </MarcoPanel>
  );
}
