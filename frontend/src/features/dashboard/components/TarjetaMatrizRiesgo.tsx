import { Box, Flex, Link, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { LuArrowRight, LuClipboardCheck, LuShieldAlert } from "react-icons/lu";
import { MensajeError } from "../../../components/ui/patrones";
import { PALETA_ZONA, contarPorNivel, rutaDeCelda, type MatrizRiesgo } from "../types/matrizRiesgo";
import { TEMAS_AREA } from "../types/temasArea";
import { GrillaMatrizRiesgo } from "./GrillaMatrizRiesgo";
import { EncabezadoTarjeta, TarjetaInicio } from "./TarjetaHoy";

interface TarjetaMatrizRiesgoProps {
  matriz: MatrizRiesgo;
  cargando: boolean;
  error: string | null;
}

const NIVELES = [
  { clave: "alto", etiqueta: "Alto" },
  { clave: "medio", etiqueta: "Medio" },
  { clave: "bajo", etiqueta: "Bajo" },
] as const;

/** Cuántas situaciones hay de un nivel, con su color. */
function FilaNivel({ clave, etiqueta, cantidad }: { clave: "alto" | "medio" | "bajo"; etiqueta: string; cantidad: number }) {
  const paleta = PALETA_ZONA[clave];
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      px="3"
      py="2"
      rounded="md"
      bg={`${paleta}.subtle`}
      borderWidth="1px"
      borderColor={`${paleta}.border`}
    >
      <Flex align="center" gap="2">
        <Box w="2.5" h="2.5" rounded="full" bg={`${paleta}.solid`} aria-hidden />
        <Text fontSize="sm" color={`${paleta}.fg`} fontWeight="semibold">
          {etiqueta}
        </Text>
      </Flex>
      <Text fontSize="lg" fontWeight="bold" color={`${paleta}.fg`} fontVariantNumeric="tabular-nums">
        {cantidad}
      </Text>
    </Flex>
  );
}

/**
 * Matriz de riesgo: impacto (filas, el más alto arriba) por probabilidad
 * (columnas). Cada celda cuenta las situaciones abiertas con esa combinación.
 * La esquina de arriba a la derecha es la zona crítica. No cuenta lo que un
 * plan de acción verificado ya tiene bajo control (riesgo tratado, como el
 * banner de Notificaciones).
 *
 * Al lado, el resumen por nivel y lo que la grilla de situaciones sueltas no
 * muestra: los elementos en riesgo alto por la suma de varias situaciones y lo
 * que exige un plan de acción.
 */
export function TarjetaMatrizRiesgo({ matriz, cargando, error }: TarjetaMatrizRiesgoProps) {
  const tema = TEMAS_AREA.calidad;
  const total = matriz.total;
  const niveles = contarPorNivel(matriz);
  const resumen =
    total === 0
      ? "Matriz de riesgo: no hay situaciones abiertas."
      : `Matriz de riesgo: ${total} ${total === 1 ? "situación abierta" : "situaciones abiertas"}, repartidas por impacto y probabilidad.`;

  return (
    <TarjetaInicio>
      <EncabezadoTarjeta
        icono={LuShieldAlert}
        fondoIcono={tema.fondo[1]}
        colorIcono={tema.acento}
        titulo="Matriz de riesgo"
        bajada={
          cargando && total === 0
            ? "Cargando…"
            : `${total} ${total === 1 ? "situación abierta" : "situaciones abiertas"}`
        }
      />

      {error ? (
        <MensajeError>{error}</MensajeError>
      ) : (
        <Flex flex="1" minH="0" gap={{ base: "4", md: "6" }} direction={{ base: "column", md: "row" }}>
          <Flex direction="column" flex="1" minW="0">
            <GrillaMatrizRiesgo matriz={matriz} resumen={resumen} grande enlaceCelda={rutaDeCelda} />
            <Text fontSize="2xs" color="fg.subtle" mt="2" textAlign="center">
              Probabilidad →
            </Text>
          </Flex>

          <Stack gap="2" w={{ base: "full", md: "13rem" }} flexShrink={0}>
            {NIVELES.map(({ clave, etiqueta }) => (
              <FilaNivel key={clave} clave={clave} etiqueta={etiqueta} cantidad={niveles[clave]} />
            ))}

            {matriz.elementosAlto > 0 || matriz.planesRequeridos > 0 ? (
              <Box mt="1" px="3" py="2" rounded="md" bg="riesgo.alto.subtle" borderWidth="1px" borderColor="riesgo.alto.border">
                {matriz.elementosAlto > 0 ? (
                  <Text fontSize="xs" color="riesgo.alto.fg" fontWeight="semibold">
                    {matriz.elementosAlto} {matriz.elementosAlto === 1 ? "elemento" : "elementos"} en riesgo alto
                  </Text>
                ) : null}
                {matriz.planesRequeridos > 0 ? (
                  <Flex align="center" gap="1.5" mt={matriz.elementosAlto > 0 ? "1" : "0"}>
                    <Box color="riesgo.alto.fg" aria-hidden>
                      <LuClipboardCheck size={14} />
                    </Box>
                    <Text fontSize="xs" color="riesgo.alto.fg">
                      {matriz.planesRequeridos}{" "}
                      {matriz.planesRequeridos === 1 ? "situación exige" : "situaciones exigen"} plan de acción
                    </Text>
                  </Flex>
                ) : null}
              </Box>
            ) : null}

            <Text fontSize="2xs" color="fg.subtle">
              {matriz.controladas > 0
                ? `${matriz.controladas} ${matriz.controladas === 1 ? "bajo control de un plan" : "bajo control de planes"}`
                : ""}
              {matriz.controladas > 0 && matriz.sinPuntaje > 0 ? " · " : ""}
              {matriz.sinPuntaje > 0 ? `${matriz.sinPuntaje} sin puntaje` : ""}
            </Text>

            <Link
              asChild
              mt="auto"
              display="inline-flex"
              alignItems="center"
              gap="1"
              fontSize="sm"
              fontWeight="medium"
              color={tema.acento}
              textDecoration="none"
              _hover={{ textDecoration: "none" }}
            >
              <RouterLink to="/notificaciones">
                Ver situaciones
                <LuArrowRight size={14} aria-hidden />
              </RouterLink>
            </Link>
          </Stack>
        </Flex>
      )}
    </TarjetaInicio>
  );
}
