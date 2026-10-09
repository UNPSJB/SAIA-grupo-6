import { Box, chakra } from "@chakra-ui/react";
import { useId, type ReactNode } from "react";

/*
 * Geometría del anillo: un `viewBox` cuadrado con el centro en 80,80 y el
 * trazo entre 52 y 72 de radio. El `stroke-dasharray` dibuja el avance y el
 * resto queda en la pista de fondo.
 */
const LADO = 160;
const CENTRO = LADO / 2;
const GROSOR = 20;
const RADIO_TRAZO = CENTRO - GROSOR / 2 - 4;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_TRAZO;

interface AnilloProgresoProps {
  /** Avance del 0 al 100. */
  porcentaje: number;
  /** Variable CSS del trazo de avance. */
  color?: string;
  /** Texto del centro: un número, un ícono, o nada. */
  children?: ReactNode;
}

/**
 * Anillo de progreso de un solo valor.
 *
 * Para que no sea solo una línea lleva tres capas: un disco tenue de fondo que
 * da profundidad y sostiene el texto del centro, la pista gris del recorrido
 * completo, y el avance con un degradado (más translúcido al comienzo, pleno en
 * la punta) y extremos redondeados, que se lee como un arco que "viene de
 * algún lado" en vez de un trazo uniforme.
 *
 * El avance se recorta a 100 porque un porcentaje mayor (o un `NaN` que llegue
 * de algún cálculo) dejaría el `stroke-dasharray` más largo que la circunferencia
 * y el anillo se cerraría de más.
 *
 * El `id` del degradado sale de `useId`: con uno fijo, dos anillos en la misma
 * página compartirían el del primero.
 */
export function AnilloProgreso({
  porcentaje,
  color = "var(--chakra-colors-brand-500)",
  children,
}: AnilloProgresoProps) {
  const idDegradado = `${useId().replace(/:/g, "")}-anillo`;
  const avance = Number.isFinite(porcentaje)
    ? Math.min(Math.max(porcentaje, 0), 100)
    : 0;
  const largo = (avance / 100) * CIRCUNFERENCIA;

  return (
    <Box position="relative" display="flex" flexShrink={0} w="full" h="full">
      <chakra.svg
        viewBox={`0 0 ${LADO} ${LADO}`}
        role="img"
        aria-label={`${avance}%`}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          <linearGradient id={idDegradado} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>

        {/* Disco de fondo, dentro del anillo. */}
        <circle
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO_TRAZO - GROSOR / 2 - 2}
          fill="var(--chakra-colors-brand-50)"
        />

        {/* Pista del recorrido completo. */}
        <circle
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO_TRAZO}
          fill="none"
          stroke="var(--chakra-colors-gray-100)"
          strokeWidth={GROSOR}
        />

        {avance > 0 && (
          <circle
            cx={CENTRO}
            cy={CENTRO}
            r={RADIO_TRAZO}
            fill="none"
            stroke={`url(#${idDegradado})`}
            strokeWidth={GROSOR}
            strokeLinecap="round"
            strokeDasharray={`${largo} ${CIRCUNFERENCIA - largo}`}
            transform={`rotate(-90 ${CENTRO} ${CENTRO})`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        )}
      </chakra.svg>

      {children ? (
        <Box
          position="absolute"
          inset={0}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
