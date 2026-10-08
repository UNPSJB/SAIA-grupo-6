import {
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
  type InputProps,
} from "@chakra-ui/react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import {
  LuCircleCheck,
  LuPlus,
  LuTriangleAlert,
} from "react-icons/lu";
import { DialogContent, DialogRoot, DialogTitle } from "./dialog";

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
  ...rest
}: { children: ReactNode } & BoxProps) {
  return (
    <Box
      bg="bg.panel"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      overflow="hidden"
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

/** Fila de cuerpo de tabla. Padding y borde ya resueltos. */
export function Celda({
  children,
  center = false,
  ...rest
}: { children?: ReactNode; center?: boolean } & BoxProps) {
  return (
    <Table.Cell
      px="4"
      py="3"
      color="fg"
      fontSize="sm"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      textAlign={center ? "center" : undefined}
      {...rest}
    >
      {children}
    </Table.Cell>
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
 *   amplia           16%  tipo, ubicación
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

/** Franja de encabezado oscura: es el patrón de TODOS los listados. */
export function FilaEncabezado({ children }: { children: ReactNode }) {
  // `brand.600` y no `brand.500`: con el 500 el blanco quedaba en 4.4:1, por
  // debajo del 4.5:1 que pide WCAG AA para texto de 14px.
  return <Table.Row bg="brand.600">{children}</Table.Row>;
}

export function EncabezadoOscuro({
  children,
  center = false,
  ancho,
  width,
  ...rest
}: {
  children: ReactNode;
  center?: boolean;
  /** Ancho por tipo de columna. Si se pasa `width`, gana sobre `ancho`. */
  ancho?: AnchoColumna;
} & BoxProps) {
  return (
    <Table.ColumnHeader
      px="4"
      py="3"
      color="white"
      fontWeight="bold"
      fontSize="sm"
      borderBottomWidth="none"
      borderColor="transparent"
      textAlign={center ? "center" : undefined}
      width={width ?? (ancho ? ANCHO_COLUMNA[ancho] : undefined)}
      {...rest}
    >
      {children}
    </Table.ColumnHeader>
  );
}

/** Paletas de las acciones de fila. */
export type AccionTabla =
  | "editar"
  | "eliminar"
  | "reactivar"
  | "marca"
  | "historial"
  | "calibrar"
  | "cerrar"
  | "reabrir";

const PALETA_ACCION: Record<AccionTabla, string> = {
  editar: "orange",
  eliminar: "red",
  reactivar: "green",
  marca: "brand",
  historial: "brand",
  calibrar: "neutral",
  cerrar: "brand",
  reabrir: "orange",
};

export function BotonTabla({
  accion,
  children,
  ...rest
}: { accion: AccionTabla; children: ReactNode } & Omit<
  ButtonProps,
  "children" | "colorPalette" | "variant"
>) {
  return (
    <Button
      type="button"
      colorPalette={PALETA_ACCION[accion]}
      variant="solid"
      size="sm"
      fontWeight="medium"
      h="auto"
      px="3"
      py="1"
      rounded="sm"
      {...rest}
    >
      {children}
    </Button>
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
  return (
    <NativeSelect.Root disabled={disabled}>
      <NativeSelect.Field
        {...rest}
        w={w ?? "100%"}
        maxW={maxW}
        minW={minW}
        mt={mt}
        mb={mb}
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

/** Superficie de un formulario de alta/edición. */
export function TarjetaFormulario({ children, ...rest }: BoxProps) {
  return (
    <Box
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

export function TituloFormulario({ children }: { children: ReactNode }) {
  return (
    <Heading as="h3" size="lg" fontWeight="bold" color="brand.fg" mb="6">
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

/** "Volver a la lista", en el encabezado de las páginas de edición. */
export function BotonVolver(props: ButtonProps) {
  return (
    <Button
      type="button"
      colorPalette="neutral"
      variant="outline"
      size="sm"
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
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Pagination.Root
      count={count}
      pageSize={pageSize}
      page={page}
      onPageChange={(e) => onPageChange(e.page)}
      mt="6"
    >
      <HStack justify="center">
        <ButtonGroup variant="ghost" size="sm">
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
        </ButtonGroup>
      </HStack>
    </Pagination.Root>
  );
}

export function ToggleInactivos({
  checked,
  onChange,
  children = "Ver dadas de baja",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <HStack justify="flex-end" mb="6">
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
 * Aviso de operación exitosa antes de volver al listado.
 * Usa `Dialog` para que traiga foco atrapado y roles ARIA; no tiene acción
 * de cierre, conserva el comportamiento de "mostrar y redirigir".
 */
export function DialogoExito({
  isOpen,
  mensaje,
}: {
  isOpen: boolean;
  mensaje: string;
}) {
  if (!isOpen) return null;

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        width="400px"
        maxWidth="400px"
        p="8"
        rounded="lg"
        bg="bg.panel"
        textAlign="center"
        boxShadow="dialog"
      >
        <Box color="green.fg" display="flex" justifyContent="center" mb="2" aria-hidden>
          <LuCircleCheck size={32} />
        </Box>
        <DialogTitle fontSize="lg" fontWeight="bold" color="green.fg">
          Éxito
        </DialogTitle>
        <Text mt="3" color="fg.muted" fontSize="sm">
          {mensaje}
        </Text>
      </DialogContent>
    </DialogRoot>
  );
}