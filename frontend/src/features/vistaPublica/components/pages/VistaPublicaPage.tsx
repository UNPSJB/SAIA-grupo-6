import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  ProgressCircle,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";
import {
  LuFileCheck,
  LuPackageCheck,
  LuTag,
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
  lotes_con_receta_trazable: LuPackageCheck,
  productos_con_rotulado_revisado: LuTag,
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

const CLAVES_CONTROL_ALIMENTOS = new Set([
  "lotes_con_receta_trazable",
  "productos_con_rotulado_revisado",
]);
const DEGRADADO_ENCABEZADO = "radial-gradient(ellipse at 100% 0%, rgba(82, 171, 172, 0.32), transparent 65%)";

function valorGrafico(indicador: IndicadorPublico) {
  return Math.min(100, Math.max(0, indicador.valor ?? 0));
}

function TarjetaIndicador({ indicador }: { indicador: IndicadorPublico }) {
  const Icono = ICONOS_POR_CLAVE[indicador.clave] ?? LuShieldCheck;
  const valor = valorGrafico(indicador);
  const paleta = paletaPorNivel(valor);

  return (
    <Stack
      as="article"
      direction={{ base: "column", sm: "row" }}
      align={{ base: "start", sm: "center" }}
      gap={{ base: "4", md: "6" }}
      p={{ base: "5", md: "6" }}
      bg="bg.panel"
      rounded="2xl"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      <ProgressCircle.Root
        value={valor}
        colorPalette={paleta}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
      >
        <ProgressCircle.Circle
          aria-label={indicador.etiqueta}
          aria-valuetext={formatearValor(indicador)}
          css={{ "--size": "110px", "--thickness": "8px" }}
        >
          <ProgressCircle.Track />
          <ProgressCircle.Range strokeLinecap="round" />
        </ProgressCircle.Circle>
        <ProgressCircle.ValueText position="absolute" color="fg" fontSize="xl" fontWeight="bold">
          {formatearValor(indicador)}
        </ProgressCircle.ValueText>
      </ProgressCircle.Root>

      <Stack gap="2" minW="0">
        <Box color={`${paleta}.fg`}><Icono size={20} aria-hidden /></Box>
        <Heading as="h3" size="md">{indicador.etiqueta}</Heading>
        <Text color="fg.muted" fontSize="sm">{indicador.descripcion}</Text>
        {(indicador.tendencia ?? 0) > 0 && (
          <Text fontSize="xs" fontWeight="semibold" color="green.fg">
            {formatearTendencia(indicador.tendencia ?? 0)}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

function PanelBuenasPracticas({ indicadores }: { indicadores: IndicadorPublico[] }) {
  return (
    <Stack
      as="section"
      aria-labelledby="buenas-practicas"
      gap="4"
      w="full"
    >
      <Heading
        as="h2"
        id="buenas-practicas"
        size="lg"
        px={{ base: "5", md: "6" }}
        py="4"
        rounded="xl"
        color="white"
        bg="brandLight.900"
        bgImage={DEGRADADO_ENCABEZADO}
      >
        Buenas prácticas operativas
      </Heading>
      <SimpleGrid columns={{ base: 1, md: indicadores.length > 1 ? 2 : 1 }} gap="4">
        {indicadores.map((indicador) => <TarjetaIndicador key={indicador.clave} indicador={indicador} />)}
      </SimpleGrid>
    </Stack>
  );
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

  const buenasPracticas = indicadores.filter(({ clave }) => !CLAVES_CONTROL_ALIMENTOS.has(clave));
  const controlAlimentos = indicadores.filter(({ clave }) => CLAVES_CONTROL_ALIMENTOS.has(clave));

  return (
    <Box as="main" minH="100dvh" bg="brand.50" color="fg" px={{ base: "4", md: "8" }} py={{ base: "5", md: "10" }}>
      <Stack maxW="6xl" mx="auto" gap={{ base: "6", md: "8" }}>
        <Stack
          as="header"
          gap={{ base: "5", md: "7" }}
          p={{ base: "5", md: "8" }}
          rounded="2xl"
          color="white"
          bg="brandLight.900"
          bgImage={DEGRADADO_ENCABEZADO}
        >
          <HStack gap="3" align="center">
            <Flex boxSize="10" flexShrink={0} rounded="xl" bg="whiteAlpha.200" align="center" justify="center">
              <LuShieldCheck size={23} aria-hidden />
            </Flex>
            <Stack gap="0">
              <Text fontWeight="bold" letterSpacing="wide">SAIA</Text>
              <Text color="whiteAlpha.900" fontSize="sm">Sistema de Apoyo a la Inocuidad Alimentaria</Text>
            </Stack>
          </HStack>
          {estado === "disponible" && (
            <Stack gap="2">
              <Heading as="h1" size={{ base: "2xl", md: "4xl" }}>Buenas prácticas del establecimiento</Heading>
              <Text color="whiteAlpha.900">Indicadores públicos de higiene y control de alimentos.</Text>
            </Stack>
          )}
        </Stack>

        <Stack gap={{ base: "6", md: "8" }}>
          {estado === "cargando" ? (
            <Stack align="center" textAlign="center" p="6" gap="3" role="status" aria-live="polite">
              <Spinner size="lg" color="brand.500" />
              <Text color="fg.muted">Cargando indicadores públicos...</Text>
            </Stack>
          ) : null}

          {estado === "disponible" && (
            <>
              {indicadores.length === 0 && (
                <Box w="full" p="6" bg="bg.panel" rounded="2xl" borderWidth="1px" borderColor="border.subtle">
                  <Text color="fg.muted">Todavía no hay indicadores para mostrar.</Text>
                </Box>
              )}
              {controlAlimentos.length > 0 && (
                <Stack as="section" aria-labelledby="control-alimentos" gap="4" w="full">
                  <Heading as="h2" id="control-alimentos" size="lg">Control de alimentos</Heading>
                  <SimpleGrid columns={{ base: 1, md: controlAlimentos.length > 1 ? 2 : 1 }} gap="4">
                    {controlAlimentos.map((indicador) => <TarjetaIndicador key={indicador.clave} indicador={indicador} />)}
                  </SimpleGrid>
                </Stack>
              )}
              {buenasPracticas.length > 0 && <PanelBuenasPracticas indicadores={buenasPracticas} />}
            </>
          )}

          {estado === "no_disponible" ? (
            <Stack align="center" textAlign="center" p="6" gap="3">
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
            <Stack align="center" textAlign="center" p="6" gap="4">
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
      </Stack>
    </Box>
  );
}
