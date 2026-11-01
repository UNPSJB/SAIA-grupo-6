import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";
import {
  LuFileCheck,
  LuRefreshCw,
  LuShieldCheck,
  LuSparkles,
  LuTriangleAlert,
  LuUserCheck,
  LuWrench,
} from "react-icons/lu";
import { useParams } from "react-router-dom";

import {
  obtenerIndicadoresPublicos,
  validarVistaPublica,
  VistaPublicaNoDisponibleError,
} from "../../services/vistaPublicaPublicaService";
import type { IndicadorPublico } from "../../types/vistaPublica";

type EstadoVistaPublica = "cargando" | "disponible" | "no_disponible" | "error";

function formatearValor(indicador: IndicadorPublico): string {
  if (indicador.valor === null) return "Sin datos";
  if (indicador.formato === "porcentaje") {
    return `${indicador.valor.toLocaleString("es-AR", {
      maximumFractionDigits: 1,
    })} %`;
  }
  return String(indicador.valor);
}

// Un ícono por indicador. Una clave nueva sin ícono cae en el escudo.
const ICONOS_POR_CLAVE: Record<string, IconType> = {
  cumplimiento_poes: LuSparkles,
  equipos_al_dia: LuWrench,
  personal_apto: LuUserCheck,
  documentos_vigentes: LuFileCheck,
  elementos_al_dia: LuRefreshCw,
};

// A partir de este porcentaje el indicador se pinta de verde. Debajo se usa el
// color de la marca: en una página pública nunca se usa rojo, porque un valor
// intermedio no es una alarma y no debe leerse como tal.
const NIVEL_ALTO = 90;

function paletaPorNivel(valor: number): "green" | "brand" {
  return valor >= NIVEL_ALTO ? "green" : "brand";
}

function formatearTendencia(tendencia: number): string {
  return `▲ +${tendencia.toLocaleString("es-AR", {
    maximumFractionDigits: 1,
  })} puntos vs. los 30 días anteriores`;
}

export function VistaPublicaPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [estado, setEstado] = useState<EstadoVistaPublica>("cargando");
  const [indicadores, setIndicadores] = useState<IndicadorPublico[]>([]);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    const validar = async () => {
      if (!codigo) {
        if (!cancelado) setEstado("no_disponible");
        return;
      }

      if (!cancelado) setEstado("cargando");
      try {
        const valida = await validarVistaPublica(codigo);
        if (!valida) {
          if (!cancelado) setEstado("no_disponible");
          return;
        }

        const datos = await obtenerIndicadoresPublicos(codigo);
        if (!cancelado) {
          // Defensa extra: una tarjeta sin valor se vería como un dato roto.
          setIndicadores(datos.filter((indicador) => indicador.valor !== null));
          setEstado("disponible");
        }
      } catch (e) {
        if (!cancelado) {
          setEstado(
            e instanceof VistaPublicaNoDisponibleError
              ? "no_disponible"
              : "error",
          );
        }
      }
    };

    // La primera validación se difiere igual que otras cargas iniciales de SAIA.
    const timeoutId = window.setTimeout(() => void validar(), 0);
    const alRecuperarFoco = () => void validar();
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") void validar();
    };
    window.addEventListener("focus", alRecuperarFoco);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      cancelado = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", alRecuperarFoco);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [codigo, intento]);

  return (
    <Flex
      minH="100dvh"
      bg="brand.50"
      align="center"
      justify="center"
      p={{ base: "5", md: "8" }}
    >
      <Box
        w="full"
        maxW={estado === "disponible" ? "3xl" : "xl"}
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        rounded="xl"
        px={{ base: "6", md: "10" }}
        py={{ base: "10", md: "12" }}
        textAlign="center"
        boxShadow="sm"
      >
        <Stack align="center" gap="6">
          <Flex
            w="14"
            h="14"
            rounded="full"
            bg="brand.600"
            color="white"
            align="center"
            justify="center"
          >
            <LuShieldCheck size={30} aria-hidden />
          </Flex>
          <Stack gap="1">
            <Text fontWeight="bold" color="brand.700" letterSpacing="wide">
              SAIA
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Sistema de Apoyo a la Inocuidad Alimentaria
            </Text>
          </Stack>

          {estado === "cargando" ? (
            <Stack align="center" gap="3" role="status" aria-live="polite">
              <Spinner size="lg" color="brand.500" />
              <Text color="fg.muted">Cargando indicadores públicos...</Text>
            </Stack>
          ) : null}

          {estado === "disponible" ? (
            <Stack align="center" gap="5" w="full">
              <Stack align="center" gap="2">
                <Heading as="h1" size="xl" color="fg">
                  Indicadores de buenas prácticas
                </Heading>
                <Text color="fg.muted">
                  Indicadores agregados del establecimiento, actualizados en
                  tiempo real.
                </Text>
              </Stack>

              {indicadores.length === 0 ? (
                <Box
                  w="full"
                  p="6"
                  bg="bg.subtle"
                  rounded="lg"
                  borderWidth="1px"
                  borderColor="border.subtle"
                >
                  <Text color="fg.muted">
                    Todavía no hay indicadores para mostrar.
                  </Text>
                </Box>
              ) : (
                <SimpleGrid
                  columns={{ base: 1, md: 2 }}
                  gap="4"
                  w="full"
                  textAlign="left"
                >
                  {indicadores.map((indicador, indice) => {
                    const Icono = ICONOS_POR_CLAVE[indicador.clave] ?? LuShieldCheck;
                    const valor = Math.min(100, Math.max(0, indicador.valor ?? 0));
                    const paleta = paletaPorNivel(valor);
                    // Con cantidad impar, la última tarjeta ocupa todo el ancho
                    // para no quedar sola en una esquina.
                    const ocupaTodoElAncho =
                      indicadores.length % 2 === 1 &&
                      indice === indicadores.length - 1;

                    return (
                      <Box
                        key={indicador.clave}
                        gridColumn={{
                          base: "auto",
                          md: ocupaTodoElAncho ? "1 / -1" : "auto",
                        }}
                        p="5"
                        bg="bg.subtle"
                        rounded="lg"
                        borderWidth="1px"
                        borderColor="border.subtle"
                      >
                        {/* Reserva dos líneas de título en la grilla de dos
                            columnas: así el número y la barra quedan a la misma
                            altura aunque un título ocupe una línea y otro dos. */}
                        <Flex
                          align="center"
                          gap="3"
                          minH={{ base: "auto", md: "3em" }}
                        >
                          <Flex
                            w="9"
                            h="9"
                            flexShrink={0}
                            rounded="full"
                            bg={`${paleta}.100`}
                            color={`${paleta}.700`}
                            align="center"
                            justify="center"
                          >
                            <Icono size={18} aria-hidden />
                          </Flex>
                          <Text fontWeight="semibold" color="fg">
                            {indicador.etiqueta}
                          </Text>
                        </Flex>

                        <Text
                          mt="3"
                          fontSize="2xl"
                          fontWeight="bold"
                          color="brand.700"
                        >
                          {formatearValor(indicador)}
                        </Text>

                        <Progress.Root
                          mt="2"
                          value={valor}
                          max={100}
                          size="md"
                          colorPalette={paleta}
                          aria-label={`${indicador.etiqueta}: ${formatearValor(indicador)}`}
                        >
                          <Progress.Track rounded="full">
                            <Progress.Range rounded="full" />
                          </Progress.Track>
                        </Progress.Root>

                        {(indicador.tendencia ?? 0) > 0 ? (
                          <Text
                            mt="2"
                            fontSize="sm"
                            fontWeight="semibold"
                            color="green.fg"
                          >
                            {formatearTendencia(indicador.tendencia ?? 0)}
                          </Text>
                        ) : null}

                        <Text mt="2" fontSize="sm" color="fg.muted">
                          {indicador.descripcion}
                        </Text>
                      </Box>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>
          ) : null}

          {estado === "no_disponible" ? (
            <Stack align="center" gap="3">
              <LuTriangleAlert
                size={36}
                color="var(--chakra-colors-orange-500)"
                aria-hidden
              />
              <Heading as="h1" size="xl" color="fg">
                Esta vista pública no está disponible
              </Heading>
              <Text color="fg.muted">
                Verificá el enlace o solicitá uno nuevo al establecimiento.
              </Text>
            </Stack>
          ) : null}

          {estado === "error" ? (
            <Stack align="center" gap="4">
              <LuTriangleAlert
                size={36}
                color="var(--chakra-colors-red-500)"
                aria-hidden
              />
              <Heading as="h1" size="xl" color="fg">
                No se pudieron cargar los indicadores
              </Heading>
              <Text color="fg.muted">
                Revisá tu conexión e intentá nuevamente.
              </Text>
              <Button
                onClick={() => setIntento((actual) => actual + 1)}
                colorPalette="brand"
              >
                Reintentar
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Flex>
  );
}