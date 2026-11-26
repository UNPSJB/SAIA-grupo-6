import { Box, Flex, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import type { NivelRiesgo } from "../../notificaciones/types/notificacion";
import {
  ESCALAS,
  PALETA_ZONA,
  ETIQUETA_IMPACTO,
  ETIQUETA_PROBABILIDAD,
  RANGO_PROBABILIDAD,
  type CeldaMatriz,
  type MatrizRiesgo,
} from "../types/matrizRiesgo";


const TEXTO_NIVEL: Record<NivelRiesgo, string> = {
  alto: "riesgo alto",
  medio: "riesgo medio",
  bajo: "riesgo bajo",
  sin_riesgo: "sin riesgo",
};

function textoCelda(celda: CeldaMatriz, menos: number): string {
  const situaciones = celda.cantidad === 1 ? "1 situación" : `${celda.cantidad} situaciones`;
  const base = `Impacto ${ETIQUETA_IMPACTO[celda.impacto].toLowerCase()}, probabilidad ${ETIQUETA_PROBABILIDAD[celda.probabilidad].toLowerCase()} (${TEXTO_NIVEL[celda.nivel]}): ${situaciones}`;
  return menos > 0 ? `${base}; ${menos} menos que sin planes` : base;
}

/**
 * Una celda: tono pleno si tiene situaciones, tono suave (y un guion) si no.
 * Con `menos` > 0 suma debajo cuántas salieron de la celda por un plan. Con
 * `enlace`, una celda con situaciones lleva a verlas.
 */
function Celda({
  celda,
  menos,
  grande,
  enlace,
}: {
  celda: CeldaMatriz;
  menos: number;
  grande?: boolean;
  enlace?: string;
}) {
  const paleta = PALETA_ZONA[celda.nivel];
  const conSituaciones = celda.cantidad > 0;
  const texto = textoCelda(celda, menos);
  const esEnlace = Boolean(enlace) && conSituaciones;
  return (
    <Flex
      asChild={esEnlace}
      direction="column"
      align="center"
      justify="center"
      gap="0.5"
      rounded="md"
      minH={grande ? "16" : "9"}
      bg={conSituaciones ? `${paleta}.solid` : `${paleta}.subtle`}
      color={conSituaciones ? `${paleta}.contrast` : "fg.subtle"}
      borderWidth="1px"
      borderColor={`${paleta}.border`}
      title={esEnlace ? `${texto}. Ver estas situaciones` : texto}
      {...(esEnlace
        ? {
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            _hover: { transform: "translateY(-1px)", boxShadow: "md" },
            _focusVisible: { outline: "2px solid", outlineColor: "brand.focusRing", outlineOffset: "2px" },
          }
        : {})}
    >
      {esEnlace ? (
        <RouterLink to={enlace!} aria-label={`${texto}. Ver estas situaciones`}>
          <ContenidoCelda celda={celda} menos={menos} grande={grande} />
        </RouterLink>
      ) : (
        <ContenidoCelda celda={celda} menos={menos} grande={grande} />
      )}
    </Flex>
  );
}

function ContenidoCelda({ celda, menos, grande }: { celda: CeldaMatriz; menos: number; grande?: boolean }) {
  const conSituaciones = celda.cantidad > 0;
  return (
    <>
      <Text
        fontSize={conSituaciones ? (grande ? "3xl" : "xl") : "md"}
        fontWeight={conSituaciones ? "extrabold" : "medium"}
        lineHeight="1"
        fontVariantNumeric="tabular-nums"
        aria-hidden
      >
        {conSituaciones ? celda.cantidad : "–"}
      </Text>
      {menos > 0 && (
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          lineHeight="1"
          fontVariantNumeric="tabular-nums"
          opacity={0.9}
          aria-hidden
        >
          −{menos}
        </Text>
      )}
    </>
  );
}

interface GrillaMatrizRiesgoProps {
  matriz: MatrizRiesgo;
  /** Descripción para lectores de pantalla. */
  resumen: string;
  /**
   * Matriz de referencia (el riesgo real): cada celda muestra cuántas
   * situaciones menos tiene que en la de referencia.
   */
  contraste?: MatrizRiesgo;
  /** Celdas y cifras más grandes (la tarjeta del Inicio, que tiene lugar). */
  grande?: boolean;
  /** Si se pasa, cada celda con situaciones es un enlace a esta ruta. */
  enlaceCelda?: (celda: CeldaMatriz) => string;
}

/**
 * Grilla de 3 × 3: impacto (filas, el más alto arriba) por probabilidad
 * (columnas). La esquina de arriba a la derecha es la zona crítica.
 */
export function GrillaMatrizRiesgo({
  matriz,
  resumen,
  contraste,
  grande,
  enlaceCelda,
}: GrillaMatrizRiesgoProps) {
  const menosEn = (celda: CeldaMatriz): number => {
    const referencia = contraste?.filas
      .find((f) => f.impacto === celda.impacto)
      ?.celdas.find((c) => c.probabilidad === celda.probabilidad);
    return Math.max(0, (referencia?.cantidad ?? 0) - celda.cantidad);
  };

  return (
    <>
      {/* Con enlaces, la grilla deja de ser una imagen: cada celda se anuncia
          sola. Sin ellos, la describe el resumen (y la tabla de abajo). */}
      <Box
        flex="1"
        minH="0"
        role={enlaceCelda ? "group" : "img"}
        aria-label={resumen}
      >
        <Box
          display="grid"
          h="full"
          gap={grande ? "2" : "1.5"}
          gridTemplateColumns="auto repeat(3, minmax(0, 1fr))"
          gridTemplateRows={`repeat(3, minmax(${grande ? "4rem" : "2.25rem"}, 1fr)) auto`}
          alignItems="stretch"
        >
          {matriz.filas.map((fila) => (
            <Box display="contents" key={fila.impacto}>
              <Flex align="center" justify="flex-end" pr="1.5">
                <Text fontSize={grande ? "sm" : "xs"} color="fg.muted" fontWeight="medium">
                  {ETIQUETA_IMPACTO[fila.impacto]}
                </Text>
              </Flex>
              {fila.celdas.map((celda) => (
                <Celda
                  key={`${celda.impacto}-${celda.probabilidad}`}
                  celda={celda}
                  menos={menosEn(celda)}
                  grande={grande}
                  enlace={enlaceCelda?.(celda)}
                />
              ))}
            </Box>
          ))}
          <Flex align="center" justify="flex-end" pr="1.5">
            <Text fontSize="2xs" color="fg.subtle">
              Impacto ↑
            </Text>
          </Flex>
          {ESCALAS.map((escala) => (
            <Text
              key={escala}
              fontSize="xs"
              color="fg.muted"
              fontWeight="medium"
              textAlign="center"
              title={`Probabilidad ${ETIQUETA_PROBABILIDAD[escala].toLowerCase()}: ${RANGO_PROBABILIDAD[escala]}`}
            >
              {ETIQUETA_PROBABILIDAD[escala]}
            </Text>
          ))}
        </Box>
      </Box>

      {/* Tabla para lectores de pantalla: el color solo no alcanza. */}
      <Box srOnly>
        <table>
          <caption>{resumen}</caption>
          <thead>
            <tr>
              <th>Impacto</th>
              {ESCALAS.map((e) => (
                <th key={e}>Probabilidad {ETIQUETA_PROBABILIDAD[e].toLowerCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.filas.map((fila) => (
              <tr key={fila.impacto}>
                <th>{ETIQUETA_IMPACTO[fila.impacto]}</th>
                {fila.celdas.map((c) => (
                  <td key={c.probabilidad}>{c.cantidad}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </>
  );
}
