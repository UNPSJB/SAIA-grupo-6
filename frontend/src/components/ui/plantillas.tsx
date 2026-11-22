import {
  Box,
  Button,
  Heading,
  HStack,
  Text,
  type BoxProps,
  type StackProps,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuArrowLeft, LuLock } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { DEGRADADO_MARCA } from "../../theme";
import { BannerError, PageHeader, Tarjeta } from "./patrones";

/**
 * Plantillas de página: el esqueleto de cada pantalla.
 *
 * `patrones.tsx` resuelve las piezas (tabla, botón, campo); acá se resuelve
 * dónde van. Antes cada página armaba su `<Box p maxW mx>` a mano y convivían
 * siete anchos distintos (600, 700, 960, 1000, 1100px, completo...), el botón
 * "Volver" aparecía arriba en unas y abajo en otras, y la acción principal de
 * un listado a veces iba en el encabezado y a veces dentro de una pestaña.
 *
 * Hay tres tipos de pantalla y cada una tiene su plantilla. Las tres usan el
 * MISMO ancho (el de los listados y los paneles: todo el espacio disponible,
 * con el padding de `Pagina`), así "← Volver", título, estado y acciones
 * quedan siempre alineados con el resto de la app. Lo que cambia es cómo se
 * reparte el contenido adentro, no el contenedor.
 *
 *   Listado     `Pagina`
 *               encabezado (título + acción principal)
 *               → pestañas opcionales (`PestanasPagina`)
 *               → `BarraFiltros` (búsqueda y filtros a la izquierda,
 *                 exportar / ver bajas a la derecha)
 *               → tabla → paginación
 *
 *   Formulario  `PaginaAlta` (`formularios.tsx`) / `PaginaFormulario`
 *               "← Volver" → encabezado → error → formulario
 *               El formulario no se estira: ocupa 8 de 12 columnas en
 *               escritorio, con un panel lateral opcional (ayuda, resumen).
 *               Guardar / Cancelar van al pie del formulario, nunca arriba.
 *
 *   Detalle     `PaginaDetalle`
 *               "← Volver" → encabezado (título + estado + acciones)
 *               → `SeccionDetalle`s, y si hay bloques complementarios,
 *                 `DisposicionDetalle`: principal (tablas, progreso, tareas)
 *                 a la izquierda y lateral (resumen, metadatos, alertas,
 *                 acciones rápidas) a la derecha, 8/4 desde `lg`.
 *
 * Regla para elegir: lo que se abre desde el menú no lleva "Volver"; lo que
 * se abre desde otra pantalla, sí. Por debajo de `lg` todo va en una columna.
 */

/* ──────────────────────────────── Anchos ───────────────────────────────── */

/**
 * Tipo de pantalla, a efectos del encabezado. Ya NO limita el ancho: antes
 * cada valor era un `maxW` (1024px, 640px, 768px, 896px) y las fichas y
 * altas quedaban como una columna angosta en el centro de un monitor ancho,
 * desalineadas de los listados y paneles. Ahora todas las páginas tienen el
 * ancho de los listados y el reparto interno lo deciden `DisposicionDetalle`
 * y `PaginaAlta` (formulario 8/12, extenso 12/12).
 *
 *   completo   listado abierto desde el menú (lleva la franja teal)
 *   ancho      ajustes, fichas y formularios con tablas internas
 *   angosto    formularios simples de pocos campos
 *   formulario altas cortas y medianas (`PaginaAlta`)
 *   extenso    altas con muchas secciones o tablas embebidas (`PaginaAlta`)
 */
export const ANCHO_PAGINA = {
  completo: "completo",
  ancho: "ancho",
  angosto: "angosto",
  formulario: "formulario",
  extenso: "extenso",
} as const;

/** Padding de toda página: el mismo de listados, paneles, fichas y altas. */
export const PADDING_PAGINA = { base: "3", md: "5" } as const;

export type AnchoPagina = keyof typeof ANCHO_PAGINA;

/* ─────────────────────────────── Volver ────────────────────────────────── */

export interface DestinoVolver {
  /** Ruta a la que vuelve. */
  a: string;
  /** Nombre de la pantalla de destino: "Lotes", "Receta"... */
  etiqueta: string;
  /**
   * Fichas a las que se llega desde varios lados (un equipo se abre desde
   * vencimientos, notificaciones o la lista): vuelve a la pantalla anterior
   * y `a` queda como respaldo si se entró por URL. El texto pasa a ser
   * "Volver" a secas, porque el destino real no se conoce.
   */
  historial?: boolean;
}

/**
 * Enlace "← Volver a X", siempre arriba del título y alineado a la izquierda.
 * Reemplaza los `BotonVolver` sueltos en `actions` o al pie de la página.
 */
export function EnlaceVolver({ a, etiqueta, historial = false }: DestinoVolver) {
  const navigate = useNavigate();
  const volver = () => {
    if (historial && window.history.length > 1) navigate(-1);
    else navigate(a);
  };
  return (
    <Button
      type="button"
      variant="plain"
      size="sm"
      px="0"
      h="auto"
      mb="2"
      color="fg.muted"
      fontWeight="medium"
      _hover={{ color: "brand.fg" }}
      onClick={volver}
    >
      <LuArrowLeft aria-hidden />
      {historial ? "Volver" : `Volver a ${etiqueta}`}
    </Button>
  );
}

/* ──────────────────────────────── Página ───────────────────────────────── */

interface PaginaProps {
  titulo: ReactNode;
  descripcion?: ReactNode;
  /**
   * Acción principal y secundarias, arriba a la derecha. En un listado es el
   * "Nuevo X"; en un detalle, lo que se puede hacer con el registro.
   */
  acciones?: ReactNode;
  /** Badge de estado junto al título (detalle de lote, incidente...). */
  estado?: ReactNode;
  volver?: DestinoVolver;
  ancho?: AnchoPagina;
  /**
   * Título sobre una franja fina con el teal de la marca (el de la barra
   * superior), en vez del encabezado liso; las tablas de la página toman el
   * encabezado teal. Por defecto la llevan los listados (ancho completo y sin
   * "Volver"); formularios y fichas quedan con el encabezado liso. Una
   * pantalla de ancho completo que no es un listado pasa `banner={false}`.
   */
  banner?: boolean;
  children: ReactNode;
}

/**
 * Contenedor base de toda pantalla. Por defecto es la plantilla de listado
 * (ancho completo, sin "Volver").
 */
export function Pagina({
  titulo,
  descripcion,
  acciones,
  estado,
  volver,
  ancho = "completo",
  banner: bannerPedido,
  children,
}: PaginaProps) {
  const banner = bannerPedido ?? (ancho === "completo" && !volver);
  return (
    <Box
      p={PADDING_PAGINA}
      w="100%"
      minW="0"
      // Las tablas de la página pintan su encabezado en teal (ver `FilaEncabezado`).
      data-pagina-banner={banner ? "" : undefined}
    >
      {volver ? <EnlaceVolver {...volver} /> : null}
      {banner ? (
        <BannerTitulo titulo={titulo} descripcion={descripcion} acciones={acciones} estado={estado} />
      ) : (
      <PageHeader
        title={
          estado ? (
            <Box as="span" display="inline-flex" alignItems="center" gap="3" flexWrap="wrap">
              {titulo}
              <Box as="span" display="inline-flex" fontSize="md">
                {estado}
              </Box>
            </Box>
          ) : (
            titulo
          )
        }
        description={descripcion}
        actions={acciones}
      />
      )}
      {children}
    </Box>
  );
}

/**
 * Encabezado en franja teal: fina (poco relleno, título `xl`), con el mismo
 * degradado de marca que la barra superior y el Inicio. Texto en blanco; los
 * botones de `acciones` pasan a blanco con texto teal para no perderse sobre
 * el fondo de su mismo color.
 */
function BannerTitulo({
  titulo,
  descripcion,
  acciones,
  estado,
}: Pick<PaginaProps, "titulo" | "descripcion" | "acciones" | "estado">) {
  return (
    <Box
      as="header"
      display="flex"
      flexDirection={{ base: "column", md: "row" }}
      alignItems={{ base: "stretch", md: "center" }}
      justifyContent="space-between"
      gap="4"
      mb="5"
      px={{ base: "4", md: "6" }}
      py={{ base: "3.5", md: "4" }}
      rounded="lg"
      bg="brand.700"
      backgroundImage={DEGRADADO_MARCA}
      color="white"
      boxShadow="0 1px 2px rgba(15, 23, 42, 0.08)"
    >
      <Box minW="0">
        <Heading
          as="h2"
          fontSize="xl"
          fontWeight="bold"
          lineHeight="1.25"
          color="white"
          display="flex"
          alignItems="center"
          gap="3"
          flexWrap="wrap"
        >
          {titulo}
          {estado ? (
            <Box as="span" display="inline-flex" fontSize="md">
              {estado}
            </Box>
          ) : null}
        </Heading>
        {descripcion ? (
          <Text mt="1" fontSize="sm" color="rgba(255, 255, 255, 0.85)" maxW="90ch">
            {descripcion}
          </Text>
        ) : null}
      </Box>
      {acciones ? (
        <HStack
          gap="3"
          flexWrap="wrap"
          flexShrink={0}
          css={{
            "& .chakra-button": {
              background: "white",
              color: "var(--chakra-colors-brand-light-700)",
              borderColor: "white",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.15)",
            },
            "& .chakra-button:hover": {
              background: "var(--chakra-colors-brand-light-50)",
            },
          }}
        >
          {acciones}
        </HStack>
      ) : null}
    </Box>
  );
}

/* ────────────────────────────── Formulario ─────────────────────────────── */

interface PaginaFormularioProps extends Omit<PaginaProps, "estado" | "acciones"> {
  /** Error de la operación (alta/edición), arriba del formulario. */
  error?: string | null;
}

/**
 * Pantalla de alta o edición. Sin acciones en el encabezado: Guardar y
 * Cancelar van en `AccionesFormulario`, al pie, para que el ojo termine el
 * formulario y encuentre el botón donde lo espera.
 */
export function PaginaFormulario({
  ancho = "angosto",
  error,
  children,
  ...rest
}: PaginaFormularioProps) {
  return (
    <Pagina ancho={ancho} {...rest}>
      {error ? <BannerError>{error}</BannerError> : null}
      {children}
    </Pagina>
  );
}

/* ─────────────────────────────── Detalle ───────────────────────────────── */

/**
 * Ficha de solo lectura de un registro: lote, receta, trazabilidad... Mismo
 * ancho que un listado; el contenido se reparte con `DisposicionDetalle`.
 */
export function PaginaDetalle({ ancho = "ancho", ...rest }: PaginaProps) {
  return <Pagina ancho={ancho} {...rest} />;
}

/**
 * Bloque de una ficha de detalle. Todas las secciones tienen el mismo título,
 * el mismo padding y la misma separación: antes había `Heading` de tamaño `md`
 * y `lg`, a veces dentro de la tarjeta y a veces afuera.
 *
 * `sinMarco` deja el título pero no la tarjeta, para secciones cuyo contenido
 * ya es una tabla o una lista de tarjetas.
 */
export function SeccionDetalle({
  titulo,
  descripcion,
  acciones,
  sinMarco = false,
  children,
  ...rest
}: {
  titulo?: ReactNode;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  sinMarco?: boolean;
  children: ReactNode;
} & Omit<BoxProps, "title">) {
  const encabezado =
    titulo || acciones ? (
      <HStack justify="space-between" align="flex-start" gap="4" mb="4" flexWrap="wrap">
        <Box>
          {titulo ? (
            <Heading as="h3" size="lg" fontWeight="bold" color="brand.fg">
              {titulo}
            </Heading>
          ) : null}
          {descripcion ? (
            <Text mt="1" fontSize="sm" color="fg.muted">
              {descripcion}
            </Text>
          ) : null}
        </Box>
        {acciones ? <HStack gap="2">{acciones}</HStack> : null}
      </HStack>
    ) : null;

  if (sinMarco) {
    return (
      <Box mb="6" {...rest}>
        {encabezado}
        {children}
      </Box>
    );
  }

  return (
    <Tarjeta p="6" mb="6" overflow="visible" {...rest}>
      {encabezado}
      {children}
    </Tarjeta>
  );
}

/**
 * Par etiqueta / valor de una ficha. Había siete copias locales (`Dato`,
 * `Campo`) con tres combinaciones de tamaño distintas: etiqueta `xs` y valor
 * `sm`, etiqueta `sm` y valor `md`, o todo en una línea con dos puntos.
 */
export function DatoDetalle({
  etiqueta,
  children,
}: {
  etiqueta: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box minW="0">
      <Text fontSize="xs" color="fg.muted" mb="1">
        {etiqueta}
      </Text>
      <Box fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
        {children}
      </Box>
    </Box>
  );
}

/**
 * Aviso de registro cerrado ("Lote terminado: es de solo lectura", "Versión
 * anterior"). Estaba copiado a mano en el detalle de lote y de receta.
 */
export function AvisoSoloLectura({ children, ...rest }: { children: ReactNode } & StackProps) {
  return (
    <HStack
      gap="2"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="md"
      px="4"
      py="3"
      mb="6"
      fontSize="sm"
      color="fg.muted"
      {...rest}
    >
      <LuLock aria-hidden />
      <Text as="span">{children}</Text>
    </HStack>
  );
}

/**
 * Grilla de `DatoDetalle`. Se acomoda al ancho de SU contenedor, no al de la
 * pantalla: en una ficha a todo el ancho da 2, 3, 4 o 5 columnas según el
 * espacio, y dentro del lateral de `DisposicionDetalle` baja sola a 1 o 2.
 *
 * Usa `auto-fit` (no `auto-fill`): si hay menos datos que columnas posibles,
 * las columnas vacías se colapsan y los datos se reparten el ancho, en vez de
 * quedar amontonados a la izquierda con un hueco a la derecha. `columnasMax`
 * pone el techo (por defecto 5) para que en un monitor ancho las etiquetas no
 * queden perdidas en celdas enormes.
 */
export function GrillaDatos({
  columnasMax = 5,
  minimo = "160px",
  children,
  ...rest
}: { columnasMax?: number; minimo?: string; children: ReactNode } & BoxProps) {
  const gap = "var(--chakra-spacing-5)";
  return (
    <Box
      display="grid"
      gridTemplateColumns={`repeat(auto-fit, minmax(max(${minimo}, calc((100% - ${columnasMax - 1} * ${gap}) / ${columnasMax})), 1fr))`}
      gap="5"
      {...rest}
    >
      {children}
    </Box>
  );
}

/* ───────────────────────── Disposición en columnas ─────────────────────── */

/** Reparto de la grilla de 12 columnas entre principal y lateral. */
const PROPORCIONES = {
  "8/4": { principal: 8, lateral: 4 },
  "9/3": { principal: 9, lateral: 3 },
} as const;

export type ProporcionDisposicion = keyof typeof PROPORCIONES;

/**
 * Dos columnas para fichas y formularios: principal a la izquierda (tablas,
 * progreso, tareas, el formulario) y lateral a la derecha (resumen,
 * metadatos, alertas, acciones rápidas, ayuda). Grilla de 12 desde `lg`; por
 * debajo, una sola columna con el lateral DESPUÉS del principal salvo que se
 * pida `lateralPrimero` (útil cuando el lateral es el resumen que hay que
 * leer antes de operar).
 *
 * Sin `lateral`, el principal ocupa todo el ancho: así una pantalla puede
 * mostrar el lateral solo cuando tiene algo que decir.
 *
 * Alturas asimétricas: el lateral es el bloque corto o de referencia y el
 * principal el que crece (tablas, tareas, historial). Por eso el lateral es
 * `sticky` en escritorio por defecto: acompaña el scroll y el espacio que
 * queda debajo nunca se ve como un hueco muerto. Dos listados que crecen sin
 * límite (ingredientes + tareas) NO van acá: se apilan a todo el ancho, y el
 * de tarjetas en una grilla de 1/2/3 columnas (ver `VersionDetalleView`).
 */
export function DisposicionDetalle({
  lateral,
  proporcion = "8/4",
  lateralPrimero = false,
  pegajoso = true,
  children,
  ...rest
}: {
  lateral?: ReactNode;
  proporcion?: ProporcionDisposicion;
  /** En el celular, el lateral va arriba del principal. */
  lateralPrimero?: boolean;
  /**
   * En escritorio el lateral acompaña el scroll (por defecto). Se apaga solo
   * si el lateral es el bloque largo de la pantalla.
   */
  pegajoso?: boolean;
  children: ReactNode;
} & BoxProps) {
  if (!lateral) {
    return (
      <Box minW="0" {...rest}>
        {children}
      </Box>
    );
  }
  const { principal, lateral: colLateral } = PROPORCIONES[proporcion];
  // Dentro de cada columna la separación la pone el `gap`: se anula el `mb`
  // propio de `SeccionDetalle`, `Tarjeta`, `BannerError`...
  const sinMargen = { "&& > *": { marginBottom: "0" } };
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "repeat(12, minmax(0, 1fr))" }}
      gap="6"
      alignItems="start"
      {...rest}
    >
      <Box
        gridColumn={{ base: "1 / -1", lg: `span ${principal}` }}
        order={{ base: lateralPrimero ? 2 : 1, lg: 1 }}
        minW="0"
        display="flex"
        flexDirection="column"
        gap="6"
        css={sinMargen}
      >
        {children}
      </Box>
      <Box
        as="aside"
        gridColumn={{ base: "1 / -1", lg: `span ${colLateral}` }}
        order={{ base: lateralPrimero ? 1 : 2, lg: 2 }}
        minW="0"
        display="flex"
        flexDirection="column"
        gap="6"
        position={pegajoso ? { lg: "sticky" } : undefined}
        top={pegajoso ? { lg: "6" } : undefined}
        css={sinMargen}
      >
        {lateral}
      </Box>
    </Box>
  );
}

/* ────────────────────────────── Pestañas ───────────────────────────────── */

/*
 * Sub-pestañas de una página: viven en `pestanas.tsx` (forma y animación de
 * las pestañas de la barra). Se reexportan acá porque son parte del esqueleto
 * de un listado.
 *
 * Dentro de cada pestaña, la acción de alta va en `BarraFiltros` →
 * `herramientas`, a la derecha: depende de la pestaña, así que no puede
 * subir al encabezado de la página. Y lo primero de cada pestaña es la
 * tarjeta de filtros: la pestaña activa se apoya sobre ella.
 */
export { PestanasPagina, type Pestana } from "./pestanas";
