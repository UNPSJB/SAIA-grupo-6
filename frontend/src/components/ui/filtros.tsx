import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  LuArrowDown,
  LuArrowUp,
  LuArrowUpDown,
  LuChevronDown,
  LuSlidersHorizontal,
  LuX,
} from "react-icons/lu";

import { useEsCelular } from "../../common/hooks/useEsCelular";
import type { OrdenTabla } from "../../common/hooks/useOrdenTabla";
import {
  BotonAgregar,
  EncabezadoOscuro,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  Tarjeta,
  ToggleInactivos,
  type AnchoColumna,
} from "./patrones";

/** Los elementos sueltos de un nodo: abre los fragmentos y descarta lo vacío. */
function elementosDe(nodo: ReactNode): ReactNode[] {
  return Children.toArray(nodo).flatMap((hijo) =>
    isValidElement<{ children?: ReactNode }>(hijo) && hijo.type === Fragment
      ? elementosDe(hijo.props.children)
      : [hijo],
  );
}

/**
 * Cuántos filtros están puestos, mirando los controles de la barra. Es lo que
 * se lee en "Filtros (2)" cuando están plegados. El orden no cuenta: el
 * listado siempre está ordenado por algo.
 */
function contarActivos(nodo: ReactNode): number {
  return elementosDe(nodo).reduce<number>((suma, hijo) => {
    if (!isValidElement(hijo)) return suma;
    const { type, props } = hijo as ReactElement<{
      valor?: string;
      value?: string | number;
      checked?: boolean;
      children?: ReactNode;
    }>;
    if (type === FiltroSelect) return suma + (props.valor ? 1 : 0);
    if (type === FormInput) return suma + (props.value ? 1 : 0);
    if (type === ToggleInactivos) return suma + (props.checked ? 1 : 0);
    return suma + contarActivos(props.children);
  }, 0);
}

/**
 * Filtros plegados del celular: a la vista quedan la búsqueda, el botón
 * "Filtros" y, si hay, la acción principal (`fijo`). El resto se abre debajo.
 *
 * Con todo desplegado, un campo por renglón, la primera fila del listado
 * empezaba en la segunda pantalla. En escritorio no se usa.
 */
export function FiltrosPlegables({
  busqueda,
  fijo,
  activos = 0,
  etiqueta = "Filtros",
  children,
}: {
  busqueda?: ReactNode;
  /** Lo que queda siempre a la vista, debajo de la búsqueda. */
  fijo?: ReactNode;
  activos?: number;
  etiqueta?: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();

  return (
    <Stack gap="3">
      <HStack gap="2">
        {busqueda ? (
          <Box flex="1" minW="0">
            {busqueda}
          </Box>
        ) : null}
        <Button
          type="button"
          variant="outline"
          colorPalette={activos > 0 ? "brand" : "neutral"}
          flex={busqueda ? "none" : "1"}
          h="10"
          px="3"
          gap="1.5"
          aria-expanded={abierto}
          aria-controls={abierto ? idPanel : undefined}
          onClick={() => setAbierto((a) => !a)}
        >
          <LuSlidersHorizontal size={16} aria-hidden />
          {etiqueta}
          {activos > 0 ? ` (${activos})` : ""}
          <Box as="span" display="inline-flex" transform={abierto ? "rotate(180deg)" : undefined}>
            <LuChevronDown size={14} aria-hidden />
          </Box>
        </Button>
      </HStack>
      {fijo}
      {abierto && (
        <Stack
          id={idPanel}
          gap="4"
          pt="3"
          borderTopWidth="1px"
          borderColor="border.subtle"
          // Un campo por renglón, a todo el ancho.
          css={{ "& > *": { minWidth: 0, maxWidth: "100%" } }}
        >
          {children}
          <Button type="button" variant="subtle" colorPalette="brand" onClick={() => setAbierto(false)}>
            Cerrar {etiqueta.toLowerCase()}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

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
 *
 * En el celular se pliega (ver `FiltrosPlegables`): quedan la búsqueda, el alta
 * y el botón que abre los filtros y las demás herramientas.
 */
export function BarraFiltros({
  busqueda,
  filtros,
  herramientas,
  activos,
}: {
  busqueda?: ReactNode;
  filtros?: ReactNode;
  herramientas?: ReactNode;
  /** Filtros puestos, si la barra no los puede contar sola (controles propios). */
  activos?: number;
}) {
  const esCelular = useEsCelular();

  if (esCelular) {
    const piezas = elementosDe(herramientas);
    const esAlta = (pieza: ReactNode) => isValidElement(pieza) && pieza.type === BotonAgregar;
    const altas = piezas.filter(esAlta);
    const resto = piezas.filter((pieza) => !esAlta(pieza));
    const controles = elementosDe(filtros);
    const alta =
      altas.length > 0 ? (
        <HStack gap="2" css={{ "& > *": { flex: "1" } }}>
          {altas}
        </HStack>
      ) : null;

    return (
      <Tarjeta p="3" mb="4" overflow="visible">
        {/* Un solo control además de la búsqueda: no hay qué plegar. */}
        {controles.length === 0 && resto.length <= 1 ? (
          <Stack gap="3">
            {busqueda}
            {alta}
            {resto}
          </Stack>
        ) : (
          <FiltrosPlegables
            busqueda={busqueda}
            fijo={alta}
            activos={activos ?? contarActivos(filtros) + contarActivos(resto)}
            etiqueta={controles.length > 0 ? "Filtros" : "Opciones"}
          >
            {controles}
            {resto}
          </FiltrosPlegables>
        )}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta p="4" mb="4" overflow="visible">
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
    <Box minW={{ base: "0", md: "250px" }}>
      {/* En el celular alcanza con el texto de ayuda: va al lado del botón. */}
      <Box hideBelow="md">
        <LabelFiltro>Búsqueda</LabelFiltro>
      </Box>
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
          h={{ base: "9", md: "7" }}
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
            minW={{ base: "8", md: "5" }}
            w={{ base: "8", md: "5" }}
            h={{ base: "8", md: "5" }}
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
