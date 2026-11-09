import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Field,
  Heading,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Pagination,
  Spinner,
  Stack,
  Switch,
  Table,
  Text,
  type BoxProps,
  type ButtonProps,
  type HeadingProps,
  type IconButtonProps,
  type InputProps,
  type TableRowProps,
  type TextProps,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import {
  LuArrowUpDown,
  LuCalculator,
  LuChevronLeft,
  LuClock,
  LuChevronRight,
  LuChevronsLeft,
  LuChevronsRight,
  LuCircleCheck,
  LuExternalLink,
  LuGauge,
  LuEye,
  LuHistory,
  LuImage,
  LuLink,
  LuLoader,
  LuMinus,
  LuPackagePlus,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuRepeat,
  LuRotateCcw,
  LuTrash2,
  LuTriangleAlert,
  LuUpload,
  LuWrench,
} from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import { toaster } from "./toaster";
import { Tooltip } from "./tooltip";

/**
 * Patrones compartidos: la fuente de verdad del formato de toda la app.
 *
 * Reglas que respetan (ver `CRITERIOS-VISUALES.md`):
 *
 *   - Espaciado solo con tokens de Chakra (múltiplos de 4px). Nunca `px`.
 *   - Tipografía de 5 tamaños: 2xl / lg / md / sm / xs. Nunca `fontSize="NNpx"`.
 *   - Color por rol: `fg`, `fg.muted`, `fg.subtle`, `bg.panel`, `bg.subtle`,
 *     `border`. El teal es acción principal; rojo/ámbar/verde, estados.
 *   - Labels y encabezados de tabla en caja normal, nunca en mayúsculas.
 */

/* ─────────────────────────── Encabezados de página ─────────────────────── */

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  mb?: string;
}

/**
 * Título de página. Todo listado tiene que usarlo: si cada página arma su
 * `HStack` + `Heading` por su cuenta, los títulos quedan en distintos tamaños.
 */
export function PageHeader({
  title,
  description,
  actions,
  mb = "6",
}: PageHeaderProps) {
  return (
    <Stack
      direction={{ base: "column", md: "row" }}
      align={{ base: "stretch", md: "center" }}
      justify="space-between"
      gap="4"
      mb={mb}
    >
      <Box>
        <Heading as="h2" size="2xl" fontWeight="bold" color="fg">
          {title}
        </Heading>
        {description ? (
          <Text mt="1" fontSize="sm" color="fg.muted">
            {description}
          </Text>
        ) : null}
      </Box>
      {actions ? (
        <HStack gap="3" flexWrap="wrap">
          {actions}
        </HStack>
      ) : null}
    </Stack>
  );
}

/* ─────────────────────────────── Tablas ────────────────────────────────── */

/**
 * Superficie clara: tarjetas, tablas y bloques de detalle.
 *
 * `overflow="hidden"` es lo que redondea de verdad las esquinas: sin él, una
 * franja de encabezado (la tabla, o el botón de los grupos del checklist) se
 * pinta por encima del borde y sobresale con las esquinas rectas.
 */
export function Tarjeta({
  children,
  desplazable = false,
  ...rest
}: {
  children: ReactNode;
  /**
   * Para tablas largas sin paginación (stock, lotes recibidos): la tarjeta
   * tiene alto máximo y scrollea por dentro, así el encabezado de la tabla
   * queda fijo arriba y no se pierde qué es cada columna.
   */
  desplazable?: boolean;
} & BoxProps) {
  return (
    <Box
      bg="bg.panel"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      overflow="hidden"
      {...(desplazable ? { overflow: "auto", maxH: "calc(100vh - 260px)", minH: "240px" } : {})}
      {...rest}
    >
      {children}
    </Box>
  );
}

/**
 * Estado vacío de un listado. Todos los listados lo usan: antes cada uno
 * armaba su `Tarjeta` con un padding distinto (`p="6"` / `p="8"` / `p={8}`).
 */
export function EstadoVacio({ children }: { children: ReactNode }) {
  return (
    <Tarjeta p="8" textAlign="center">
      <Text color="fg.muted">{children}</Text>
    </Tarjeta>
  );
}

/** Indicador de carga de una página o de una sección. */
export function EstadoCargando({
  children = "Cargando...",
}: {
  children?: ReactNode;
}) {
  return (
    <HStack justify="center" gap="3" p="8" role="status" aria-live="polite">
      <Spinner size="md" color="brand.500" />
      <Text color="fg.muted" fontSize="sm">
        {children}
      </Text>
    </HStack>
  );
}

/** Botón principal de alta ("Agregar", "Registrar..."), con ícono en vez de "+". */
export function BotonAgregar({ children, ...rest }: ButtonProps) {
  return (
    <Button type="button" colorPalette="brand" {...rest}>
      <LuPlus aria-hidden />
      {children}
    </Button>
  );
}

/** Mensaje de error corto, debajo de un campo o de un bloque. */
export function MensajeError({
  children,
  ...rest
}: { children: ReactNode } & Pick<BoxProps, "mt" | "mb">) {
  return (
    <HStack
      role="alert"
      align="flex-start"
      gap="2"
      color="red.fg"
      fontSize="sm"
      fontWeight="medium"
      mt="2"
      {...rest}
    >
      <Box as="span" mt="0.5" flexShrink={0} aria-hidden>
        <LuTriangleAlert size={16} />
      </Box>
      <Text as="span">{children}</Text>
    </HStack>
  );
}

/**
 * Celda de cuerpo de tabla. Padding y borde ya resueltos.
 *
 * `numero`: cantidades, stock, porcentajes. Van a la derecha y con dígitos de
 * ancho fijo (`tabular-nums`), para que las cifras queden encolumnadas y se
 * comparen de un vistazo: "1.632,851 g" debajo de "16,243 Kg" con la coma en
 * el mismo lugar. Va con `numero` también en el encabezado de la columna.
 */
export function Celda({
  children,
  center = false,
  numero = false,
  ...rest
}: { children?: ReactNode; center?: boolean; numero?: boolean } & BoxProps) {
  return (
    <Table.Cell
      px="4"
      py="3"
      color="fg"
      fontSize="sm"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      textAlign={numero ? "right" : center ? "center" : undefined}
      fontVariantNumeric={numero ? "tabular-nums" : undefined}
      whiteSpace={numero ? "nowrap" : undefined}
      {...rest}
    >
      {children}
    </Table.Cell>
  );
}

/**
 * Texto de celda con tope de caracteres.
 *
 * Las tablas de la app usan `table-layout: fixed`: el ancho de cada columna
 * lo fija su encabezado y el contenido no lo estira, pero un texto largo se
 * acomodaba en varios renglones y la fila crecía en altura. Con el tope se
 * corta con elipsis, y el texto completo queda en el `title` para leerlo
 * pasando el mouse.
 *
 * Además del recorte por caracteres va el `ellipsis` de CSS: si el máximo
 * configurado todavía no entra en el ancho real de la columna, el navegador
 * termina de recortar sin agrandar nada.
 */
export function TextoTruncado({
  texto,
  max = 120,
  ...rest
}: {
  /** Texto a mostrar (se tolera `undefined`/`null`). */
  texto?: string | null;
  /** Máximo de caracteres visibles, elipsis incluida. */
  max?: number;
} & Omit<TextProps, "children">) {
  /*
   * Hasta dos renglones, no uno. Con un solo renglón "Zona de elaboración
   * Principal" quedaba en "Zona de elaboración Prin…" y había que pasar el
   * mouse para leer el sector. Dos renglones alcanzan para casi todo; lo que
   * no entra se corta con elipsis y queda completo en el `title`.
   */
  const valor = texto ?? "";
  const excede = valor.length > max;
  return (
    <Text
      title={valor.length > 30 ? valor : undefined}
      lineClamp={2}
      wordBreak="break-word"
      maxW="100%"
      {...rest}
    >
      {excede ? `${valor.slice(0, max - 1).trimEnd()}…` : valor}
    </Text>
  );
}

/* ───────────────────────── Anchos de columna ──────────────────────────── */

/**
 * Anchos por tipo de columna, en **porcentaje del ancho de la tabla**.
 *
 * Con `table-layout: fixed` (definido en el `slotRecipe` de `table`) el ancho
 * de una columna sale del `width` de su encabezado y no del contenido. Así los
 * nombres de las columnas caen siempre en el mismo lugar, en vez de moverse
 * según el dato de cada fila. Las columnas sin `width` se reparten en partes
 * iguales lo que sobra.
 *
 * Porcentaje y no píxeles, a propósito: con píxeles fijos, los 260px de la
 * columna de acciones se comían el 62% de una tabla de 3 columnas en una
 * ventana angosta y dejaban 79px para el nombre. En porcentaje la proporción
 * se mantiene desde 400px hasta 1600px de tabla.
 *
 * Los valores están calibrados para que **la suma de una tabla nunca llegue
 * al 100%**: si se pasa, la columna sin ancho (la principal) colapsa a cero.
 * Con `table-layout: fixed`, lo que sobra se reparte proporcionalmente entre
 * todas, así que quedarse corto es seguro y pasarse no.
 *
 *   angosta          14%  símbolo, estado, foto, cantidad: una palabra corta
 *   media            12%  fechas, DNI, periodicidad, "días restantes"
 *   amplia           16%  tipo, sector
 *   acciones         20%  un botón, o dos chicos ("Cerrar", "Reabrir")
 *   accionesAnchas   28%  dos botones ("Modificar" + "Eliminar" miden 177px)
 *                     o cuatro, que pasan a dos filas
 *
 * `angosta` es 14% y no menos porque la columna "Estado" y la "Origen" llevan
 * un `Badge`: "Pendiente" y "Elemento de limpieza" miden unos 90px, y con 9%
 * el texto se salía de la celda. La suma más cargada (incidentes, 7 columnas)
 * queda en 96%, y el plan de calibración (8 columnas) en 94%.
 *
 * `acciones` al 20% alcanza solo cuando hay un botón. Los catálogos con
 * "Modificar" y "Eliminar" necesitan `accionesAnchas`: con 20% en una tabla de
 * 660px la celda quedaba en 132px, los dos botones sumaban 177px y el
 * `overflow: hidden` de la tabla (el que hace las esquinas redondeadas)
 * recortaba "Eliminar".
 *
 * La columna principal (nombre, título, producto) NO lleva ancho a propósito:
 * se queda con lo que sobra y por eso siempre es la más ancha de la tabla.
 */
const ANCHO_COLUMNA = {
  angosta: "14%",
  media: "12%",
  amplia: "16%",
  acciones: "20%",
  accionesAnchas: "28%",
} as const;

export type AnchoColumna = keyof typeof ANCHO_COLUMNA;

/**
 * Columna de encabezado para tablas de detalle (fondo claro).
 * El texto va en caja normal: los nombres largos en mayúsculas se leen peor
 * y antes era exactamente lo que rompía la legibilidad de los listados.
 */
export function ColumnaHeader({
  children,
  center = false,
  ancho,
  width,
  ...rest
}: {
  children: ReactNode;
  center?: boolean;
  /** Mismo criterio que `EncabezadoOscuro`: ver `ANCHO_COLUMNA`. */
  ancho?: AnchoColumna;
} & BoxProps) {
  return (
    <Table.ColumnHeader
      px="4"
      py="3"
      color="fg"
      fontWeight="bold"
      fontSize="sm"
      textAlign={center ? "center" : undefined}
      width={width ?? (ancho ? ANCHO_COLUMNA[ancho] : undefined)}
      borderBottomWidth="2px"
      borderColor="border"
      bg="bg.muted"
      {...rest}
    >
      {children}
    </Table.ColumnHeader>
  );
}

/**
 * Encabezado de TODOS los listados.
 *
 * Antes era una franja teal oscura con texto blanco: pesaba más que los datos
 * y le sacaba protagonismo al color de los estados (vencido, stock bajo).
 * Ahora es gris claro con texto oscuro y un borde inferior marcado: se lee
 * como encabezado sin competir con el contenido, y el color queda para lo que
 * tiene que llamar la atención.
 *
 * El nombre `EncabezadoOscuro` se conserva para no tocar las ~100 tablas que
 * lo usan; `EncabezadoTabla` es el alias con el nombre que corresponde.
 */
export function FilaEncabezado({ children }: { children: ReactNode }) {
  return <Table.Row bg="gray.100">{children}</Table.Row>;
}

export function EncabezadoOscuro({
  children,
  center = false,
  numero = false,
  ancho,
  width,
  ...rest
}: {
  children: ReactNode;
  center?: boolean;
  /** Columna de cantidades: alineada a la derecha, igual que sus `Celda numero`. */
  numero?: boolean;
  /** Ancho por tipo de columna. Si se pasa `width`, gana sobre `ancho`. */
  ancho?: AnchoColumna;
} & BoxProps) {
  return (
    <Table.ColumnHeader
      px="4"
      py="3"
      color="gray.700"
      bg="gray.100"
      fontWeight="semibold"
      fontSize="sm"
      borderBottomWidth="2px"
      borderColor="gray.300"
      textAlign={numero ? "right" : center ? "center" : undefined}
      width={width ?? (ancho ? ANCHO_COLUMNA[ancho] : undefined)}
      /*
       * Fijo arriba al desplazarse. Solo tiene efecto en tablas cuyo
       * contenedor scrollea en vertical (`Tarjeta desplazable`): en el resto
       * no molesta. El fondo va en la celda porque el `sticky` no arrastra el
       * fondo de la fila.
       */
      position="sticky"
      top="0"
      zIndex="1"
      {...rest}
    >
      {children}
    </Table.ColumnHeader>
  );
}

export const EncabezadoTabla = EncabezadoOscuro;

/**
 * Fila de listado que abre su ficha al hacer clic en cualquier parte.
 *
 * Antes había que apuntar al ícono del ojo, al final de la fila; lo primero
 * que intenta cualquiera es tocar el nombre. Los botones y enlaces de la
 * fila siguen funcionando solos (el clic sobre ellos no abre la ficha), y
 * con teclado la fila se enfoca con Tab y se abre con Enter. El botón "ver"
 * explícito se mantiene para lectores de pantalla.
 */
export function FilaClickeable({
  onAbrir,
  children,
  ...rest
}: { onAbrir: () => void; children: ReactNode } & TableRowProps) {
  return (
    <Table.Row
      cursor="pointer"
      tabIndex={0}
      onClick={(e) => {
        const destino = e.target as HTMLElement;
        if (destino.closest("button, a, input, select, textarea, label")) return;
        onAbrir();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onAbrir();
        }
      }}
      _hover={{ bg: "brand.50" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "-2px" }}
      {...rest}
    >
      {children}
    </Table.Row>
  );
}

/** Acciones de fila de las tablas. El color codifica el tipo de acción. */
export type AccionTabla =
  | "ver"
  | "historial"
  | "foto"
  | "editar"
  | "subir"
  | "resolver"
  | "recambio"
  | "eliminar"
  | "reactivar"
  | "cerrar"
  | "reabrir"
  | "intervenir"
  | "ingreso"
  | "ajuste"
  | "minimo"
  | "asociar"
  | "escalar";

/**
 * Paleta por acción, uniforme en toda la app.
 *
 * Ninguna usa `brand`: el encabezado de las tablas ya es teal (`brand.600`) y
 * una acción del mismo color se confundía con él.
 *
 *   consultar (ver/historial/foto)          gris    solo lectura
 *   modificar/navegar (editar/subir/resolver) azul  cambia datos o abre otra pantalla
 *   recambio                                verde   se resuelve en la misma pantalla
 *   eliminar                                rojo    destructivo
 *   reactivar / cerrar                      verde   cierra el ciclo
 *   reabrir / intervenir                    naranja vuelve atrás / mantenimiento
 *                                           (no comparten tabla, así que no se
 *                                           confunden entre sí)
 */
const PALETA_ACCION: Record<AccionTabla, string> = {
  ver: "gray",
  historial: "gray",
  foto: "gray",
  editar: "blue",
  subir: "blue",
  resolver: "blue",
  recambio: "green",
  eliminar: "red",
  reactivar: "green",
  cerrar: "green",
  reabrir: "orange",
  intervenir: "orange",
  ingreso: "green",
  ajuste: "blue",
  minimo: "blue",
  asociar: "blue",
  escalar: "blue",
};

/** Ícono de cada acción (Lucide: el set de íconos de toda la app). */
const ICONO_ACCION: Record<AccionTabla, IconType> = {
  ver: LuEye,
  historial: LuHistory,
  foto: LuImage,
  editar: LuPencil,
  subir: LuUpload,
  resolver: LuExternalLink,
  recambio: LuRepeat,
  eliminar: LuTrash2,
  reactivar: LuRefreshCw,
  cerrar: LuCircleCheck,
  reabrir: LuRotateCcw,
  intervenir: LuWrench,
  /*
   * Ingreso, ajuste y mínimo conviven en la misma fila de Gestión de stock.
   * Antes ajuste y mínimo usaban el mismo lápiz que "editar": dos botones
   * idénticos uno al lado del otro, distinguibles solo por el tooltip.
   */
  ingreso: LuPackagePlus,
  ajuste: LuArrowUpDown,
  minimo: LuGauge,
  asociar: LuLink,
  escalar: LuCalculator,
};

/**
 * Botón de acción de una fila de tabla: ícono + tooltip, sin texto.
 *
 * Estilo *outline pastel*: en reposo, fondo apenas teñido, borde de 2px
 * (`palette.400`) e ícono de 18px en `palette.600`. El gris de solo lectura va
 * un escalón más marcado (`gray.100` de fondo, `gray.400` de borde y `gray.700`
 * de ícono) porque era el que más se perdía sobre el blanco. Al pasar el mouse
 * el botón se tiñe con `palette.100`, el borde sube a `.600` y el ícono a
 * `.700`: así el color aparece de verdad y acompaña al tooltip, sin volver al
 * relleno sólido que desentonaba con el resto de la pantalla.
 *
 * El nombre de la acción vive en el tooltip (con flecha y una espera corta para
 * que no parpadee al pasar el mouse) y en el `aria-label`, así el botón sigue
 * siendo accesible aunque no muestre texto.
 */
export function BotonAccion({
  accion,
  label,
  onClick,
  ...rest
}: {
  accion: AccionTabla;
  /** Nombre de la acción: se usa en el tooltip y en el `aria-label`. */
  label: string;
  onClick: () => void;
} & Omit<
  IconButtonProps,
  "children" | "colorPalette" | "variant" | "onClick" | "aria-label"
>) {
  const Icono = ICONO_ACCION[accion];
  const paleta = PALETA_ACCION[accion];
  /*
   * El gris es el que más se perdía sobre el blanco: lleva fondo, borde e ícono
   * un escalón más marcados que las acciones de color.
   */
  const esGris = paleta === "gray";
  return (
    <Tooltip content={label} showArrow openDelay={300} closeDelay={0}>
      <IconButton
        type="button"
        colorPalette={paleta}
        variant="outline"
        size="sm"
        /*
         * 44px de lado en pantallas chicas (el mínimo recomendado para tocar
         * con el dedo); 32px desde `md`, donde se usa mouse.
         */
        minW={{ base: "11", md: "8" }}
        h={{ base: "11", md: "8" }}
        borderWidth="2px"
        bg={esGris ? "gray.100" : `${paleta}.50`}
        borderColor={esGris ? "gray.400" : `${paleta}.400`}
        color={esGris ? "gray.700" : `${paleta}.600`}
        _hover={{
          bg: esGris ? "gray.200" : `${paleta}.100`,
          borderColor: esGris ? "gray.600" : `${paleta}.600`,
          color: esGris ? "gray.900" : `${paleta}.700`,
        }}
        _active={{ bg: esGris ? "gray.300" : `${paleta}.200` }}
        aria-label={label}
        onClick={onClick}
        {...rest}
      >
        <Icono size={18} aria-hidden />
      </IconButton>
    </Tooltip>
  );
}

/** Acción textual dentro de una celda (links, "ver historial"). */
export function BotonTexto({
  children,
  color = "brand.fg",
  onClick,
  title,
  ...rest
}: {
  children: ReactNode;
  color?: string;
  onClick: () => void;
  title?: string;
} & Omit<ButtonProps, "onClick" | "children">) {
  return (
    <Button
      type="button"
      variant="plain"
      size="xs"
      color={color}
      bg="transparent"
      p={0}
      h="auto"
      fontWeight="medium"
      textDecoration="underline"
      textUnderlineOffset="2px"
      onClick={onClick}
      title={title}
      {...rest}
    >
      {children}
    </Button>
  );
}

/**
 * Píldora de estado. El color solo codifica estado, nunca decoración.
 *
 * Antes iba en `bg.emphasized` con texto blanco: ese token es un gris claro,
 * así que el texto casi no se leía. `brand.800` da más de 7:1 con el blanco
 * y se distingue tanto sobre una superficie clara como sobre la franja
 * `brand.600` de los grupos del checklist.
 */
/**
 * Estado de un registro, con el mismo código en toda la app:
 *
 *   ok       verde    ✓  vigente, disponible, terminado, cerrado
 *   alerta   naranja  ◷  próximo a vencer, pendiente, abierto, con demora
 *   peligro  rojo     ⚠  vencido, stock bajo, cancelado
 *   info     azul     ●  en proceso
 *   neutro   gris     –  dado de baja, sin datos
 *
 * Lleva ícono además del color: quien no distingue bien rojo de verde lee el
 * estado igual. Antes cada pantalla armaba su `Badge` con su propio color (un
 * incidente abierto se veía en el mismo rojo que un vencimiento) y algunos
 * en mayúsculas.
 */
export type TonoEstado = "ok" | "alerta" | "peligro" | "info" | "neutro";

const ESTILO_TONO: Record<TonoEstado, { paleta: string; icono: IconType }> = {
  ok: { paleta: "green", icono: LuCircleCheck },
  alerta: { paleta: "orange", icono: LuClock },
  peligro: { paleta: "red", icono: LuTriangleAlert },
  info: { paleta: "blue", icono: LuLoader },
  neutro: { paleta: "gray", icono: LuMinus },
};

export function EtiquetaEstado({
  tono,
  children,
}: {
  tono: TonoEstado;
  children: ReactNode;
}) {
  const { paleta, icono: Icono } = ESTILO_TONO[tono];
  return (
    <Badge
      colorPalette={paleta}
      variant="subtle"
      size="md"
      gap="1.5"
      px="2.5"
      py="1"
      rounded="full"
      fontWeight="medium"
      whiteSpace="nowrap"
      maxW="100%"
    >
      <Icono size={14} aria-hidden />
      {children}
    </Badge>
  );
}

export function BadgeEstado({
  children,
  icono,
}: {
  children: ReactNode;
  /** Ícono opcional (de `react-icons`), a la izquierda del texto. */
  icono?: ReactNode;
}) {
  return (
    <Text
      as="span"
      fontSize="xs"
      fontWeight="bold"
      color="white"
      bg="brand.800"
      px="3"
      py="1"
      rounded="full"
      whiteSpace="nowrap"
      display="inline-flex"
      alignItems="center"
      gap="1.5"
    >
      {icono ? (
        <Box as="span" display="inline-flex" aria-hidden>
          {icono}
        </Box>
      ) : null}
      {children}
    </Text>
  );
}

/* ───────────────────────────── Formularios ──────────────────────────────── */

export function LabelFiltro({ children }: { children: ReactNode }) {
  return (
    <Text
      as="label"
      display="block"
      fontSize="sm"
      fontWeight="medium"
      color="fg.muted"
      mb="2"
    >
      {children}
    </Text>
  );
}

interface FormFieldProps {
  label: ReactNode;
  required?: boolean;
  invalid?: boolean;
  helper?: ReactNode;
  mb?: string;
  children: ReactNode;
}

/** Campo con label. El label se asocia al control (accesibilidad). */
export function FormField({
  label,
  required = false,
  invalid,
  helper,
  mb = "6",
  children,
}: FormFieldProps) {
  return (
    <Field.Root required={required} invalid={invalid} mb={mb}>
      <Field.Label color="fg.muted" fontWeight="medium">
        {label}
        {/* Asterisco en todos los campos obligatorios: antes no lo tenía ninguno. */}
        <Field.RequiredIndicator color="red.fg" />
      </Field.Label>
      {children}
      {helper ? (
        <Field.HelperText mt="2" fontSize="xs" color="fg.subtle">
          {helper}
        </Field.HelperText>
      ) : null}
    </Field.Root>
  );
}

/**
 * Validación al guardar.
 *
 * Antes los formularios deshabilitaban "Guardar" mientras faltaba algo, sin
 * decir qué: el botón gris no explicaba nada y había que adivinar. Ahora el
 * botón queda siempre habilitado; al tocarlo con campos vacíos no se envía,
 * aparece "Para guardar falta completar: el nombre, el sector" y esos campos
 * se marcan en rojo.
 *
 *   const faltan = faltantes({ nombre: [!values.nombre.trim(), "el nombre"] });
 *   const { intentado, puedeEnviar } = useIntentoEnvio();
 *   // submit:  if (!puedeEnviar(faltan.lista)) return;
 *   // campo:   <FormField invalid={intentado && faltan.tiene("nombre")}>
 *   // aviso:   <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
 */
export function faltantes(reglas: Record<string, [falta: boolean, etiqueta: string]>) {
  const claves = Object.keys(reglas).filter((clave) => reglas[clave][0]);
  return {
    lista: claves.map((clave) => reglas[clave][1]),
    tiene: (clave: string) => claves.includes(clave),
  };
}

export function useIntentoEnvio() {
  const [intentado, setIntentado] = useState(false);
  const puedeEnviar = useCallback((lista: string[]) => {
    setIntentado(true);
    return lista.length === 0;
  }, []);
  return { intentado, puedeEnviar };
}

export function AvisoFaltantes({
  visible,
  faltantes: lista,
}: {
  visible: boolean;
  faltantes: string[];
}) {
  if (!visible || lista.length === 0) return null;
  return (
    <MensajeError mt="0" mb="4">
      Para guardar falta completar: {lista.join(", ")}.
    </MensajeError>
  );
}

/** El aspecto del input viene de la receta `input` del tema. */
export function FormInput(props: InputProps) {
  return <Input {...props} />;
}

interface FormNativeSelectProps
  extends Omit<
      SelectHTMLAttributes<HTMLSelectElement>,
      "children" | "disabled" | "size"
    >,
    Pick<BoxProps, "maxW" | "minW" | "w" | "mt" | "mb"> {
  children: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * `NativeSelect.Field` no consume la receta `input`, así que se le da el
 * mismo lenguaje visual a mano para que no quede un control distinto al
 * lado de los inputs.
 */
export function FormNativeSelect({
  children,
  disabled,
  invalid,
  maxW,
  minW,
  w,
  mt,
  mb,
  ...rest
}: FormNativeSelectProps) {
  /*
   * El ancho va en el Root y no en el Field: la flechita (`Indicator`) se
   * posiciona contra el Root. Con `maxW` en el Field, el select se achicaba
   * pero la flecha quedaba en el borde del Root, afuera del control (se veía
   * en "Nuevo lote", con selects de 500px en una tarjeta más ancha).
   */
  return (
    <NativeSelect.Root
      disabled={disabled}
      w={w ?? "100%"}
      maxW={maxW}
      minW={minW}
      mt={mt}
      mb={mb}
    >
      <NativeSelect.Field
        {...rest}
        w="100%"
        bg="bg.panel"
        color="fg"
        borderWidth="2px"
        borderStyle="solid"
        borderColor={invalid ? "red.500" : "brand.300"}
        borderRadius="lg"
        h="10"
        px="3"
        fontSize="sm"
        outline="none"
        transitionProperty="border-color, box-shadow"
        transitionDuration="fast"
        aria-disabled={disabled || undefined}
        _hover={!disabled ? { borderColor: "brand.400" } : undefined}
        _focusVisible={{
          borderColor: "brand.500",
          boxShadow: "0 0 0 3px var(--chakra-colors-brand-100)",
        }}
        _disabled={{ opacity: 0.6, cursor: "not-allowed" }}
      >
        {children}
      </NativeSelect.Field>
      <NativeSelect.Indicator color="fg.muted" />
    </NativeSelect.Root>
  );
}

export function SelectPlaceholder({
  value = 0,
  children,
}: {
  value?: number | string;
  children: ReactNode;
}) {
  return (
    <option value={value} disabled>
      {children}
    </option>
  );
}

/**
 * Sin validación nativa del navegador. Los campos llevan `required` (por el
 * asterisco de `FormField`), y con eso el navegador frenaba el envío con su
 * globito antes de que corriera `useIntentoEnvio`, que es el que dice qué
 * falta y marca los campos. Va como objeto porque el tipado polimórfico de
 * `Box as="form"` no conoce `noValidate`.
 */
export const SIN_VALIDACION_NATIVA = { noValidate: true } as BoxProps;

/** Superficie de un formulario de alta/edición. */
export function TarjetaFormulario({ children, ...rest }: BoxProps) {
  return (
    <Box
      {...(rest.as === "form" ? SIN_VALIDACION_NATIVA : {})}
      bg="bg.panel"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      p={{ base: "6", md: "8" }}
      mb="8"
      {...rest}
    >
      {children}
    </Box>
  );
}

export function TituloFormulario({ children, ...rest }: HeadingProps) {
  return (
    <Heading as="h3" size="lg" fontWeight="bold" color="brand.fg" mb="6" {...rest}>
      {children}
    </Heading>
  );
}

export function AccionesFormulario({ children }: { children: ReactNode }) {
  return (
    <HStack gap="4" flexWrap="wrap" mt="6">
      {children}
    </HStack>
  );
}

/** Barra de acciones al pie de fichas y páginas de solo lectura. */
export function AccionesDetalle({ children }: { children: ReactNode }) {
  return (
    <HStack
      gap="4"
      flexWrap="wrap"
      mt="6"
      pt="5"
      borderTopWidth="1px"
      borderColor="border.subtle"
    >
      {children}
    </HStack>
  );
}

/** Acción principal del formulario. Teal: una sola por pantalla. */
export function BotonGuardar(props: ButtonProps) {
  return (
    <Button type="submit" colorPalette="brand" size="md" {...props} />
  );
}

/** Acción secundaria: cancelar, volver. */
export function BotonCancelar(props: ButtonProps) {
  return (
    <Button type="button" colorPalette="neutral" variant="outline" size="md" {...props} />
  );
}

/** "Volver a la lista", al pie de fichas y páginas de edición. */
export function BotonVolver(props: ButtonProps) {
  return (
    <Button
      type="button"
      colorPalette="neutral"
      variant="outline"
      size="md"
      bg="bg.panel"
      borderColor="border"
      _hover={{ bg: "bg.subtle" }}
      {...props}
    />
  );
}

/* ─────────────────────── Estado, paginación y filtros ──────────────────── */

export function BannerError({
  children,
  mb = "6",
}: {
  children: ReactNode;
  mb?: string;
}) {
  return (
    <Box
      role="alert"
      bg="red.50"
      color="red.fg"
      borderWidth="1px"
      borderColor="red.200"
      rounded="md"
      px="4"
      py="3"
      mb={mb}
      fontSize="sm"
      fontWeight="medium"
      display="flex"
      alignItems="flex-start"
      gap="2"
    >
      <Box as="span" mt="0.5" flexShrink={0} aria-hidden>
        <LuTriangleAlert size={16} />
      </Box>
      <Box>{children}</Box>
    </Box>
  );
}

export function BannerExito({
  children,
  mb = "6",
}: {
  children: ReactNode;
  mb?: string;
}) {
  return (
    <Box
      role="status"
      bg="green.50"
      color="green.fg"
      borderWidth="1px"
      borderColor="green.200"
      rounded="md"
      px="4"
      py="3"
      mb={mb}
      fontSize="sm"
      fontWeight="medium"
      display="flex"
      alignItems="flex-start"
      gap="2"
    >
      <Box as="span" mt="0.5" flexShrink={0} aria-hidden>
        <LuCircleCheck size={16} />
      </Box>
      <Box>{children}</Box>
    </Box>
  );
}

export function Paginacion({
  count,
  page,
  pageSize,
  onPageChange,
}: {
  /**
   * Total de FILAS, no de páginas: es el `count` de Chakra, que calcula las
   * páginas como `ceil(count / pageSize)`. Pasarle el número de páginas
   * (2 páginas con pageSize 10) daba `ceil(2/10) = 1` y la segunda página
   * quedaba inalcanzable aunque la tabla tuviera filas para ella.
   */
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  // Para « inicio y » fin: los triggers de Chakra solo cubren anterior y
  // siguiente, así que estos dos botones llaman directo a `onPageChange`.
  const totalPaginas = Math.max(1, Math.ceil(count / pageSize));

  /*
   * Mismo lenguaje visual que los botones numéricos de abajo: transparente
   * con borde sutil, hover con el fondo suave de la marca y el estado
   * deshabilitado que Chakra ya atenúa en la receta de botón.
   */
  const estiloNav: ButtonProps = {
    bg: "transparent",
    color: "brand.fg",
    borderWidth: "1px",
    borderColor: "border",
    rounded: "md",
    _hover: { bg: "brand.subtle" },
  };

  return (
    <Pagination.Root
      count={count}
      pageSize={pageSize}
      page={page}
      onPageChange={(e) => onPageChange(e.page)}
      mt="6"
    >
      {/* flexWrap (acá y no en el HStack): los botones viven todos dentro
          del mismo ButtonGroup, así que la fila que tiene que envolver en
          pantallas angostas es la del grupo. */}
      <HStack justify="center">
        <ButtonGroup variant="ghost" size="sm" flexWrap="wrap" justifyContent="center">
          {/* « inicio */}
          <IconButton
            aria-label="Primera página"
            title="Primera página"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            {...estiloNav}
          >
            <LuChevronsLeft aria-hidden />
          </IconButton>

          {/* ‹ anterior */}
          <Pagination.PrevTrigger asChild>
            <IconButton
              aria-label="Página anterior"
              title="Página anterior"
              disabled={page <= 1}
              {...estiloNav}
            >
              <LuChevronLeft aria-hidden />
            </IconButton>
          </Pagination.PrevTrigger>

          <Pagination.Items
            render={(pageItem) => {
              const isSelected = pageItem.value === page;
              return (
                <IconButton
                  aria-label={`Página ${pageItem.value}`}
                  bg={isSelected ? "brand.600" : "transparent"}
                  color={isSelected ? "white" : "brand.fg"}
                  borderWidth={isSelected ? "0" : "1px"}
                  borderColor="border"
                  rounded="md"
                  _hover={{ bg: isSelected ? "brand.700" : "brand.subtle" }}
                >
                  {pageItem.value}
                </IconButton>
              );
            }}
          />

          {/* siguiente › */}
          <Pagination.NextTrigger asChild>
            <IconButton
              aria-label="Página siguiente"
              title="Página siguiente"
              disabled={page >= totalPaginas}
              {...estiloNav}
            >
              <LuChevronRight aria-hidden />
            </IconButton>
          </Pagination.NextTrigger>

          {/* fin » */}
          <IconButton
            aria-label="Última página"
            title="Última página"
            disabled={page >= totalPaginas}
            onClick={() => onPageChange(totalPaginas)}
            {...estiloNav}
          >
            <LuChevronsRight aria-hidden />
          </IconButton>
        </ButtonGroup>
      </HStack>
    </Pagination.Root>
  );
}

/**
 * Interruptor "Ver dados de baja". Su lugar es `BarraFiltros` →
 * `herramientas`; ahí va con `enBarra` para que no sume margen propio.
 */
export function ToggleInactivos({
  checked,
  onChange,
  children = "Ver dadas de baja",
  enBarra = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
  enBarra?: boolean;
}) {
  return (
    <HStack justify="flex-end" mb={enBarra ? "0" : "6"}>
      <Switch.Root
        checked={checked}
        onCheckedChange={(e) => onChange(e.checked)}
        colorPalette="neutral"
      >
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label
          fontSize="sm"
          color="fg.muted"
          fontWeight={checked ? "bold" : "normal"}
        >
          {children}
        </Switch.Label>
      </Switch.Root>
    </HStack>
  );
}

/**
 * Aviso de operación exitosa.
 *
 * Antes era un diálogo centrado que tapaba la pantalla 2 segundos y después
 * redirigía solo: no se podía hacer nada mientras tanto. Ahora es un aviso
 * breve en la esquina (`toaster`) que no bloquea, y la navegación de vuelta
 * es inmediata (`useDelayedNavigate`); el aviso sigue visible en la pantalla
 * de destino. Se mantiene la misma API (`isOpen`, `mensaje`) para no tocar
 * las páginas que lo usan.
 */
export function DialogoExito({
  isOpen,
  mensaje,
}: {
  isOpen: boolean;
  mensaje: string;
}) {
  useEffect(() => {
    if (isOpen) {
      toaster.create({ type: "success", title: mensaje, duration: 4000 });
    }
  }, [isOpen, mensaje]);
  return null;
}
