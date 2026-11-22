import { Children,useMemo, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Flex,
  Grid,
  HStack,
  Link,
  NativeSelect,
  Stack,
  Text,
  type BoxProps,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";
import {
  LuCalendarRange,
  LuChevronRight,
  LuCircleAlert,
  LuClock,
  LuFilter,
  LuInfo,
  LuTriangleAlert,
} from "react-icons/lu";
import type { OpcionFiltro } from "../../../components/ui/filtros";
import {
  EstadoCargando,
  EtiquetaEstado,
  MensajeError,
  type TonoEstado,
} from "../../../components/ui/patrones";
import { formatoCantidad } from "../../../common/utils/numeros";
import type { EstadoPanel } from "../hooks/usePanel";
import { PERIODOS, type Conteo, type FilaAtencion } from "../types/paneles";
import { COLOR_ESTADO } from "../types/coloresGraficos";
import { ContextoRangoDescarga, rangoDePanel } from "./rangoDescarga";
import { TarjetaPanel } from "./TarjetaPanel";


/*
 * Piezas de los paneles de categoría (Producción, Inventario, ...).
 *
 * Cada una está elegida por lo que el dato tiene que decir:
 *   - `BarrasHorizontales`: comparar cantidades entre categorías con nombre
 *     (equipos por sector, cumplimiento por operador).
 *   - `ListaPanel`: los casos puntuales que piden atención, con su estado y
 *     un enlace a donde se resuelven.
 * Los gráficos de evolución y de reparto están en `graficos.tsx`.
 */

/* ─────────────────────────── Marco con filtros ─────────────────────────── */

interface MarcoPanelProps<T> {
  panel: EstadoPanel<T>;
  /** Filtro propio del panel, además del período. */
  filtro?: { label: string; todos: string; opciones: OpcionFiltro[] };
  /** Aclaración sobre qué datos se están viendo (p. ej. "solo tus tareas"). */
  aviso?: ReactNode;
  children: (datos: T) => ReactNode;
}

/**
 * Lo común a los seis paneles: la barra de filtros (período + el filtro
 * propio) y los estados de carga y error del pedido.
 *
 * Mientras se vuelve a pedir por un cambio de filtro, el contenido anterior
 * queda a la vista, atenuado: la pantalla no salta entre un período y otro.
 */
export function MarcoPanel<T>({ panel, filtro, aviso, children }: MarcoPanelProps<T>) {
  const { datos, loading, error } = panel;
  const rango = useMemo(() => rangoDePanel(datos), [datos]);
  return (
    <>
      <BarraFiltrosPanel>
        <FiltroCompacto
          label="Período"
          icono={LuCalendarRange}
          valor={panel.dias}
          onCambio={panel.cambiarDias}
          opciones={PERIODOS.map((p) => ({ valor: p.valor, etiqueta: p.etiqueta }))}
        />
        {filtro ? (
          <FiltroCompacto
            label={filtro.label}
            icono={LuFilter}
            valor={panel.filtro}
            onCambio={panel.cambiarFiltro}
            opciones={[{ valor: "", etiqueta: filtro.todos }, ...filtro.opciones]}
          />
        ) : null}
      </BarraFiltrosPanel>

      {error ? <MensajeError>{error}</MensajeError> : null}
      {datos === null ? (
        loading ? (
          <EstadoCargando />
        ) : null
      ) : (
        <Box
          opacity={loading ? 0.55 : 1}
          transition="opacity 0.15s ease"
          aria-busy={loading || undefined}
        >
          {aviso ? (
            <HStack
              gap="2"
              mb="4"
              px="3"
              py="2"
              rounded="md"
              bg="brand.50"
              color="brand.800"
              fontSize="sm"
              align="flex-start"
            >
              <Box mt="0.5" flexShrink={0} aria-hidden>
                <LuInfo size={16} />
              </Box>
              <Text>{aviso}</Text>
            </HStack>
          ) : null}
          <ContextoRangoDescarga.Provider value={rango}>{children(datos)}</ContextoRangoDescarga.Provider>
        </Box>
      )}
    </>
  );
}

/* ───────────────────────── Barra de filtros del panel ───────────────────────── */

/**
 * Barra de filtros de los paneles: una sola píldora flotante, alineada a la
 * derecha, con borde suave. Pesa mucho menos que la tarjeta de filtros de los
 * listados: en un panel los filtros acompañan al título, no compiten con él.
 *
 * No queda fija al desplazarse: probado así, tapaba el título de las
 * tarjetas que pasaban por debajo.
 *
 * En pantallas medianas en adelante se monta sobre el borde inferior del
 * banner (margen negativo), a la derecha: no queda una franja vacía entre el
 * banner y los bloques. En el celular va debajo, a todo el ancho.
 */
function BarraFiltrosPanel({ children }: { children: ReactNode }) {
  return (
    <Flex
      justify={{ base: "stretch", md: "flex-end" }}
      mt={{ base: "3", md: "-6" }}
      mb={{ base: "4", md: "5" }}
      px={{ base: "0", md: "5" }}
      position="relative"
      zIndex="1"
    >
      <Flex
        role="group"
        aria-label="Filtros del panel"
        align="center"
        flexWrap="wrap"
        gap="1"
        w={{ base: "full", md: "auto" }}
        p="1"
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        rounded="xl"
        boxShadow="panel"
        css={{ "& > * + *": { borderLeftWidth: { md: "1px" }, borderColor: "border.subtle" } }}
      >
        {children}
      </Flex>
    </Flex>
  );
}

/** Un filtro de la barra: ícono, nombre chico y el select sin borde propio. */
function FiltroCompacto({
  label,
  icono: Icono,
  valor,
  onCambio,
  opciones,
}: {
  label: string;
  icono: IconType;
  valor: string;
  onCambio: (valor: string) => void;
  opciones: OpcionFiltro[];
}) {
  return (
    <HStack as="label" gap="2" pl="3" pr="1" flex={{ base: "1 1 220px", md: "0 0 auto" }} minW="0">
      <Box color="brand.600" flexShrink={0} aria-hidden>
        <Icono size={16} />
      </Box>
      <Text as="span" fontSize="xs" fontWeight="medium" color="fg.muted" whiteSpace="nowrap">
        {label}
      </Text>
      <NativeSelect.Root size="sm" variant="plain" flex="1" minW="0" w={{ md: "auto" }}>
        <NativeSelect.Field
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          fontWeight="semibold"
          color="fg"
          rounded="lg"
          maxW={{ md: "240px" }}
          _hover={{ bg: "bg.subtle" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.400" }}
        >
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </HStack>
  );
}

/* ─────────────────────────────── Indicadores ─────────────────────────────── */

export interface Metrica {
  clave: string;
  etiqueta: string;
  /** Ya formateado: "148,8 kg", "65%". `null` se muestra como guion (no hay con qué calcularlo). */
  valor: string | null;
  icono: IconType;
  /** Una línea de contexto: de dónde sale el número. */
  detalle?: string;
  /** 0 a 100: dibuja una barrita de avance junto al número. */
  avance?: number | null;
}

/**
 * Los números clave de un bloque, arriba de su gráfico: el total que el
 * gráfico desglosa. Van dentro del bloque y no en tarjetas sueltas, así el
 * número y su detalle se leen juntos. Una línea fina los separa del gráfico.
 */
export function MetricasBloque({
  metricas,
  enCabecera = false,
}: {
  metricas: Metrica[];
  /**
   * Va en la cabecera del bloque (prop `acciones` de la tarjeta), a la
   * derecha del título: sin la línea de abajo y sin alto propio, así el
   * gráfico empieza enseguida. Si no entra al lado del título, baja debajo.
   */
  enCabecera?: boolean;
}) {
  return (
    <Flex
      as="dl"
      m="0"
      {...(enCabecera
        ? {}
        : { mb: "5", pb: "4", borderBottomWidth: "1px", borderColor: "border.subtle" })}
      gap={{ base: "4", sm: "0" }}
      direction={{ base: "column", sm: "row" }}
    >
      {metricas.map(({ clave, etiqueta, valor, icono: Icono, detalle, avance }, i) => (
        <Flex
          key={clave}
          direction="column"
          gap="1"
          flex={enCabecera ? "0 0 auto" : "1"}
          minW="0"
          {...(i > 0 ? { pl: { sm: "5" }, ml: { sm: "5" }, borderLeftWidth: { sm: "1px" }, borderColor: "border.subtle" } : {})}
        >
          <HStack as="dt" gap="1.5" fontSize="xs" fontWeight="medium" color="fg.muted">
            <Box color="brand.600" aria-hidden>
              <Icono size={14} />
            </Box>
            {etiqueta}
          </HStack>
          <Box as="dd" m="0">
            <HStack gap="3" align="center">
              <Text
                as="span"
                fontSize="3xl"
                fontWeight="extrabold"
                lineHeight="1"
                letterSpacing="-0.02em"
                color="fg"
                fontVariantNumeric="tabular-nums"
              >
                {valor ?? "—"}
              </Text>
              {avance !== undefined ? (
                <Box flex="1" maxW="120px" h="1.5" bg="bg.muted" rounded="full" overflow="hidden" aria-hidden>
                  <Box
                    h="full"
                    rounded="full"
                    bg="brand.500"
                    w={`${Math.min(Math.max(avance ?? 0, 0), 100)}%`}
                  />
                </Box>
              ) : null}
            </HStack>
            {detalle ? (
              <Text fontSize="xs" color="fg.muted" mt="1">
                {detalle}
              </Text>
            ) : null}
          </Box>
        </Flex>
      ))}
    </Flex>
  );
}

/**
 * Fila de bloques del panel. `principal` deja el primero más ancho (el
 * gráfico de evolución) y el segundo como acompañante. Si la fila tiene un
 * solo bloque (p. ej. porque el otro depende del rol), ocupa todo el ancho.
 */
export function GrillaBloques({
  children,
  principal = false,
}: {
  children: ReactNode;
  principal?: boolean;
}) {
  const solo = Children.toArray(children).length === 1;
  return (
    <Grid
      templateColumns={{
        base: "minmax(0, 1fr)",
        xl: solo
          ? "minmax(0, 1fr)"
          : principal
            ? "minmax(0, 2fr) minmax(0, 1fr)"
            : "repeat(2, minmax(0, 1fr))",
      }}
      gap="5"
      _notFirst={{ mt: "5" }}
    >
      {children}
    </Grid>
  );
}

/* ──────────────────────────────── Bloque ──────────────────────────────── */

interface BloqueProps extends BoxProps {
  titulo: string;
  descripcion?: ReactNode;
  /** Sin datos: se muestra este texto en vez del contenido. */
  vacio?: string | false;
  /** A la derecha del título (p. ej. las métricas del bloque). Se ve aunque esté vacío. */
  acciones?: ReactNode;
  children: ReactNode;
}

/** Tarjeta de un bloque del panel, con su título y su estado vacío. */
export function Bloque({ titulo, descripcion, vacio, children, ...rest }: BloqueProps) {
  return (
    <TarjetaPanel titulo={titulo} tamanoTitulo="lg" descripcion={descripcion} descargable={!vacio} {...rest}>
      {vacio ? (
        <Text fontSize="sm" color="fg.muted" py="4" my="auto">
          {vacio}
        </Text>
      ) : (
        children
      )}
    </TarjetaPanel>
  );
}

/* ───────────────────────── Barras horizontales ───────────────────────── */

/*
 * Un solo color por defecto: todas las barras miden lo mismo, así que el
 * color no distingue categorías, las distingue el nombre. Es el teal de
 * serie ya validado (el brand.600 es poco saturado para un dato).
 */
const COLOR_BARRA = "#009b8f";

interface BarrasHorizontalesProps {
  datos: Conteo[];
  /** Qué se cuenta, para el `title` de cada fila: "lotes", "incidentes". */
  unidad?: string;
  /** "%": la barra se mide contra 100 y el valor lleva el signo. */
  sufijo?: "%";
  /** Mantener el orden recibido (por defecto, de mayor a menor). */
  sinOrdenar?: boolean;
  /**
   * Qué va a la derecha: el valor (y el detalle, atenuado, si entra) o solo
   * el detalle, cuando el detalle ES el dato ("120 kg · 4 lotes").
   */
  mostrar?: "valor" | "detalle";
  /** Semáforo por fila, cuando cada barra es un estado. */
  tono?: (dato: Conteo) => TonoEstado | undefined;
}

/**
 * Cantidades por categoría. Horizontales porque las etiquetas son nombres
 * largos (sectores, proveedores) que en un eje X se pisarían. El valor va
 * escrito al final de cada fila: son pocas.
 */
export function BarrasHorizontales({
  datos,
  unidad,
  sufijo,
  sinOrdenar = false,
  mostrar = "valor",
  tono,
}: BarrasHorizontalesProps) {
  const filas = sinOrdenar ? datos : [...datos].sort((a, b) => b.valor - a.valor);
  const maximo = sufijo === "%" ? 100 : Math.max(...filas.map((d) => d.valor), 1);
  const texto = (dato: Conteo) => `${formatoCantidad(dato.valor)}${sufijo ?? ""}`;

  return (
    <Stack as="ul" listStyleType="none" gap="3" m="0" p="0">
      {filas.map((dato) => {
        const tonoFila = tono?.(dato);
        return (
          <Box
            as="li"
            key={dato.clave}
            title={`${dato.etiqueta}: ${dato.detalle ?? `${texto(dato)}${unidad ? ` ${unidad}` : ""}`}`}
          >
            <Flex justify="space-between" align="baseline" gap="3" mb="1">
              <Text fontSize="sm" color="fg" lineClamp={1}>
                {dato.etiqueta}
              </Text>
              <HStack gap="2" flexShrink={0} align="baseline">
                {dato.detalle && mostrar === "valor" ? (
                  <Text fontSize="xs" color="fg.muted" display={{ base: "none", sm: "block" }}>
                    {dato.detalle}
                  </Text>
                ) : null}
                <Text fontSize="sm" fontWeight="semibold" color="fg" fontVariantNumeric="tabular-nums">
                  {mostrar === "detalle" && dato.detalle ? dato.detalle : texto(dato)}
                </Text>
              </HStack>
            </Flex>
            <Box h="2" bg="bg.muted" rounded="full" aria-hidden>
              <Box
                h="full"
                rounded="full"
                bg={tonoFila ? COLOR_ESTADO[tonoFila] : COLOR_BARRA}
                // Un valor distinto de cero siempre deja ver algo de barra.
                w={dato.valor === 0 ? "0" : `max(${Math.min(dato.valor / maximo, 1) * 100}%, 6px)`}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

/* ─────────────────────────────── Lista ─────────────────────────────── */

/**
 * Lista corta de casos que piden atención: estado con ícono y texto, nunca solo color.
 *
 * `acento`: cada caso va como una tarjetita con un filete a la izquierda del
 * color de su estado (en proceso / completo), para recorrer la lista de un
 * vistazo. Sin `acento`, filas separadas por una línea.
 */
export function ListaPanel({
  filas,
  acento = false,
  holgada = false,
}: {
  filas: FilaAtencion[];
  acento?: boolean;
  /** Más aire entre filas y dentro de cada una: para listas que se leen de corrido (inicio). */
  holgada?: boolean;
}) {
  return (
    <Stack as="ul" listStyleType="none" gap={acento ? (holgada ? "3" : "2") : "0"} m="0" p="0">
      {filas.map((fila) => {
        const contenido = (
          // Holgada: si no entra todo en un renglón (celular), la etiqueta
          // baja debajo del texto en vez de achicar el título a "P.".
          <HStack
            gap="3"
            rowGap="2"
            py={holgada ? "3" : "2.5"}
            px={acento ? (holgada ? "4" : "3") : undefined}
            flexWrap={holgada ? "wrap" : undefined}
          >
            <Box flex="1" minW="0" flexBasis={holgada ? "200px" : undefined}>
              <Text fontSize="sm" fontWeight="medium" color="fg" lineClamp={1}>
                {fila.titulo}
              </Text>
              {fila.detalle ? (
                <Text fontSize="xs" color="fg.muted" lineClamp={1} mt={holgada ? "1" : undefined}>
                  {fila.detalle}
                </Text>
              ) : null}
            </Box>
            <Box flexShrink={1} minW="0" ml={holgada ? "auto" : undefined}>
              <EstadoFila tono={fila.tono}>{fila.estado}</EstadoFila>
            </Box>
            {fila.link ? (
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
            {...(acento
              ? {
                  borderWidth: "1px",
                  borderColor: "border.subtle",
                  borderLeftWidth: "3px",
                  borderLeftColor: COLOR_ESTADO[fila.tono],
                  rounded: "md",
                  bg: "bg.panel",
                  overflow: "hidden",
                }
              : { borderTopWidth: "1px", borderColor: "border.subtle", _first: { borderTopWidth: "0" } })}
          >
            {fila.link ? (
              <Link
                asChild
                display="block"
                mx={acento ? "0" : "-2"}
                px={acento ? "0" : "2"}
                rounded={acento ? "0" : "md"}
                textDecoration="none"
                _hover={{ textDecoration: "none", bg: "brand.50" }}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "brand.400",
                  outlineOffset: "-2px",
                }}
              >
                <RouterLink to={fila.link}>{contenido}</RouterLink>
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

/* ───────────────────────────── Pendientes ───────────────────────────── */

/**
 * Ámbar cálido para lo que falta completar o está por vencer: advierte sin
 * la alarma del rojo. Texto sobre fondo: unos 6:1 de contraste.
 */
const AMBAR = { fondo: "aviso.ambarFondo", borde: "aviso.ambarBorde", texto: "aviso.ambarTexto" } as const;

/**
 * Rojo suave para lo vencido o sin stock: el par del ámbar, con el mismo
 * peso visual (fondo claro, borde y texto oscuro del mismo tono, cerca del
 * terracota de la marca) en vez del rojo saturado de Chakra. Texto sobre
 * fondo: más de 7:1 de contraste.
 */
const ROJO_SUAVE = { fondo: "aviso.rojoFondo", borde: "aviso.rojoBorde", texto: "aviso.rojoTexto" } as const;

/**
 * Estado de una fila de los paneles. Las advertencias (`alerta`: por vencer,
 * en demora) van en ámbar y no en el naranja de Chakra, que en la app es el
 * color de "editar"; lo vencido (`peligro`), en rojo suave. Los dos con
 * ícono, así el estado no depende solo del color. El resto usa la etiqueta
 * común (verde = completo, azul = en proceso).
 */
function EstadoFila({ tono, children }: { tono: TonoEstado; children: ReactNode }) {
  const suave = tono === "alerta" ? AMBAR : tono === "peligro" ? ROJO_SUAVE : null;
  if (!suave) return <EtiquetaEstado tono={tono}>{children}</EtiquetaEstado>;
  const Icono = tono === "alerta" ? LuClock : LuTriangleAlert;
  return (
    <HStack
      as="span"
      display="inline-flex"
      gap="1.5"
      px="2.5"
      py="1"
      rounded="full"
      fontSize="xs"
      fontWeight="medium"
      bg={suave.fondo}
      color={suave.texto}
      borderWidth="1px"
      borderColor={suave.borde}
      whiteSpace="nowrap"
      maxW="100%"
    >
      <Icono size={14} aria-hidden />
      {children}
    </HStack>
  );
}

/** "Falta receta, información nutricional" → ["receta", "información nutricional"]. */
function faltantesDe(detalle: string | null): string[] {
  if (!detalle?.startsWith("Falta ")) return [];
  return detalle.slice("Falta ".length).split(", ").filter(Boolean);
}

/**
 * Productos con pendientes: el nombre y una etiqueta ámbar por cada cosa que
 * le falta (receta, información nutricional, rótulo). Las etiquetas dicen QUÉ
 * falta, no solo cuántas cosas. Si el detalle no tiene la forma esperada, se
 * muestra tal cual.
 */
export function ListaPendientes({ filas }: { filas: FilaAtencion[] }) {
  return (
    <Stack as="ul" listStyleType="none" gap="0" m="0" p="0">
      {filas.map((fila) => {
        const faltan = faltantesDe(fila.detalle);
        const contenido = (
          <HStack gap="3" py="3">
            <Stack flex="1" minW="0" gap="1.5">
              <Text fontSize="sm" fontWeight="medium" color="fg" lineClamp={1}>
                {fila.titulo}
              </Text>
              {faltan.length > 0 ? (
                <HStack gap="1.5" flexWrap="wrap">
                  {faltan.map((f) => (
                    <HStack
                      as="span"
                      key={f}
                      gap="1"
                      px="2"
                      py="0.5"
                      rounded="full"
                      fontSize="xs"
                      fontWeight="medium"
                      bg={AMBAR.fondo}
                      color={AMBAR.texto}
                      borderWidth="1px"
                      borderColor={AMBAR.borde}
                      whiteSpace="nowrap"
                    >
                      <LuCircleAlert size={12} aria-hidden />
                      Falta {f}
                    </HStack>
                  ))}
                </HStack>
              ) : fila.detalle ? (
                <Text fontSize="xs" color="fg.muted">
                  {fila.detalle}
                </Text>
              ) : null}
            </Stack>
            {fila.link ? (
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
            {fila.link ? (
              <Link
                asChild
                display="block"
                mx="-2"
                px="2"
                rounded="md"
                textDecoration="none"
                _hover={{ textDecoration: "none", bg: "brand.50" }}
                _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "-2px" }}
              >
                <RouterLink to={fila.link}>{contenido}</RouterLink>
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
    <Link
      asChild
      mt="auto"
      pt="3"
      fontSize="sm"
      fontWeight="medium"
      color="brand.700"
      alignSelf="flex-start"
    >
      <RouterLink to={to}>{children}</RouterLink>
    </Link>
  );
}
