import {
  Box,
  Button,
  ButtonGroup,
  Heading,
  HStack,
  IconButton,
  Pagination,
  Switch,
  Table,
  Text,
  type BoxProps,
  type ButtonProps,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "./dialog";

/**
 * Patrones de tabla y tarjeta compartidos por todas las features.
 *
 * Antes cada archivo de página declaraba sus propios `Celda` /
 * `ColumnaHeader` / `Tarjeta` con valores ligeramente distintos que se
 * colaban sin que nadie los notara. Acá vive la fuente de verdad del
 * formato: si cambia el padding de las celdas, cambia una vez.
 *
 * Los colores son todos tokens del sistema (`src/theme/index.ts`); nada
 * de hex sueltos.
 */

/** Label compacto de filtro de formulario (fechas, selects, etc.). */
export function LabelFiltro({ children }: { children: ReactNode }) {
  return (
    <Box
      as="label"
      display="block"
      fontSize="14px"
      fontWeight="bold"
      mb="8px"
      color="gray.600"
    >
      {children}
    </Box>
  );
}

/** Tarjeta blanca contenedora de tablas y secciones de reporte. */
export function Tarjeta({
  children,
  mt,
  ...rest
}: { children: ReactNode; mt?: string } & BoxProps) {
  return (
    <Box
      bg="white"
      rounded="10px"
      boxShadow="0 2px 6px rgba(0,0,0,0.05)"
      overflow="hidden"
      mt={mt}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Celda de cuerpo de tabla con el formato estándar de la app. */
export function Celda({
  children,
  center = false,
  ...rest
}: { children?: ReactNode; center?: boolean } & BoxProps) {
  return (
    <Table.Cell
      color="gray.800"
      fontSize="14px"
      p="10px 16px"
      borderBottom="1px solid"
      borderColor="gray.100"
      bg="white"
      textAlign={center ? "center" : undefined}
      {...rest}
    >
      {children}
    </Table.Cell>
  );
}

/** Columna de encabezado con el formato estándar de la app. */
export function ColumnaHeader({
  children,
  center = false,
  width,
  ...rest
}: { children: ReactNode; center?: boolean; width?: string } & BoxProps) {
  return (
    <Table.ColumnHeader
      color="gray.800"
      fontWeight="bold"
      fontSize="13px"
      textTransform="uppercase"
      letterSpacing="0.03em"
      p="10px 16px"
      borderBottom="2px solid"
      borderColor="brand.300"
      bg="brand.100"
      textAlign={center ? "center" : undefined}
      width={width}
      {...rest}
    >
      {children}
    </Table.ColumnHeader>
  );
}

/** Botón de texto subrayado para acciones dentro de tablas. */
export function BotonTexto({
  children,
  color = "brand.500",
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
      fontWeight="bold"
      textDecoration="underline"
      onClick={onClick}
      title={title}
      {...rest}
    >
      {children}
    </Button>
  );
}

/** Píldora oscura para el header de un grupo colapsable. */
export function BadgeEstado({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="11px"
      fontWeight="bold"
      color="white"
      bg="blackAlpha.300"
      p="4px 10px"
      rounded="999px"
      whiteSpace="nowrap"
    >
      {children}
    </Text>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Patrones agregados en la segunda etapa de la migración.
 *
 * Los cuatro siguientes estaban re-declarados dentro de cada feature:
 * el botón de acción de tabla (idéntico en los 13 `*Item.tsx`), el
 * encabezado oscuro de tabla (4 props de override por columna en cada
 * `*Table.tsx`), el banner de error de formulario y el par de botones
 * Guardar/Cancelar.
 * ───────────────────────────────────────────────────────────────────── */

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
  calibrar: "gray",
  cerrar: "brand",
  reabrir: "orange",
};

/**
 * Botón de acción dentro de una fila de tabla.
 *
 * Reemplaza al trío `bg={ADVERTENCIA} color="white" border="none"
 * p="6px 12px" rounded="4px" _hover={{ bg: ADVERTENCIA_HOVER }}` que se
 * repetía en cada `*Item.tsx` con los hex de la capa de compatibilidad.
 * Ahora la paleta se resuelve con `colorPalette` y el hover con
 * `colorPalette.solid`, así que no hay que mantener un color por estado.
 */
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
      fontWeight="normal"
      h="auto"
      px="3"
      py="1.5"
      rounded="md"
      {...rest}
    >
      {children}
    </Button>
  );
}

/**
 * Encabezado de columna para la franja oscura de las tablas.
 *
 * Antes cada columna repetía los mismos cuatro overrides sobre
 * `ColumnaHeader` (`bg="brand.500" color="white" fontWeight="normal"
 * fontSize="16px" borderColor="transparent" p="3"`), que además pisaban
 * el formato por defecto de `ColumnaHeader`. Acá queda en un solo lugar.
 */
export function EncabezadoOscuro({
  children,
  center = false,
  width,
  ...rest
}: { children: ReactNode; center?: boolean; width?: string } & BoxProps) {
  return (
    <Table.ColumnHeader
      bg="brand.500"
      color="white"
      fontWeight="normal"
      fontSize="md"
      borderColor="transparent"
      borderBottom="none"
      p="3"
      textAlign={center ? "center" : undefined}
      width={width}
      {...rest}
    >
      {children}
    </Table.ColumnHeader>
  );
}

/** Franja de encabezado oscura de una tabla. */
export function FilaEncabezado({ children }: { children: ReactNode }) {
  return (
    <Table.Row bg="brand.500" color="white" textAlign="left">
      {children}
    </Table.Row>
  );
}

/**
 * Banner de error de los formularios y las páginas.
 *
 * Reemplaza al `Box bg="red.100" color="red.800" borderColor="red.200"`
 * repetido, que venía de `ERROR_FONDO`/`ERROR_BORDE`/`ERROR_TEXTO`.
 */
export function BannerError({
  children,
  mb = "5",
}: {
  children: ReactNode;
  mb?: string;
}) {
  return (
    <Box
      role="alert"
      bg="red.100"
      color="red.800"
      borderWidth="1px"
      borderColor="red.200"
      rounded="md"
      p="3"
      mb={mb}
      fontWeight="bold"
    >
      ⚠️ {children}
    </Box>
  );
}

/** Banner de confirmación exitosa. */
export function BannerExito({
  children,
  mb = "5",
}: {
  children: ReactNode;
  mb?: string;
}) {
  return (
    <Box
      role="status"
      bg="green.100"
      color="green.800"
      borderWidth="1px"
      borderColor="green.200"
      rounded="md"
      p="3"
      mb={mb}
      fontWeight="bold"
    >
      ✓ {children}
    </Box>
  );
}

/**
 * Botones del pie de un formulario.
 *
 * Reemplaza al par de `<Button>` con `style={{ backgroundColor: TEAL… }}` /
 * `style={{ backgroundColor: GRIS_CLARO… }}` que estaba duplicado en los
 * 8 `*Form.tsx`.
 */
export function AccionesFormulario({ children }: { children: ReactNode }) {
  return (
    <HStack gap="4" flexWrap="wrap" mt="6">
      {children}
    </HStack>
  );
}

/** Botón primario de formulario. */
export function BotonGuardar(props: ButtonProps) {
  return (
    <Button
      type="submit"
      colorPalette="brand"
      variant="solid"
      rounded="lg"
      fontWeight="bold"
      px="6"
      py="3"
      {...props}
    />
  );
}

/** Botón secundario de formulario ("Cancelar", "Volver"). */
export function BotonCancelar(props: ButtonProps) {
  return (
    <Button
      type="button"
      variant="plain"
      bg="gray.200"
      color="gray.800"
      rounded="lg"
      fontWeight="bold"
      px="6"
      py="3"
      _hover={{ bg: "gray.300" }}
      {...props}
    />
  );
}

/**
 * Botón neutro de "Volver a la lista", en el encabezado de las páginas de
 * alta y edición. Estaba duplicado en 12 páginas con las mismas ocho props.
 */
export function BotonVolver(props: ButtonProps) {
  return (
    <Button
      type="button"
      colorPalette="gray"
      variant="solid"
      fontSize="md"
      fontWeight="normal"
      h="auto"
      minW="auto"
      px="4"
      py="2"
      rounded="md"
      {...props}
    />
  );
}

/**
 * Paginación de los listados.
 *
 * El bloque `Pagination.Root` + `ButtonGroup` + `IconButton` con el estado
 * seleccionado en `brand.500` estaba copiado en 6 páginas de listado.
 */
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
      mt="4"
    >
      <HStack justify="center">
        <ButtonGroup variant="ghost" size="sm">
          <Pagination.Items
            render={(pageItem) => {
              const isSelected = pageItem.value === page;
              return (
                <IconButton
                  aria-label={`Página ${pageItem.value}`}
                  bg={isSelected ? "brand.500" : "transparent"}
                  color={isSelected ? "white" : "brand.500"}
                  borderWidth={isSelected ? "0" : "1px"}
                  borderColor="brand.500"
                  _hover={{ bg: isSelected ? "brand.500" : "brand.500/10" }}
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

/**
 * Interruptor "Ver dados de baja" de los listados.
 *
 * Repetido en 6 páginas con el mismo `Switch` y el `Switch.Label` que
 * cambia de color según el estado.
 */
export function ToggleInactivos({
  checked,
  onChange,
  children = "Ver dados de baja",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <HStack justify="flex-end" mb="5">
      <Switch.Root
        checked={checked}
        onCheckedChange={(e) => onChange(e.checked)}
        colorPalette="gray"
      >
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label
          fontSize="sm"
          color={checked ? "red.600" : "gray.600"}
          fontWeight={checked ? "bold" : "normal"}
        >
          {children}
        </Switch.Label>
      </Switch.Root>
    </HStack>
  );
}

/**
 * Superficie blanca de los formularios de alta y edición.
 *
 * `bg="white" p="8" rounded="xl" boxShadow="card" mb="8"` estaba copiado en
 * los 9 `*Form.tsx` del proyecto.
 */
export function TarjetaFormulario({ children, ...rest }: BoxProps) {
  return (
    <Box bg="white" p="8" rounded="xl" boxShadow="card" mb="8" {...rest}>
      {children}
    </Box>
  );
}

/** Título de los formularios de alta y edición. */
export function TituloFormulario({ children }: { children: ReactNode }) {
  return (
    <Heading as="h3" mt={0} fontSize="2xl" fontWeight="bold" color="brand.500" mb="6">
      {children}
    </Heading>
  );
}

/**
 * Aviso de operación exitosa que se muestra antes de volver al listado.
 *
 * Reemplaza al overlay escrito a mano (`position: fixed`, `inset: 0`,
 * `rgba(0,0,0,0.4)`, `zIndex: 1000`, tarjeta blanca centrada) que estaba
 * duplicado en las páginas de alta y de edición de casi todas las features.
 * Al usar `Dialog` gana foco atrapado y roles ARIA; y como no tiene acción
 * de cierre, conserva el comportamiento original de mostrar y redirigir.
 */
export function DialogoExito({ isOpen, mensaje }: { isOpen: boolean; mensaje: string }) {
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
        width="350px"
        maxWidth="350px"
        p="8"
        rounded="l2"
        bg="white"
        textAlign="center"
        boxShadow="dialog"
      >
        <Text fontSize="3xl" mb="2" aria-hidden>
          ✅
        </Text>
        <DialogTitle fontSize="2xl" fontWeight="bold" color="green.600">
          Éxito
        </DialogTitle>
        <Text mt="3" color="gray.600" fontSize="md">
          {mensaje}
        </Text>
      </DialogContent>
    </DialogRoot>
  );
}
