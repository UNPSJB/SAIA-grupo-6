import {
  Box,
  Button,
  Heading,
  HStack,
  Tabs,
  Text,
  type BoxProps,
  type StackProps,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuArrowLeft, LuLock } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
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
 * Hay tres tipos de pantalla y cada una tiene su plantilla:
 *
 *   Listado     `Pagina`            ancho completo
 *               encabezado (título + acción principal)
 *               → pestañas opcionales (`PestanasPagina`)
 *               → `BarraFiltros` (búsqueda y filtros a la izquierda,
 *                 exportar / ver bajas a la derecha)
 *               → tabla → paginación
 *
 *   Formulario  `PaginaFormulario`  angosto (640px) o ancho (1024px)
 *               "← Volver" → encabezado → error → `TarjetaFormulario`
 *               Guardar / Cancelar van al pie del formulario, nunca arriba.
 *
 *   Detalle     `PaginaDetalle`     ancho (1024px)
 *               "← Volver" → encabezado (título + estado + acciones)
 *               → `SeccionDetalle`s apiladas
 *
 * Regla para elegir: lo que se abre desde el menú ocupa todo el ancho y no
 * lleva "Volver"; lo que se abre desde otra pantalla va centrado y con
 * "Volver". Las únicas excepciones son Configuración y Vista pública: se
 * abren desde el menú pero son formularios de ajustes, y usan `ancho`.
 */

/* ──────────────────────────────── Anchos ───────────────────────────────── */

/**
 * Los únicos tres anchos de página. Si una pantalla no entra en ninguno, el
 * problema es el contenido, no el ancho.
 *
 *   completo  listados: la tabla aprovecha todo el espacio
 *   ancho     formularios con tablas internas (receta, lote) y detalles
 *   angosto   formularios simples de pocos campos
 */
export const ANCHO_PAGINA = {
  completo: undefined,
  ancho: "1024px",
  angosto: "640px",
} as const;

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
function EnlaceVolver({ a, etiqueta, historial = false }: DestinoVolver) {
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
  children,
}: PaginaProps) {
  const maxW = ANCHO_PAGINA[ancho];
  return (
    <Box p="5" w="100%" maxW={maxW} mx={maxW ? "auto" : undefined}>
      {volver ? <EnlaceVolver {...volver} /> : null}
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
      {children}
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

/** Ficha de solo lectura de un registro: lote, receta, trazabilidad... */
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

/** Grilla de `DatoDetalle`: columnas de ancho parejo que se acomodan solas. */
export function GrillaDatos({ children, ...rest }: { children: ReactNode } & BoxProps) {
  return (
    <Box
      display="grid"
      gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))"
      gap="5"
      {...rest}
    >
      {children}
    </Box>
  );
}

/* ────────────────────────────── Pestañas ───────────────────────────────── */

export interface Pestana {
  valor: string;
  etiqueta: ReactNode;
  contenido: ReactNode;
}

/**
 * Pestañas de una página (Stock, Aditivos...). Las tres páginas con pestañas
 * repetían el mismo `Tabs.Root` con variaciones mínimas de margen.
 *
 * Dentro de cada pestaña, la acción de alta va en `BarraFiltros` →
 * `herramientas`, a la derecha: depende de la pestaña, así que no puede
 * subir al encabezado de la página.
 */
export function PestanasPagina({
  pestanas,
  inicial,
}: {
  pestanas: Pestana[];
  inicial?: string;
}) {
  return (
    <Tabs.Root
      defaultValue={inicial ?? pestanas[0]?.valor}
      variant="line"
      colorPalette="brand"
      lazyMount
    >
      <Tabs.List overflowX="auto" overflowY="hidden" mb="6">
        {pestanas.map((p) => (
          <Tabs.Trigger key={p.valor} value={p.valor} flexShrink={0}>
            {p.etiqueta}
          </Tabs.Trigger>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {pestanas.map((p) => (
        <Tabs.Content key={p.valor} value={p.valor} p="0">
          {p.contenido}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
