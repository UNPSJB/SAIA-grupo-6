import { Box, Text, type BoxProps } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { LuBug, LuEllipsis, LuSprayCan, LuUndo2, LuWrench } from "react-icons/lu";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import type { TipoIncidente } from "../../incidente/types/incidente";
import type { ParteTorta } from "../types/dashboard";
import { TarjetaPanel } from "./TarjetaPanel";

/*
 * Geometría del anillo.
 *
 * Es un SVG de 160×160 con el centro en 80,80 y el anillo entre 42 y 70 de
 * radio: el hueco del medio es lo que lleva el total. Los valores van en
 * unidades del `viewBox` y no en píxeles, así el gráfico escala con la caja
 * sin recalcular nada.
 */
const LADO = 160;
const CENTRO = LADO / 2;
const RADIO_EXTERIOR = 70;
const GROSOR = 28;
const RADIO_TRAZO = RADIO_EXTERIOR - GROSOR / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_TRAZO;
/** Aire entre porciones: sin esto los bordes de dos tonos se pegan. */
const HUECO = 3;

/**
 * Medidas en píxeles de la caja del gráfico.
 *
 * El anillo es fijo (`DIAMETRO_ANILLO`) y las etiquetas se ubican a su
 * alrededor, por eso la caja tiene alto propio: arriba y abajo tiene que quedar
 * lugar para las etiquetas de las porciones que miran hacia esos lados
 * (`MARGEN_ETIQUETAS`, de dos líneas de texto más el aire).
 * `RADIO_ETIQUETA` es la distancia del centro al punto donde se ancla cada
 * etiqueta: el radio exterior del anillo más un pequeño aire.
 */
const DIAMETRO_ANILLO = 160;
const MARGEN_ETIQUETAS = 44;
const ALTO_CAJA = DIAMETRO_ANILLO + MARGEN_ETIQUETAS * 2;
const RADIO_ETIQUETA = DIAMETRO_ANILLO / 2 + 8;

/** Ícono de cada categoría, junto a su etiqueta. */
const ICONO_TIPO: Record<TipoIncidente, IconType> = {
  plagas: LuBug,
  falla_equipo: LuWrench,
  devolucion_cliente: LuUndo2,
  higiene_contaminacion: LuSprayCan,
  otro: LuEllipsis,
};

/** Un tramo del anillo, ya traducido a unidades del `viewBox`. */
interface Tramo extends ParteTorta {
  largo: number;
  desplazamiento: number;
  /** Ángulo del medio del tramo, en grados, con 0° a las 3 en punto. */
  angulo: number;
}

/**
 * Convierte las porciones en tramos consecutivos del anillo.
 *
 * El largo sale de la **cantidad**, no del `porcentaje` de la leyenda: como
 * ese va redondeado a entero, cinco porciones de 33% sumarían 165 y el anillo
 * se cerraría en vez de abrir un hueco de 3% al final. Con los conteos el
 * anillo siempre cierra exacto y el redondeo queda solo en el texto.
 *
 * El `angulo` es el del centro de cada tramo: ahí se ancla su etiqueta. Se mide
 * con -90° de corrimiento porque el anillo arranca a las 12 en punto.
 *
 * Va fuera del componente a propósito: necesita un acumulador (`contados`) y
 * el render tiene que ser puro. La regla `react-hooks/immutability` marca
 * reasignar una variable declarada en el cuerpo del componente.
 */
function calcularTramos(partes: ParteTorta[], total: number): Tramo[] {
  const tramos: Tramo[] = [];
  let contados = 0;

  for (const parte of partes) {
    const largo = (parte.cantidad / total) * CIRCUNFERENCIA;
    const desplazamiento = (contados / total) * CIRCUNFERENCIA;
    const angulo = ((contados + parte.cantidad / 2) / total) * 360 - 90;

    tramos.push({ ...parte, largo, desplazamiento, angulo });
    contados += parte.cantidad;
  }

  return tramos;
}

/**
 * Etiqueta de una porción, ubicada al costado del anillo.
 *
 * Se ancla en el punto del borde que mira hacia el medio de la porción, y la
 * caja de texto se acomoda hacia **afuera** de ese punto en cada eje: si la
 * porción mira a la derecha, la etiqueta crece hacia la derecha; si mira hacia
 * arriba, crece hacia arriba. Como la caja siempre queda del lado opuesto al
 * centro, nunca pisa el anillo, sea cual sea el ángulo. Cerca de los ejes
 * (menos de ~17° de desvío) se centra sobre ese eje en vez de pegarse a un
 * lado.
 *
 * Lleva dos líneas (nombre y porcentaje) y no una: en la columna angosta de la
 * derecha, "Falla Equipo (35%)" en una línea no entra a los costados.
 */
function EtiquetaTramo({ tramo }: { tramo: Tramo }) {
  const radianes = (tramo.angulo * Math.PI) / 180;
  const coseno = Math.cos(radianes);
  const seno = Math.sin(radianes);
  const x = coseno * RADIO_ETIQUETA;
  const y = seno * RADIO_ETIQUETA;
  const Icono = ICONO_TIPO[tramo.tipo];

  const horizontal = coseno > 0.3 ? "der" : coseno < -0.3 ? "izq" : "centro";
  const vertical = seno < -0.3 ? "arriba" : seno > 0.3 ? "abajo" : "medio";

  const traslado = `translate(${
    horizontal === "der" ? "0" : horizontal === "izq" ? "-100%" : "-50%"
  }, ${vertical === "arriba" ? "-100%" : vertical === "abajo" ? "0" : "-50%"})`;

  const alineacion =
    horizontal === "der" ? "flex-start" : horizontal === "izq" ? "flex-end" : "center";

  return (
    <Box
      position="absolute"
      left={`calc(50% + ${x.toFixed(1)}px)`}
      top={`calc(50% + ${y.toFixed(1)}px)`}
      transform={traslado}
      display="flex"
      flexDirection="column"
      alignItems={alineacion}
      gap="0.5"
      fontSize="xs"
      whiteSpace="nowrap"
      px="1"
    >
      <Box display="flex" alignItems="center" gap="1" color="fg.muted">
        <Icono size={14} aria-hidden />
        <Text as="span">{tramo.etiquetaCorta}</Text>
      </Box>
      <Text as="span" fontWeight="bold" color="fg">
        {tramo.porcentaje}%
      </Text>
    </Box>
  );
}

interface GraficoTortaProps extends BoxProps {
  partes: ParteTorta[];
  loading: boolean;
  error: string | null;
}

/**
 * Porcentaje de incidentes por categoría.
 *
 * Es un anillo y no una torta llena para que el total quede legible en el
 * hueco, y cada porción se rotula a su lado en vez de llevar una leyenda
 * aparte: se lee de un vistazo qué es cada tono. Cada porción es un `circle`
 * con `stroke-dasharray`: el largo del trazo es la porción de la circunferencia
 * y el `stroke-dashoffset` negativo la corre hasta donde termina la anterior.
 * El `rotate(-90)` pone el primer tramo en las 12 en punto en vez de en las 3.
 *
 * Las etiquetas son HTML encima de la caja y no `<text>` del SVG: así el texto
 * mantiene su tamaño legible aunque el SVG escale.
 *
 * El gráfico es decorativo para el lector de pantalla (`role="img"` con un
 * resumen) porque los mismos números están escritos en las etiquetas.
 */
export function GraficoTorta({
  partes,
  loading,
  error,
  ...rest
}: GraficoTortaProps) {
  const total = partes.reduce((suma, p) => suma + p.cantidad, 0);

  const tramos = calcularTramos(partes, total);

  const resumen =
    total === 0
      ? "Sin incidentes para mostrar"
      : `Incidentes por categoría: ${partes
          .map((p) => `${p.etiqueta} ${p.cantidad} (${p.porcentaje}%)`)
          .join(", ")}. Total: ${total}.`;

  return (
    <TarjetaPanel titulo="Incidentes por Categoría" {...rest}>
      {loading && <EstadoCargando />}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!loading && !error && total === 0 && (
        <Text fontSize="sm" color="fg.muted" my="auto">
          No hay incidentes para mostrar.
        </Text>
      )}

      {!loading && !error && total > 0 && (
        <Box position="relative" w="full" h={`${ALTO_CAJA}px`} my="auto">
          <Box
            position="absolute"
            top="50%"
            left="50%"
            w={`${DIAMETRO_ANILLO}px`}
            h={`${DIAMETRO_ANILLO}px`}
            transform="translate(-50%, -50%)"
          >
            <svg
              viewBox={`0 0 ${LADO} ${LADO}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={resumen}
              style={{ width: "100%", height: "100%", display: "block" }}
            >
              {tramos.map((tramo) => {
                // El hueco se descuenta del trazo: en el único tramo que llena
                // el anillo entero (100%) deja una costura de 3 unidades.
                const visible = Math.max(tramo.largo - HUECO, 0);

                return (
                  <circle
                    key={tramo.tipo}
                    cx={CENTRO}
                    cy={CENTRO}
                    r={RADIO_TRAZO}
                    fill="none"
                    stroke={tramo.color}
                    strokeWidth={GROSOR}
                    strokeDasharray={`${visible} ${CIRCUNFERENCIA - visible}`}
                    strokeDashoffset={-tramo.desplazamiento}
                    transform={`rotate(-90 ${CENTRO} ${CENTRO})`}
                  />
                );
              })}
            </svg>

            {/* El total va en el hueco, encima del SVG. */}
            <Box
              position="absolute"
              inset={0}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              pointerEvents="none"
            >
              <Text fontSize="2xl" fontWeight="bold" lineHeight="1" color="fg">
                {total}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Incidentes
              </Text>
            </Box>
          </Box>

          {tramos.map((tramo) => (
            <EtiquetaTramo key={tramo.tipo} tramo={tramo} />
          ))}
        </Box>
      )}
    </TarjetaPanel>
  );
}
