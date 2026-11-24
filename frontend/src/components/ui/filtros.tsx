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

/**
 * Barra de un listado. Mismo orden en todas las pantallas:
 *
 *   [búsqueda] [filtro] [filtro] ...            [herramientas]
 *
 * Búsqueda y filtros van juntos a la izquierda (se leen como una sola
 * consulta). A la derecha, lo que actúa sobre el listado entero: exportar,
 * "Ver dados de baja", "Actualizar" y, dentro de una pestaña, el alta.
 *
 * Antes la búsqueda quedaba a la izquierda y los filtros empujados a la
 * derecha, con un hueco en el medio, y cada página ubicaba exportar y el
 * interruptor de bajas en un lugar distinto.
 */
export function BarraFiltros({
  busqueda,
  filtros,
  herramientas,
}: {
  busqueda?: ReactNode;
  filtros?: ReactNode;
  herramientas?: ReactNode;
}) {
  return (
    <Tarjeta p="4" mb="4" overflow="visible" className="barra-filtros">
      <HStack gap="4" flexWrap="wrap" align="flex-end" justify="space-between">
        <HStack gap="4" flexWrap="wrap" align="flex-end" flex="1" minW="0">
          {busqueda ? (
            <Box flex="1" minW="250px" maxW="420px">
              {busqueda}
            </Box>
          ) : null}
          {filtros}
        </HStack>
        {herramientas ? (
          <HStack gap="3" flexWrap="wrap" align="center" minH="10">
            {herramientas}
          </HStack>
        ) : null}
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

/**
 * Filtros aplicados, en la franja entre la barra de filtros y la tabla: un
 * chip "Campo: Valor ×" por cada criterio activo y, al final, "Limpiar
 * filtros". Sin filtros no se renderiza nada, así la barra y la tabla quedan
 * a la distancia de siempre. La × vuelve ese control a su valor inicial.
 */
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
      align="center"
      mt="-1"
      mb="4"
      role="group"
      aria-label="Filtros aplicados"
    >
      {filtros.map((filtro) => (
        <Box
          key={filtro.clave}
          as="span"
          display="inline-flex"
          alignItems="center"
          gap="1"
          h="7"
          pl="3"
          pr="1"
          rounded="full"
          /* Misma familia que la barra superior (`brand.700`). */
          bg="brand.50"
          borderWidth="1px"
          borderColor="brand.200"
          color="brand.700"
          fontSize="13px"
          fontWeight="500"
          lineHeight="1"
          maxW="100%"
        >
          <Text as="span" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis" title={`${filtro.etiqueta}: ${filtro.valor}`}>
            {filtro.etiqueta}: {filtro.valor}
          </Text>
          <IconButton
            aria-label={`Quitar filtro ${filtro.etiqueta}`}
            title="Quitar filtro"
            minW="5"
            w="5"
            h="5"
            rounded="full"
            variant="ghost"
            color="brand.700"
            _hover={{ bg: "brand.100" }}
            onClick={filtro.onQuitar}
          >
            <LuX size={12} aria-hidden />
          </IconButton>
        </Box>
      ))}

      <Button
        type="button"
        size="xs"
        variant="plain"
        // `fg.muted` y no `tabla.textoSecundario`: a 12px sobre el aguamarina
        // de la franja de chips, el gris pizarra quedaba en 4.3:1.
        color="fg.muted"
        fontWeight="medium"
        px="1"
        _hover={{ color: "brand.700", textDecoration: "underline" }}
        onClick={onLimpiarTodo}
      >
        Limpiar filtros
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
  numero = false,
}: {
  children: string;
  columna: C;
  orden: OrdenTabla<C, string>;
  ancho?: AnchoColumna;
  center?: boolean;
  /** Columna de cantidades: a la derecha, como sus celdas. */
  numero?: boolean;
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
      numero={numero}
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
