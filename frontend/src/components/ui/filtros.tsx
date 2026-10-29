import { Box, Button, HStack, IconButton, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  LuArrowDown,
  LuArrowUp,
  LuArrowUpDown,
  LuX,
} from "react-icons/lu";

import type { OrdenTabla } from "../../common/hooks/useOrdenTabla";
import {
  EncabezadoOscuro,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  Tarjeta,
  type AnchoColumna,
} from "./patrones";

export function BarraFiltros({
  busqueda,
  filtros,
}: {
  busqueda?: ReactNode;
  filtros: ReactNode;
}) {
  return (
    <Tarjeta p="4" mb="4">
      <HStack
        gap="4"
        flexWrap="wrap"
        align="flex-end"
        justify={busqueda ? "space-between" : "flex-end"}
      >
        {busqueda ? (
          <Box flex="1" minW="250px" maxW="420px">
            {busqueda}
          </Box>
        ) : null}
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          {filtros}
        </HStack>
      </HStack>
    </Tarjeta>
  );
}

export function CampoBusqueda({
  valor,
  onCambio,
  placeholder = "Buscar...",
}: {
  valor: string;
  onCambio: (valor: string) => void;
  placeholder?: string;
}) {
  return (
    <Box minW="250px">
      <LabelFiltro>Búsqueda</LabelFiltro>
      <FormInput
        type="search"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar en el listado"
      />
    </Box>
  );
}

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
}

export function FiltroSelect({
  label,
  valor,
  onCambio,
  opciones,
  todos = "Todos",
  minW = "200px",
}: {
  label: string;
  valor: string;
  onCambio: (valor: string) => void;
  opciones: OpcionFiltro[];
  todos?: string;
  minW?: string;
}) {
  return (
    <Box minW={minW}>
      <LabelFiltro>{label}</LabelFiltro>
      <FormNativeSelect
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        aria-label={label}
      >
        <option value="">{todos}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </FormNativeSelect>
    </Box>
  );
}

/** Select de orden sin opción vacía (el listado siempre está ordenado). */
export function SelectOrden({
  label = "Ordenar",
  valor,
  onCambio,
  opciones,
  minW = "220px",
}: {
  label?: string;
  valor: string;
  onCambio: (valor: string) => void;
  opciones: OpcionFiltro[];
  minW?: string;
}) {
  return (
    <Box minW={minW}>
      <LabelFiltro>{label}</LabelFiltro>
      <FormNativeSelect
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        aria-label="Ordenar el listado"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </FormNativeSelect>
    </Box>
  );
}

export interface ChipFiltro {
  clave: string;
  etiqueta: string;
  valor: string;
  onQuitar: () => void;
}

export interface DefinicionChip {
  clave: string;
  etiqueta: string;
  valor?: string | null;
  visible?: boolean;
  recortar?: boolean;
  onQuitar: () => void;
}

export function chipsDeFiltros(definiciones: DefinicionChip[]): ChipFiltro[] {
  const chips: ChipFiltro[] = [];

  for (const definicion of definiciones) {
    const valor = definicion.recortar
      ? definicion.valor?.trim()
      : definicion.valor;
    const visible = definicion.visible ?? Boolean(valor);
    if (!visible) continue;

    chips.push({
      clave: definicion.clave,
      etiqueta: definicion.etiqueta,
      valor: valor ?? "",
      onQuitar: definicion.onQuitar,
    });
  }

  return chips;
}

export function ChipsFiltros({
  filtros,
  onLimpiarTodo,
}: {
  filtros: ChipFiltro[];
  onLimpiarTodo: () => void;
}) {
  if (filtros.length === 0) return null;

  return (
    <HStack
      gap="2"
      flexWrap="wrap"
      mb="4"
      role="group"
      aria-label="Filtros y orden aplicados"
    >
      {filtros.map((filtro) => (
        <Box
          key={filtro.clave}
          as="span"
          display="inline-flex"
          alignItems="center"
          gap="2"
          pl="3"
          pr="1"
          py="1"
          rounded="full"
          bg="brand.50"
          borderWidth="1px"
          borderColor="brand.200"
        >
          <Text as="span" fontSize="xs" color="fg.muted">
            {filtro.etiqueta}:
          </Text>
          <Text as="span" fontSize="sm" fontWeight="semibold">
            {filtro.valor}
          </Text>
          <IconButton
            aria-label={`Quitar filtro ${filtro.etiqueta}`}
            size="2xs"
            variant="ghost"
            colorPalette="neutral"
            onClick={filtro.onQuitar}
          >
            <LuX size={12} aria-hidden />
          </IconButton>
        </Box>
      ))}

      <Button
        type="button"
        size="xs"
        variant="ghost"
        colorPalette="neutral"
        onClick={onLimpiarTodo}
      >
        Limpiar todo
      </Button>
    </HStack>
  );
}

export function EncabezadoOrdenable<C extends string>({
  children,
  columna,
  orden,
  ancho,
  center = false,
}: {
  children: string;
  columna: C;
  orden: OrdenTabla<C, string>;
  ancho?: AnchoColumna;
  center?: boolean;
}) {
  const activa = orden.columna === columna;
  const Icono = !activa
    ? LuArrowUpDown
    : orden.direccion === "asc"
      ? LuArrowUp
      : LuArrowDown;

  return (
    <EncabezadoOscuro
      ancho={ancho}
      center={center}
      title={`Ordenar por ${children}`}
      aria-sort={
        activa
          ? orden.direccion === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      onClick={() => orden.ordenar(columna)}
    >
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        gap="1"
        cursor="pointer"
        userSelect="none"
      >
        {children}
        <Icono size={14} opacity={activa ? 1 : 0.55} aria-hidden />
      </Box>
    </EncabezadoOscuro>
  );
}

export function EstadoVacioFiltrado({
  children = "No hay resultados con los filtros aplicados.",
  onLimpiar,
}: {
  children?: ReactNode;
  onLimpiar: () => void;
}) {
  return (
    <Tarjeta p="8" textAlign="center">
      <Text color="fg.muted" mb="3">
        {children}
      </Text>
      <Button
        type="button"
        colorPalette="brand"
        variant="outline"
        size="sm"
        onClick={onLimpiar}
      >
        Limpiar filtros
      </Button>
    </Tarjeta>
  );
}
