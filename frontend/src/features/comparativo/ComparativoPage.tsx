import { Box } from "@chakra-ui/react";
import { LuChartColumn, LuCircleCheckBig, LuFactory } from "react-icons/lu";
import { useAuth } from "../../common/context/useAuth";
import { esGerente, esSuperAdmin } from "../../common/api/permissions";
import { Pagina } from "../../components/ui/plantillas";
import { BannerError } from "../../components/ui/patrones";
import { usePanel } from "../dashboard/hooks/usePanel";
import { BannerPanel } from "../dashboard/components/BannerPanel";
import { Bloque, GrillaBloques, MarcoPanel, MetricasBloque, type Metrica } from "../dashboard/components/piezasPanel";
import { textoPeriodo } from "../dashboard/types/paneles";
import { TEMA_EMPRESA } from "../dashboard/types/temasArea";
import {
  sedesConDato,
  textoPuesto,
  textoValor,
  type IndicadorComparativo,
  type TableroComparativo,
} from "./comparativo.utils";
import {
  BarrasLotes,
  BarrasRiesgo,
  CifraRiesgo,
  DetalleCumplimiento,
  RadarCumplimiento,
  ResumenEjecutivo,
} from "./graficosComparativo";

const CLAVES_LOTES = ["lotes_iniciados", "lotes_terminados"];
const ICONO_LOTES = { lotes_iniciados: LuFactory, lotes_terminados: LuCircleCheckBig } as const;

const sinDatos = (i: IndicadorComparativo) => sedesConDato(i) === 0;

/** Cabecera del bloque de lotes: la cifra de la sede en cada serie, con su puesto. */
function metricasLotes(lotes: IndicadorComparativo[]): Metrica[] {
  return lotes.map((i) => ({
    clave: i.clave,
    etiqueta: `${i.etiqueta} en tu sede`,
    valor: textoValor(i.valor_propio, i.formato),
    icono: ICONO_LOTES[i.clave as keyof typeof ICONO_LOTES] ?? LuFactory,
    detalle: [textoPuesto(i, i.valor_propio), `empresa ${textoValor(i.promedio_empresa, i.formato)}`]
      .filter(Boolean)
      .join(" · "),
  }));
}

/**
 * Tablero del gerente: cómo está su establecimiento frente al resto de la
 * empresa. Arriba, un resumen de tres cifras (puestos, mayor fortaleza y
 * mayor oportunidad); abajo, los indicadores agrupados por afinidad:
 * cumplimiento (radar y detalle), producción (lotes por sede) y calidad y
 * riesgo, donde menos es mejor.
 *
 * Para el super admin, "su sede" es la que eligió en Configuración.
 */
export function ComparativoPage() {
  const { user } = useAuth();
  const permitido = esGerente(user) || esSuperAdmin(user);
  const panel = usePanel<TableroComparativo>("comparativo");

  if (!permitido) {
    return (
      <Pagina titulo="Comparar establecimientos">
        <BannerError>Este tablero es para los gerentes de cada establecimiento.</BannerError>
      </Pagina>
    );
  }

  return (
    // Como los paneles de categoría: sin margen propio, banner y filtros encima.
    <Box w="100%">
      <BannerPanel
        tema={TEMA_EMPRESA}
        etiqueta="Comparativa multi-sede"
        titulo="Comparar establecimientos"
        descripcion="Cómo está tu establecimiento frente al resto de la empresa: puestos, fortalezas y dónde mejorar."
        icono={LuChartColumn}
      />
      <MarcoPanel
        panel={panel}
        nota={(tablero) => {
          const total = tablero.establecimientos.length;
          const propia =
            tablero.establecimientos.find((e) => e.id === tablero.establecimiento_propio_id)?.nombre ?? "Tu sede";
          return `${propia} frente a ${total - 1} ${total - 1 === 1 ? "establecimiento" : "establecimientos"} más · actividad de los ${textoPeriodo(panel.dias)}; el cumplimiento de equipos, aptitudes, documentos y elementos es el de hoy.`;
        }}
      >
        {(tablero) => {
          const propia = tablero.establecimiento_propio_id;
          const sedes = tablero.establecimientos;
          const cumplimiento = tablero.indicadores.filter((i) => i.formato === "porcentaje");
          const lotes = tablero.indicadores.filter((i) => CLAVES_LOTES.includes(i.clave));
          const riesgo = tablero.indicadores.filter((i) => i.formato === "cantidad" && i.mejor === "bajo");
          return (
            <>
              <ResumenEjecutivo indicadores={tablero.indicadores} sedes={sedes.length} />

              {/* A · Cumplimiento: el perfil de un vistazo y el detalle al lado. */}
              <GrillaBloques>
                <Bloque
                  titulo="Perfil de cumplimiento"
                  descripcion="Los cinco indicadores de cumplimiento de tu sede frente al promedio de la empresa"
                  vacio={cumplimiento.every(sinDatos) && "Ningún establecimiento tiene datos de cumplimiento."}
                >
                  <RadarCumplimiento indicadores={cumplimiento} sedes={sedes} propia={propia} />
                </Bloque>
                <Bloque
                  titulo="Detalle por indicador"
                  descripcion="Tu valor, tu puesto y la distancia al promedio; pasá por una fila para ver cada sede"
                  vacio={cumplimiento.every(sinDatos) && "Ningún establecimiento tiene datos de cumplimiento."}
                >
                  <DetalleCumplimiento indicadores={cumplimiento} sedes={sedes} propia={propia} />
                </Bloque>
              </GrillaBloques>

              {/* B · Producción del período. */}
              {lotes.length > 0 ? (
                <GrillaBloques>
                  <Bloque
                    titulo="Producción del período"
                    descripcion={`Lotes iniciados y terminados en los ${textoPeriodo(panel.dias)}, por establecimiento`}
                    vacio={lotes.every(sinDatos) && "No hubo lotes en el período en ningún establecimiento."}
                    acciones={<MetricasBloque enCabecera metricas={metricasLotes(lotes)} />}
                  >
                    <BarrasLotes indicadores={lotes} sedes={sedes} propia={propia} />
                  </Bloque>
                </GrillaBloques>
              ) : null}

              {/* C · Calidad y riesgo: menos es mejor. */}
              {riesgo.length > 0 ? (
                <GrillaBloques tres={riesgo.length === 3}>
                  {riesgo.map((indicador) => (
                    <Bloque
                      key={indicador.clave}
                      titulo={indicador.etiqueta}
                      descripcion={`${indicador.descripcion} Menos es mejor.`}
                      vacio={sinDatos(indicador) && "Ningún establecimiento tiene datos para este indicador."}
                    >
                      <CifraRiesgo indicador={indicador} />
                      <BarrasRiesgo indicador={indicador} sedes={sedes} propia={propia} />
                    </Bloque>
                  ))}
                </GrillaBloques>
              ) : null}
            </>
          );
        }}
      </MarcoPanel>
    </Box>
  );
}
