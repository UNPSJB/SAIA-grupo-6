import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Flex, Grid, HStack, Link, Stack, Text, type BoxProps } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import {
  EstadoCargando,
  EtiquetaEstado,
  MensajeError,
  Tarjeta,
  type TonoEstado,
} from "../../../components/ui/patrones";
import { formatoCantidad } from "../../../common/utils/numeros";
import { TarjetaPanel } from "./TarjetaPanel";

/*
 * Piezas de los paneles de categoría (Producción, Inventario, ...).
 *
 * Son tres formas, elegidas por lo que el dato tiene que decir:
 *   - `Indicador`: un número que se lee de un vistazo (cuántos hay, cuántos
 *     están en falta). No es un gráfico a propósito.
 *   - `BarrasHorizontales`: comparar cantidades entre pocas categorías con
 *     nombre (equipos por sector, personal por rol).
 *   - `ListaPanel`: los casos puntuales que piden atención (qué vence, qué
 *     falta), con su estado y un enlace a la ficha.
 */

/* ───────────────────────────── Indicador ───────────────────────────── */

/** Color del número según lo que significa. Sin tono: dato informativo. */
const COLOR_TONO: Partial<Record<TonoEstado, string>> = {
  ok: "green.fg",
  alerta: "orange.fg",
  peligro: "red.fg",
};

interface IndicadorProps {
  titulo: string;
  /** El número (o texto corto) principal. */
  valor: ReactNode;
  /** Aclaración debajo del número: "de 12 insumos", "últimos 30 días". */
  detalle?: ReactNode;
  /** Semáforo del dato. Se aplica solo si corresponde (p. ej. si hay vencidos). */
  tono?: TonoEstado;
  /** Si viene, la tarjeta entera es un enlace a la pantalla donde se gestiona. */
  to?: string;
  loading?: boolean;
  error?: string | null;
}

/** Tarjeta de un solo número. */
export function Indicador({ titulo, valor, detalle, tono, to, loading, error }: IndicadorProps) {
  const contenido = (
    <>
      <Text fontSize="sm" fontWeight="medium" color="fg.muted">
        {titulo}
      </Text>
      <Text
        mt="2"
        fontSize="3xl"
        fontWeight="bold"
        lineHeight="1.1"
        // El estado va también en palabras en `detalle`: el color acompaña.
        color={(tono && COLOR_TONO[tono]) || "fg"}
        aria-busy={loading || undefined}
      >
        {loading ? "…" : error ? "—" : valor}
      </Text>
      <Text mt="1.5" fontSize="xs" color={error ? "fg.error" : "fg.subtle"} minH="1lh">
        {error ?? (loading ? "Cargando..." : detalle)}
      </Text>
    </>
  );

  if (!to) {
    return (
      <Tarjeta p="5" h="full">
        {contenido}
      </Tarjeta>
    );
  }

  return (
    <Link
      asChild
      display="block"
      h="full"
      p="5"
      bg="bg.panel"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      textDecoration="none"
      _hover={{ textDecoration: "none", borderColor: "brand.400" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
    >
      <RouterLink to={to}>{contenido}</RouterLink>
    </Link>
  );
}

/** Fila de indicadores: se reparten el ancho y bajan de renglón si no entran. */
export function GrillaIndicadores({ children }: { children: ReactNode }) {
  return (
    <Grid templateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="4">
      {children}
    </Grid>
  );
}

/** Grilla de los bloques (gráficos y listas) debajo de los indicadores. */
export function GrillaBloques({ children }: { children: ReactNode }) {
  return (
    <Grid templateColumns={{ base: "1fr", xl: "repeat(2, minmax(0, 1fr))" }} gap="6" mt="6">
      {children}
    </Grid>
  );
}

/* ─────────────────────── Bloque con carga y error ─────────────────────── */

interface BloqueProps extends BoxProps {
  titulo: string;
  descripcion?: ReactNode;
  loading: boolean;
  error: string | null;
  /** Sin datos: se muestra este texto en vez del contenido. */
  vacio?: string | false;
  children: ReactNode;
}

/** Tarjeta de un bloque del panel: resuelve cargando / error / vacío. */
export function Bloque({ titulo, descripcion, loading, error, vacio, children, ...rest }: BloqueProps) {
  return (
    <TarjetaPanel titulo={titulo} descripcion={descripcion} h="auto" {...rest}>
      {loading ? (
        <EstadoCargando />
      ) : error ? (
        <MensajeError>{error}</MensajeError>
      ) : vacio ? (
        <Text fontSize="sm" color="fg.muted" py="4">
          {vacio}
        </Text>
      ) : (
        children
      )}
    </TarjetaPanel>
  );
}

/* ───────────────────────── Barras horizontales ───────────────────────── */

export interface DatoBarra {
  etiqueta: string;
  valor: number;
}

/*
 * Un solo color: todas las barras miden lo mismo (una cantidad), así que el
 * color no distingue categorías, las distingue el nombre. Es el teal de serie
 * ya validado en `GraficoBarras` (el brand.600 es poco saturado para un dato).
 */
const COLOR_BARRA = "#009b8f";

/**
 * Cantidades por categoría, de mayor a menor. Horizontales porque las
 * etiquetas son nombres largos (sectores, proveedores) que en un eje X se
 * pisarían. El valor va escrito al final de cada barra: son pocas filas.
 */
export function BarrasHorizontales({ datos, unidad }: { datos: DatoBarra[]; unidad?: string }) {
  const ordenados = [...datos].sort((a, b) => b.valor - a.valor);
  const maximo = Math.max(...ordenados.map((d) => d.valor), 1);

  return (
    <Stack as="ul" listStyleType="none" gap="3" m="0" p="0">
      {ordenados.map((dato) => (
        <Box
          as="li"
          key={dato.etiqueta}
          title={`${dato.etiqueta}: ${formatoCantidad(dato.valor)}${unidad ? ` ${unidad}` : ""}`}
        >
          <Flex justify="space-between" gap="3" mb="1">
            <Text fontSize="sm" color="fg" lineClamp={1}>
              {dato.etiqueta}
            </Text>
            <Text fontSize="sm" fontWeight="semibold" color="fg" flexShrink={0}>
              {formatoCantidad(dato.valor)}
            </Text>
          </Flex>
          <Box h="2" bg="gray.100" rounded="full" aria-hidden>
            <Box
              h="full"
              rounded="full"
              bg={COLOR_BARRA}
              // Un valor distinto de cero siempre deja ver algo de barra.
              w={dato.valor === 0 ? "0" : `max(${(dato.valor / maximo) * 100}%, 6px)`}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

/* ─────────────────────────────── Lista ─────────────────────────────── */

export interface FilaLista {
  clave: string | number;
  titulo: string;
  detalle?: ReactNode;
  /** Estado a la derecha: siempre con ícono y texto, nunca solo color. */
  estado?: { tono: TonoEstado; texto: string };
  /** Ficha o listado donde se resuelve. */
  to?: string;
}

/** Lista corta de casos que piden atención. */
export function ListaPanel({ filas }: { filas: FilaLista[] }) {
  return (
    <Stack as="ul" listStyleType="none" gap="0" m="0" p="0">
      {filas.map((fila) => {
        const contenido = (
          <HStack gap="3" py="2.5">
            <Box flex="1" minW="0">
              <Text fontSize="sm" fontWeight="medium" color="fg" lineClamp={1}>
                {fila.titulo}
              </Text>
              {fila.detalle ? (
                <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                  {fila.detalle}
                </Text>
              ) : null}
            </Box>
            {fila.estado ? (
              <EtiquetaEstado tono={fila.estado.tono}>{fila.estado.texto}</EtiquetaEstado>
            ) : null}
            {fila.to ? (
              <Box color="fg.subtle" flexShrink={0} aria-hidden>
                <LuChevronRight size={16} />
              </Box>
            ) : null}
          </HStack>
        );

        return (
          <Box
            as="li"
            key={fila.clave}
            borderTopWidth="1px"
            borderColor="border.subtle"
            _first={{ borderTopWidth: "0" }}
          >
            {fila.to ? (
              <Link
                asChild
                display="block"
                mx="-2"
                px="2"
                rounded="md"
                textDecoration="none"
                _hover={{ textDecoration: "none", bg: "brand.50" }}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "brand.400",
                  outlineOffset: "-2px",
                }}
              >
                <RouterLink to={fila.to}>{contenido}</RouterLink>
              </Link>
            ) : (
              contenido
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

/** Enlace "Ver todos" al pie de un bloque. */
export function VerTodos({ to, children }: { to: string; children: string }) {
  return (
    <Link asChild mt="3" fontSize="sm" fontWeight="medium" color="brand.700" alignSelf="flex-start">
      <RouterLink to={to}>{children}</RouterLink>
    </Link>
  );
}
