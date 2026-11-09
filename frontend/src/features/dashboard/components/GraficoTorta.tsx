import { useState } from "react";
import { Box, HStack, Stack, Text, type BoxProps } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { LuBug, LuEllipsis, LuSprayCan, LuUndo2, LuWrench } from "react-icons/lu";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import type { TipoIncidente } from "../../incidente/types/incidente";
import { errorDeRangoFechas, type ParteTorta, type RangoFechas } from "../types/dashboard";
import { SelectorRango } from "./SelectorRango";
import { TarjetaPanel } from "./TarjetaPanel";

/*
 * Geometría del anillo, en unidades del `viewBox` (escala con la caja).
 */
const LADO = 160;
const CENTRO = LADO / 2;
const RADIO_EXTERIOR = 76;
const GROSOR = 24;
const RADIO_TRAZO = RADIO_EXTERIOR - GROSOR / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_TRAZO;
/** Aire entre porciones (~2px en pantalla): separa sin dibujar bordes. */
const HUECO = 1.8;

/** Diámetro del anillo en pantalla. Antes 160px con etiquetas alrededor. */
const DIAMETRO = 200;

const ICONO_TIPO: Record<TipoIncidente, IconType> = {
  plagas: LuBug,
  falla_equipo: LuWrench,
  devolucion_cliente: LuUndo2,
  higiene_contaminacion: LuSprayCan,
  otro: LuEllipsis,
};

interface Tramo extends ParteTorta {
  largo: number;
  desplazamiento: number;
}

/**
 * Tramos consecutivos del anillo. El largo sale de la cantidad y no del
 * porcentaje redondeado, así el anillo siempre cierra exacto. Fuera del
 * componente porque usa un acumulador y el render tiene que ser puro.
 */
function calcularTramos(partes: ParteTorta[], total: number): Tramo[] {
  const tramos: Tramo[] = [];
  let contados = 0;
  for (const parte of partes) {
    tramos.push({
      ...parte,
      largo: (parte.cantidad / total) * CIRCUNFERENCIA,
      desplazamiento: (contados / total) * CIRCUNFERENCIA,
    });
    contados += parte.cantidad;
  }
  return tramos;
}

interface GraficoTortaProps extends BoxProps {
  partes: ParteTorta[];
  loading: boolean;
  error: string | null;
  /** Período: se cuentan los incidentes reportados entre estas fechas. */
  rango: RangoFechas;
  onCambiarRango: (rango: RangoFechas) => void;
}

/**
 * Incidentes por categoría: anillo + leyenda al costado.
 *
 * Antes las etiquetas flotaban alrededor del anillo, y para dejarles lugar el
 * anillo quedaba en 160px y los textos en 12px. Ahora el anillo mide 200px y
 * la leyenda va al lado (debajo si la columna es angosta), con el nombre
 * completo, el ícono, la cantidad y el porcentaje alineados: se compara de un
 * vistazo y no hace falta adivinar a qué porción va cada texto.
 *
 * Al pasar el mouse (o el foco) por una porción o por su fila, las demás se
 * atenúan y el centro muestra esa categoría en vez del total.
 *
 * Colores: paleta validada (ver `COLOR_TORTA` en `types/dashboard.ts`).
 */
export function GraficoTorta({
  partes,
  loading,
  error,
  rango,
  onCambiarRango,
  ...rest
}: GraficoTortaProps) {
  const errorRango = errorDeRangoFechas(rango);
  const [activo, setActivo] = useState<TipoIncidente | null>(null);
  const total = partes.reduce((suma, p) => suma + p.cantidad, 0);
  const tramos = calcularTramos(partes, total);
  // La leyenda va de mayor a menor; el anillo conserva el orden fijo por tipo.
  const leyenda = [...partes].sort((a, b) => b.cantidad - a.cantidad);
  const parteActiva = partes.find((p) => p.tipo === activo) ?? null;

  const resumen =
    total === 0
      ? "Sin incidentes para mostrar"
      : `Incidentes por categoría: ${partes
          .map((p) => `${p.etiqueta} ${p.cantidad} (${p.porcentaje}%)`)
          .join(", ")}. Total: ${total}.`;

  return (
    <TarjetaPanel
      titulo="Incidentes por Categoría"
      descripcion="Incidentes reportados en el período seleccionado"
      acciones={
        <SelectorRango
          desde={rango.desde}
          hasta={rango.hasta}
          onCambio={(desde, hasta) => onCambiarRango({ desde, hasta })}
        />
      }
      {...rest}
    >
      {loading && <EstadoCargando />}

      {!loading && (error || errorRango) && <MensajeError>{error ?? errorRango}</MensajeError>}

      {!loading && !error && !errorRango && total === 0 && (
        <Text fontSize="sm" color="fg.muted" my="auto" py="6" textAlign="center">
          No hay incidentes reportados en el período.
        </Text>
      )}

      {!loading && !error && !errorRango && total > 0 && (
        <HStack
          gap="6"
          align="center"
          justify="center"
          flexWrap="wrap"
          my="auto"
          onMouseLeave={() => setActivo(null)}
        >
          <Box position="relative" w={`${DIAMETRO}px`} h={`${DIAMETRO}px`} flexShrink={0}>
            <svg
              viewBox={`0 0 ${LADO} ${LADO}`}
              role="img"
              aria-label={resumen}
              style={{ width: "100%", height: "100%", display: "block" }}
            >
              {tramos.map((tramo) => {
                const visible = Math.max(tramo.largo - HUECO, 0);
                const atenuado = activo !== null && activo !== tramo.tipo;
                return (
                  <circle
                    key={tramo.tipo}
                    cx={CENTRO}
                    cy={CENTRO}
                    r={RADIO_TRAZO}
                    fill="none"
                    stroke={tramo.color}
                    strokeWidth={activo === tramo.tipo ? GROSOR + 4 : GROSOR}
                    strokeDasharray={`${visible} ${CIRCUNFERENCIA - visible}`}
                    strokeDashoffset={-tramo.desplazamiento}
                    transform={`rotate(-90 ${CENTRO} ${CENTRO})`}
                    opacity={atenuado ? 0.3 : 1}
                    style={{ transition: "opacity 0.15s ease, stroke-width 0.15s ease", cursor: "pointer" }}
                    onMouseEnter={() => setActivo(tramo.tipo)}
                  />
                );
              })}
            </svg>

            {/* Centro: el total, o la categoría señalada. */}
            <Box
              position="absolute"
              inset={0}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              pointerEvents="none"
              textAlign="center"
              px="10"
            >
              <Text fontSize="2xl" fontWeight="bold" lineHeight="1" color="fg">
                {parteActiva ? parteActiva.cantidad : total}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="1" lineClamp={2}>
                {parteActiva ? `${parteActiva.etiquetaCorta} · ${parteActiva.porcentaje}%` : "Incidentes"}
              </Text>
            </Box>
          </Box>

          <Stack
            as="ul"
            listStyleType="none"
            m="0"
            p="0"
            gap="1"
            flex="1"
            minW="200px"
            maxW="320px"
            aria-label="Incidentes por categoría"
          >
            {leyenda.map((parte) => {
              const Icono = ICONO_TIPO[parte.tipo];
              const seleccionada = activo === parte.tipo;
              return (
                <HStack
                  as="li"
                  key={parte.tipo}
                  tabIndex={0}
                  gap="2.5"
                  px="2"
                  py="1.5"
                  rounded="md"
                  bg={seleccionada ? "gray.100" : "transparent"}
                  opacity={activo !== null && !seleccionada ? 0.55 : 1}
                  transition="opacity 0.15s ease, background 0.15s ease"
                  cursor="default"
                  onMouseEnter={() => setActivo(parte.tipo)}
                  onFocus={() => setActivo(parte.tipo)}
                  onBlur={() => setActivo(null)}
                  _focusVisible={{ outline: "2px solid", outlineColor: "brand.400" }}
                >
                  <Box w="2.5" h="2.5" rounded="full" bg={parte.color} flexShrink={0} aria-hidden />
                  <Box color="fg.muted" flexShrink={0} aria-hidden>
                    <Icono size={14} />
                  </Box>
                  <Text fontSize="sm" color="fg" flex="1" minW="0" lineClamp={1} title={parte.etiqueta}>
                    {parte.etiquetaCorta}
                  </Text>
                  <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums" minW="6" textAlign="right">
                    {parte.cantidad}
                  </Text>
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color="fg"
                    fontVariantNumeric="tabular-nums"
                    minW="10"
                    textAlign="right"
                  >
                    {parte.porcentaje}%
                  </Text>
                </HStack>
              );
            })}
          </Stack>
        </HStack>
      )}
    </TarjetaPanel>
  );
}
