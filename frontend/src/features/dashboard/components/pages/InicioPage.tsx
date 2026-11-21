import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  IconButton,
  SimpleGrid,
  Skeleton,
  SkeletonCircle,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar, puedeOperar } from "../../../../common/api/permissions";
import {
  EstadoVacio,
  MensajeError,
} from "../../../../components/ui/patrones";
import { useInicio } from "../../hooks/useInicio";
import { ChecklistDeHoy } from "../ChecklistDeHoy";
import { TarjetaHoy, VencenHoy } from "../TarjetaHoy";

function saludo(hora: number): string {
  if (hora < 12) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** "martes 17 de noviembre". */
function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

function horaCorta(fecha: Date): string {
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Inicio: SOLO lo del día de hoy. En pantallas anchas llena el alto de la
 * pantalla; si no entra, se scrollea hacia abajo.
 *
 * A la izquierda, el checklist de limpieza de hoy (lo que más se mira en el
 * día); a la derecha, las cifras de hoy de cada área (lotes iniciados y
 * terminados, salidas, insumos recibidos, incidentes, reclamos, retiros) y,
 * para quien administra, lo que vence hoy. Las tendencias y el análisis del
 * período están en el panel de cada área, no acá.
 */
export function InicioPage() {
  const { user } = useAuth();
  const habilitado = puedeOperar(user) || puedeAdministrar(user);
  const { inicio, loading, error, recargar, actualizado } = useInicio(habilitado, user?.id);

  if (!habilitado) {
    return (
      <Box flex="1" display="flex" flexDirection="column">
        <EstadoVacio>
          Tu usuario no tiene permisos habilitados para ver el panel. Comunicate
          con un administrador.
        </EstadoVacio>
      </Box>
    );
  }

  const ahora = new Date();
  const cargado = inicio.fecha !== "";
  const produccion = inicio.grupos.find((g) => g.clave === "produccion");
  const calidad = inicio.grupos.find((g) => g.clave === "calidad");
  const inventario = inicio.grupos.find((g) => g.clave === "inventario");

  const separacion = "5";

  const grilla = (
    <Grid
      flex="1"
      templateColumns="repeat(12, minmax(0, 1fr))"
      // `1fr` (y no `minmax(0, 1fr)`): la fila estira las tarjetas hasta el
      // pie de la pantalla, pero nunca por debajo de su alto natural.
      templateRows={{ base: "auto", lg: "1fr" }}
      gap={separacion}
    >
      <GridItem gridColumn={{ base: "span 12", lg: "span 5" }}>
        <ChecklistDeHoy checklist={inicio.checklist} />
      </GridItem>

      <GridItem gridColumn={{ base: "span 12", lg: "span 7" }}>
        <Stack gap={separacion} h="full">
          {/* Producción y Calidad con su alto natural; la última fila
              (Inventario y Vence hoy) ocupa lo que sobra, así la columna
              termina a la par del checklist. */}
          {produccion ? (
            <Box flexShrink={0}>
              <TarjetaHoy grupo={produccion} />
            </Box>
          ) : null}
          {calidad ? (
            <Box flexShrink={0}>
              <TarjetaHoy grupo={calidad} />
            </Box>
          ) : null}
          {inventario || inicio.vencen_hoy ? (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={separacion} flex="1">
              {inventario ? <TarjetaHoy grupo={inventario} /> : null}
              {inicio.vencen_hoy ? <VencenHoy filas={inicio.vencen_hoy} /> : null}
            </SimpleGrid>
          ) : null}
        </Stack>
      </GridItem>
    </Grid>
  );

  return (
    // En pantallas anchas el inicio ocupa al menos el alto disponible (las
    // tarjetas se estiran hasta el pie), pero si su contenido no entra crece
    // y el <main> scrollea. Antes la columna se achicaba al alto del <main>
    // (`minH="0"`) y en pantallas bajas las tarjetas quedaban cortadas.
    <Box flex="1" display="flex" flexDirection="column" gap="4">
      {/* Saludo sobre el degradado de la página (lo pone el layout en el
          Inicio): sin caja propia, texto blanco directo sobre el fondo. */}
      <Flex align="center" justify="space-between" gap="4" wrap="wrap" flexShrink={0} color="white">
        <Box minW="0">
          <Heading as="h2" fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="white" lineHeight="1.25">
            {saludo(ahora.getHours())}
            {user?.nombre ? `, ${user.nombre}` : ""}
          </Heading>
          <Text fontSize="sm" color="whiteAlpha.800" mt="0.5">
            Hoy, {fechaLarga(ahora)}
          </Text>
        </Box>
        <Flex align="center" gap="3" wrap="wrap">
          {actualizado ? (
            // Blanco pleno: a la derecha el degradado es más claro.
            <Flex align="center" gap="1" color="white" fontSize="xs" fontWeight="medium">
              Actualizado {horaCorta(actualizado)}
              <IconButton
                aria-label="Actualizar los datos de hoy"
                size="xs"
                variant="ghost"
                color="whiteAlpha.800"
                _hover={{ bg: "whiteAlpha.200", color: "white" }}
                onClick={() => void recargar()}
                loading={loading}
              >
                <LuRefreshCw />
              </IconButton>
            </Flex>
          ) : null}
        </Flex>
      </Flex>

      {/* Primera carga (sin datos guardados): el esqueleto de las tarjetas,
          así la página se ve armada desde que empieza a entrar. */}
      {loading && !cargado && <EsqueletoInicio />}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!error && cargado ? (
        // El degradado sigue 65px por detrás de las tarjetas y desde
        // ahí el fondo es gris-menta claro, de borde a borde de la pantalla
        // (los márgenes negativos anulan el relleno del <main>). Así la parte
        // de arriba de las tarjetas se apoya sobre el teal y las calles entre
        // ellas quedan sobre el fondo claro.
        <Box
          flex="1"
          display="flex"
          flexDirection="column"
          mx={{ base: "-2", md: "-30px" }}
          mb={{ base: "-2", md: "-15px" }}
          px={{ base: "2", md: "30px" }}
          pb={{ base: "2", md: "15px" }}
          backgroundImage={`linear-gradient(to bottom, transparent ${SUPERPOSICION}, ${FONDO_CLARO} ${SUPERPOSICION})`}
        >
          {grilla}
        </Box>
      ) : null}

    </Box>
  );
}

/**
 * Esqueleto del inicio mientras llegan los datos por primera vez: las cinco
 * tarjetas blancas en su lugar, con bloques grises donde van los números.
 */
function EsqueletoInicio() {
  const tarjeta = {
    bg: "bg.panel",
    rounded: "14px",
    p: "5",
    boxShadow: "0 8px 20px -4px rgba(15, 50, 55, 0.07), 0 2px 6px -1px rgba(15, 50, 55, 0.04)",
  } as const;
  const lineas = (n: number) => (
    <Stack gap="3" mt="4">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} h="4" w={i % 2 ? "60%" : "85%"} rounded="md" />
      ))}
    </Stack>
  );
  return (
    <Grid
      flex="1"
      templateColumns="repeat(12, minmax(0, 1fr))"
      templateRows={{ base: "auto", lg: "1fr" }}
      gap="4"
      aria-busy="true"
      aria-label="Cargando lo de hoy"
    >
      <GridItem gridColumn={{ base: "span 12", lg: "span 5" }} {...tarjeta}>
        <Skeleton h="6" w="60%" rounded="md" />
        <Flex gap="5" mt="5" align="center">
          <SkeletonCircle size="24" />
          <Stack gap="2" flex="1">
            <Skeleton h="8" w="40%" rounded="md" />
            <Skeleton h="4" w="60%" rounded="md" />
          </Stack>
        </Flex>
        {lineas(6)}
      </GridItem>
      <GridItem gridColumn={{ base: "span 12", lg: "span 7" }}>
        <Stack gap="4" h="full">
          {[3, 4].map((n) => (
            <Box key={n} {...tarjeta}>
              <Skeleton h="6" w="30%" rounded="md" />
              <SimpleGrid columns={n} gap="4" mt="4">
                {Array.from({ length: n }, (_, i) => (
                  <Skeleton key={i} h="12" rounded="md" />
                ))}
              </SimpleGrid>
            </Box>
          ))}
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" flex="1">
            <Box {...tarjeta}>
              <Skeleton h="6" w="40%" rounded="md" />
              {lineas(2)}
            </Box>
            <Box {...tarjeta}>
              <Skeleton h="6" w="40%" rounded="md" />
              {lineas(2)}
            </Box>
          </SimpleGrid>
        </Stack>
      </GridItem>
    </Grid>
  );
}

/** Cuánto se meten las tarjetas en el degradado, y el fondo claro de abajo. */
const SUPERPOSICION = "65px";
const FONDO_CLARO = "var(--chakra-colors-inicio-fondo)";
