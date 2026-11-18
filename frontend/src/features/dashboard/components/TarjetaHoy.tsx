import type { ReactNode } from "react";
import { Box, Flex, Grid, Heading, Link, Stack, Text, type BoxProps } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import type { IconType } from "react-icons/lib";
import {
  LuArrowRight,
  LuCalendarClock,
  LuCircleCheck,
  LuInfo,
  LuPackageCheck,
  LuPackagePlus,
} from "react-icons/lu";
import { GRUPOS, rutaPanel } from "../../../common/components/menuEntradas";
import { Tarjeta, type TonoEstado } from "../../../components/ui/patrones";
import { cantidadConUnidad, formatoCantidad } from "../../../common/utils/numeros";
import type { CifraHoy, FilaAtencion, GrupoHoy } from "../types/paneles";
import { TEMAS_AREA } from "../types/temasArea";

/**
 * Rojo y ámbar SOLO cuando lo de hoy pide atención (un retiro, un incidente):
 * una cifra en cero o normal va en la tinta de siempre.
 */
const COLOR_TONO: Partial<Record<TonoEstado, string>> = {
  peligro: "red.700",
  alerta: "#8a5a12",
};
/** Punto indicador junto a la cifra, del mismo tono que el número. */
const COLOR_PUNTO: Partial<Record<TonoEstado, string>> = {
  peligro: "red.500",
  alerta: "#d4a02a",
};
/** Divisor entre métricas: gris claro, apenas visible. */
const COLOR_DIVISOR = "gray.200";

/* ───────────────────────────── Piezas comunes ───────────────────────────── */

interface TarjetaInicioProps extends BoxProps {
  children: ReactNode;
}

/**
 * Tarjeta del inicio: blanca, esquinas de 14px, borde casi invisible y una
 * sombra suave y difusa. Sin filete de color arriba: contra el fondo teal era
 * ruido, y el ícono del encabezado ya da el color de cada área.
 */
export function TarjetaInicio({ children, ...rest }: TarjetaInicioProps) {
  return (
    <Tarjeta
      position="relative"
      h="full"
      display="flex"
      flexDirection="column"
      p={{ base: "5", lg: "3.5", "2xl": "5" }}
      bg="white"
      rounded="14px"
      borderWidth="1px"
      borderColor="blackAlpha.50"
      boxShadow="0 8px 20px -4px rgba(15, 50, 55, 0.07), 0 2px 6px -1px rgba(15, 50, 55, 0.04)"
      {...rest}
    >
      {children}
    </Tarjeta>
  );
}

interface EncabezadoTarjetaProps {
  icono: IconType;
  /** Fondo suave del ícono y color del ícono. */
  fondoIcono: string;
  colorIcono: string;
  titulo: string;
  bajada?: ReactNode;
  /** Acción de la esquina superior derecha (p. ej. "Ir a Producción →"). */
  accion?: ReactNode;
}

/**
 * Encabezado único de las tarjetas del inicio: ícono con fondo suave,
 * título, bajada opcional y una acción a la derecha. Todas las tarjetas lo
 * usan, así quedan alineadas y con la misma jerarquía.
 */
export function EncabezadoTarjeta({ icono: Icono, fondoIcono, colorIcono, titulo, bajada, accion }: EncabezadoTarjetaProps) {
  return (
    <Flex align="center" gap="3" mb={{ base: "4", lg: "2.5", "2xl": "4" }}>
      <Flex
        align="center"
        justify="center"
        w="9"
        h="9"
        rounded="lg"
        bg={fondoIcono}
        color={colorIcono}
        flexShrink={0}
        aria-hidden
      >
        <Icono size={18} />
      </Flex>
      <Box flex="1" minW="0">
        <Heading as="h3" fontSize="md" fontWeight="semibold" color="fg" lineHeight="1.3">
          {titulo}
        </Heading>
        {bajada ? (
          <Text fontSize="xs" color="fg.muted" mt="0.5">
            {bajada}
          </Text>
        ) : null}
      </Box>
      {accion}
    </Flex>
  );
}

/** Enlace sutil de la esquina: "Ir a Producción →". */
function EnlaceModulo({ to, texto, color }: { to: string; texto: string; color: string }) {
  return (
    <Link
      asChild
      display="inline-flex"
      alignItems="center"
      gap="1"
      flexShrink={0}
      px="2"
      py="1"
      rounded="md"
      fontSize="sm"
      fontWeight="medium"
      color="fg.muted"
      textDecoration="none"
      _hover={{ textDecoration: "none", bg: "gray.50", color }}
    >
      <RouterLink to={to}>
        {texto}
        <LuArrowRight size={14} aria-hidden />
      </RouterLink>
    </Link>
  );
}

/** Caja de estado suave del pie de las tarjetas (gris), con un ícono. */
function PieEstado({ icono: Icono, children, mt = "3" }: { icono: IconType; children: ReactNode; mt?: string }) {
  return (
    <Flex mt={mt} align="flex-start" gap="2" bg="gray.50" px="3" py="2" rounded="md" fontSize="sm" color="fg">
      <Box color="fg.muted" mt="0.5" flexShrink={0} aria-hidden>
        <Icono size={16} />
      </Box>
      <Box flex="1" minW="0">
        {children}
      </Box>
    </Flex>
  );
}

/* ──────────────────────────────── Cifras ──────────────────────────────── */

/** Una cifra del día; si tiene enlace, toda la celda lleva al detalle. */
function Cifra({ cifra, acento }: { cifra: CifraHoy; acento: string }) {
  const color = COLOR_TONO[cifra.tono];
  const conPunto = cifra.valor > 0 && COLOR_PUNTO[cifra.tono];
  const contenido = (
    <Stack gap="1" px="4" py="1.5" rounded="md" h="full" _hover={cifra.link ? { bg: "gray.50" } : undefined}>
      <Flex align="center" gap="2">
        <Text
          fontSize="3xl"
          fontWeight="extrabold"
          lineHeight="1"
          letterSpacing="-0.02em"
          color={color ?? "fg"}
          fontVariantNumeric="tabular-nums"
        >
          {formatoCantidad(cifra.valor)}
        </Text>
        {conPunto ? (
          <>
            <Box w="2" h="2" rounded="full" bg={COLOR_PUNTO[cifra.tono]} flexShrink={0} aria-hidden />
            <Box as="span" srOnly>
              (requiere atención)
            </Box>
          </>
        ) : null}
      </Flex>
      <Text fontSize="sm" color="fg.muted" lineHeight="1.3">
        {cifra.etiqueta}
      </Text>
    </Stack>
  );
  if (!cifra.link) return contenido;
  return (
    <Link
      asChild
      display="block"
      h="full"
      textDecoration="none"
      _hover={{ textDecoration: "none" }}
      _focusVisible={{ outline: "2px solid", outlineColor: acento, outlineOffset: "2px" }}
      rounded="md"
    >
      <RouterLink to={cifra.link}>{contenido}</RouterLink>
    </Link>
  );
}

/**
 * Las cifras en una grilla con divisores verticales finos entre una y otra:
 * en pantallas anchas, todas en una fila; en el celular, de a dos (el
 * divisor solo entre las dos de cada fila).
 */
function GrillaCifras({ cifras, acento }: { cifras: CifraHoy[]; acento: string }) {
  const columnas = Math.max(1, Math.min(cifras.length, 4));
  return (
    <Grid
      templateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: `repeat(${columnas}, minmax(0, 1fr))` }}
      rowGap="3"
      mx="-4"
    >
      {cifras.map((c, i) => (
        <Box
          key={c.clave}
          borderLeftWidth={{ base: i % 2 === 0 ? "0" : "1px", md: i === 0 ? "0" : "1px" }}
          borderColor={COLOR_DIVISOR}
        >
          <Cifra cifra={c} acento={acento} />
        </Box>
      ))}
    </Grid>
  );
}

/* ──────────────────────────── Tarjeta de un área ──────────────────────────── */

/**
 * Las cifras de hoy de un área: encabezado con el ícono del área y "Ir a…"
 * al panel, las cifras con divisores y, en Producción e Inventario, un pie
 * con el estado del día.
 */
export function TarjetaHoy({ grupo }: { grupo: GrupoHoy }) {
  const tema = TEMAS_AREA[grupo.clave];
  const Icono = GRUPOS.find((g) => g.id === grupo.clave)?.icon ?? LuInfo;

  return (
    <TarjetaInicio>
      <EncabezadoTarjeta
        icono={Icono}
        fondoIcono={tema.fondo[1]}
        colorIcono={tema.acento}
        titulo={grupo.titulo}
        accion={<EnlaceModulo to={rutaPanel({ id: grupo.clave })} texto={`Ir a ${grupo.titulo}`} color={tema.acento} />}
      />

      {grupo.clave === "inventario" ? (
        // Una sola cifra: el acceso a registrar el ingreso va al lado (y baja
        // abajo si no entra), así la tarjeta no necesita más alto.
        <Flex align="center" gap="3" wrap="wrap">
          <Box flex="1" minW="110px">
            <GrillaCifras cifras={grupo.cifras} acento={tema.acento} />
          </Box>
          <Box flex="1" minW="170px">
            <PieInventario acento={tema.acento} />
          </Box>
        </Flex>
      ) : (
        <GrillaCifras cifras={grupo.cifras} acento={tema.acento} />
      )}

      {grupo.clave === "produccion" ? <PieProduccion grupo={grupo} /> : null}
    </TarjetaInicio>
  );
}

function PieProduccion({ grupo }: { grupo: GrupoHoy }) {
  if (grupo.producido.length === 0) {
    return <PieEstado icono={LuInfo}>Todavía no se terminó ningún lote hoy.</PieEstado>;
  }
  return (
    <PieEstado icono={LuPackageCheck}>
      <Stack gap="0.5">
        {grupo.producido.map((d) => (
          <Text key={d.unidad}>
            <Text as="span" fontWeight="semibold">
              Producido hoy: {cantidadConUnidad(d.cantidad, d.unidad)}
            </Text>
            <Text as="span" color="fg.muted">
              {" "}·{" "}
              {d.productos
                .slice(0, 3)
                .map((p) => `${p.producto} ${cantidadConUnidad(p.cantidad, d.unidad)}`)
                .join(", ")}
              {d.productos.length > 3 ? ` y ${d.productos.length - 3} más` : ""}
            </Text>
          </Text>
        ))}
      </Stack>
    </PieEstado>
  );
}

/** Pie de Inventario: acceso directo a registrar el ingreso de un lote. */
function PieInventario({ acento }: { acento: string }) {
  return (
    <PieEstado icono={LuPackagePlus} mt="0">
      <Link
        asChild
        fontWeight="medium"
        color={acento}
        display="inline-flex"
        alignItems="center"
        gap="1"
        whiteSpace="nowrap"
      >
        <RouterLink to="/lotes-insumo/nuevo">
          Registrar ingreso
          <LuArrowRight size={14} aria-hidden />
        </RouterLink>
      </Link>
    </PieEstado>
  );
}

/* ──────────────────────────────── Vence hoy ──────────────────────────────── */

/**
 * Lo que vence hoy (lotes de insumo, aptitudes, calibraciones, mantenimientos
 * y documentos). El rojo del ícono aparece solo si algo vence; sin
 * vencimientos, va en verde con una caja de estado centrada.
 */
export function VencenHoy({ filas }: { filas: FilaAtencion[] }) {
  const hay = filas.length > 0;

  return (
    <TarjetaInicio>
      <EncabezadoTarjeta
        icono={LuCalendarClock}
        fondoIcono={hay ? "red.50" : "green.50"}
        colorIcono={hay ? "red.700" : "green.700"}
        titulo="Vence hoy"
        bajada={hay ? `${filas.length} ${filas.length === 1 ? "vencimiento" : "vencimientos"}` : undefined}
      />

      {hay ? (
        <Stack gap="0" as="ul" listStyleType="none" m="0" p="0">
          {filas.map((f) => (
            <Box as="li" key={f.clave} borderTopWidth="1px" borderColor="border.subtle" _first={{ borderTopWidth: "0" }}>
              <Link
                asChild
                display="flex"
                alignItems="center"
                gap="3"
                px="2"
                mx="-2"
                py="2"
                rounded="md"
                fontSize="sm"
                color="fg"
                textDecoration="none"
                _hover={{ textDecoration: "none", bg: "gray.50", color: "red.700" }}
              >
                <RouterLink to={f.link ?? "/vencimientos"}>
                  <Text as="span" flex="1" minW="0" truncate title={f.titulo}>
                    {f.titulo}
                  </Text>
                  <Text as="span" fontSize="xs" color="fg.muted" flexShrink={0}>
                    {f.estado}
                  </Text>
                  <LuArrowRight size={14} aria-hidden />
                </RouterLink>
              </Link>
            </Box>
          ))}
        </Stack>
      ) : (
        <Flex flex="1" align="center" justify="center">
          {/* En pantallas anchas, en una fila (ícono a la izquierda) para no
              pedir más alto; en el celular, centrado en columna. */}
          <Flex
            direction={{ base: "column", lg: "row" }}
            align="center"
            textAlign={{ base: "center", lg: "left" }}
            gap="3"
            w="full"
            bg="green.50"
            borderWidth="1px"
            borderColor="green.100"
            rounded="md"
            px="4"
            py={{ base: "5", lg: "3" }}
          >
            <Box color="green.600" flexShrink={0} aria-hidden>
              <LuCircleCheck size={28} />
            </Box>
            <Box>
              <Text fontWeight="semibold" color="green.800">
                Nada vence hoy
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Ni lotes, aptitudes, calibraciones ni documentos.
              </Text>
            </Box>
          </Flex>
        </Flex>
      )}
    </TarjetaInicio>
  );
}
