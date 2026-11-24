import { Box, Button, HStack, Stack, Switch, Text } from "@chakra-ui/react";
import { LuChevronsDownUp, LuChevronsUpDown, LuSearch, LuX } from "react-icons/lu";
import {
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { FiltrosPlegables } from "../../../../components/ui/filtros";
import { useEsCelular } from "../../../../common/hooks/useEsCelular";
import { TIPOS_TAREA } from "../../../planLimpieza/types/planLimpieza";
import {
  FILTROS_INICIALES,
  SIN_ASIGNAR,
  type FiltroEstado,
  type FiltrosChecklist,
} from "./modelo";

/**
 * Cabecera operativa del checklist: en una sola tarjeta, la fecha y el avance
 * del día arriba, y debajo la barra de filtros rápidos para que cada operador
 * encuentre sus tareas sin abrir equipo por equipo. Antes eran dos tarjetas
 * apiladas (fecha sola y avance solo) que ocupaban media pantalla.
 */
export function CabeceraChecklist({
  fecha,
  onFecha,
  hechas,
  total,
  visibles,
  filtros,
  onFiltros,
  operadores,
  hayFiltros,
  mostrarFiltroOperador,
  mostrarMisTareas,
  todoAbierto,
  onAlternarTodo,
  mostrarFiltros,
}: {
  fecha: string;
  onFecha: (fecha: string) => void;
  hechas: number;
  total: number;
  /** Tareas que pasan los filtros (para "Mostrando X de Y"). */
  visibles: number;
  filtros: FiltrosChecklist;
  onFiltros: (cambio: Partial<FiltrosChecklist>) => void;
  operadores: string[];
  hayFiltros: boolean;
  /**
   * Para quien administra. A un operador el backend ya le devuelve solo sus
   * tareas (y las sin asignar): el filtro tendría una sola opción.
   */
  mostrarFiltroOperador: boolean;
  /** Solo si quien administra tiene tareas propias ese día. */
  mostrarMisTareas: boolean;
  todoAbierto: boolean;
  onAlternarTodo: () => void;
  /** Sin tareas no hay nada que filtrar: solo la fecha. */
  mostrarFiltros: boolean;
}) {
  const porcentaje = total > 0 ? Math.round((hechas / total) * 100) : 0;
  const completo = total > 0 && hechas === total;
  const esCelular = useEsCelular();
  const activos =
    [filtros.operador, filtros.etapa, filtros.misTareas].filter(Boolean).length +
    (filtros.estado !== FILTROS_INICIALES.estado ? 1 : 0);

  const campoBusqueda = (
    <Box flex="1" minW={{ base: "auto", lg: "220px" }}>
      <Box hideBelow="md">
        <LabelFiltro>Buscar</LabelFiltro>
      </Box>
      <Box position="relative">
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color="fg.muted"
          pointerEvents="none"
          display="inline-flex"
          // Por encima del fondo del input, que va después.
          zIndex="1"
          aria-hidden
        >
          <LuSearch size={16} />
        </Box>
        <FormInput
          type="search"
          value={filtros.texto}
          onChange={(e) => onFiltros({ texto: e.target.value })}
          placeholder="Equipo, plan o tarea..."
          aria-label="Buscar por equipo, plan o tarea"
          h={{ base: "10", md: "11" }}
          ps="9"
        />
      </Box>
    </Box>
  );

  const filtrosRapidos = (
    <>
      {mostrarFiltroOperador && (
        <Box minW={{ base: "auto", lg: "190px" }}>
          <LabelFiltro>Operador</LabelFiltro>
          <FormNativeSelect
            value={filtros.operador}
            onChange={(e) => onFiltros({ operador: e.target.value, misTareas: false })}
            aria-label="Filtrar por operador"
          >
            <option value="">Todos los operadores</option>
            {operadores.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
            <option value={SIN_ASIGNAR}>Sin asignar</option>
          </FormNativeSelect>
        </Box>
      )}

      <Box minW={{ base: "auto", lg: "170px" }}>
        <LabelFiltro>Etapa</LabelFiltro>
        <FormNativeSelect
          value={filtros.etapa}
          onChange={(e) => onFiltros({ etapa: e.target.value })}
          aria-label="Filtrar por etapa"
        >
          <option value="">Todas las etapas</option>
          {TIPOS_TAREA.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </FormNativeSelect>
      </Box>

      <Box>
        <LabelFiltro>Estado</LabelFiltro>
        <SelectorEstado valor={filtros.estado} onCambio={(estado) => onFiltros({ estado })} />
      </Box>
    </>
  );

  const soloMisTareas = mostrarMisTareas && (
  <Switch.Root
    checked={filtros.misTareas}
    onCheckedChange={(e) => onFiltros({ misTareas: e.checked, operador: "" })}
    colorPalette="teal"
    size="lg"
  >
    <Switch.HiddenInput />
    {/* Apagado, la pista gris se distingue del fondo de la barra. */}
    <Switch.Control bg="border.emphasized" _checked={{ bg: "teal.solid" }} />
    <Switch.Label fontSize="sm" fontWeight="medium" color="fg">
      Solo mis tareas
    </Switch.Label>
  </Switch.Root>
);

  return (
    <Tarjeta mb="4" overflow="visible">
      {/* Fila 1: fecha + avance del día */}
      <Stack
        direction={{ base: "column", md: "row" }}
        align={{ base: "stretch", md: "center" }}
        gap={{ base: "4", md: "6" }}
        p="4"
      >
        <Box flexShrink={0}>
          <LabelFiltro>Fecha</LabelFiltro>
          <FormInput
            type="date"
            value={fecha}
            onChange={(e) => onFecha(e.target.value)}
            w={{ base: "100%", md: "180px" }}
            h="11"
            aria-label="Fecha del checklist"
          />
        </Box>

        {total > 0 && (
          <Box flex="1" minW="0">
            <HStack justify="space-between" mb="2" gap="3" flexWrap="wrap">
              <Text fontSize="sm" fontWeight="semibold" color="fg">
                Avance del día
              </Text>
              <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                <Text as="span" fontWeight="bold" color="fg">
                  {hechas} de {total}
                </Text>{" "}
                tareas ·{" "}
                <Text as="span" fontWeight="bold" color={completo ? "green.fg" : "teal.fg"}>
                  {porcentaje}%
                </Text>
              </Text>
            </HStack>
            <Box
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={hechas}
              aria-label={`${hechas} de ${total} tareas del día completadas`}
              h="2.5"
              bg="bg.muted"
              rounded="full"
              overflow="hidden"
            >
              <Box
                h="full"
                w={`${porcentaje}%`}
                rounded="full"
                bg={completo ? "green.solid" : "teal.solid"}
                transition="width 0.4s ease"
              />
            </Box>
          </Box>
        )}
      </Stack>

      {/* Fila 2: filtros rápidos */}
      {mostrarFiltros && (
        <Box px="4" py="3" borderTopWidth="1px" borderColor="border.subtle" bg="bg.subtle" roundedBottom="lg">
          {esCelular ? (
            <FiltrosPlegables busqueda={campoBusqueda} activos={activos}>
              {filtrosRapidos}
              {soloMisTareas}
            </FiltrosPlegables>
          ) : (
            <Stack direction={{ base: "column", lg: "row" }} align={{ base: "stretch", lg: "flex-end" }} gap="3">
              {campoBusqueda}
              {filtrosRapidos}
            </Stack>
          )}

          <HStack justify="space-between" mt="3" gap="3" flexWrap="wrap">
            <HStack gap="4" flexWrap="wrap">
              {!esCelular && soloMisTareas}
              {hayFiltros && (
                <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums" aria-live="polite">
                  Mostrando <b>{visibles}</b> de {total} tareas
                </Text>
              )}
            </HStack>
            <HStack gap="2">
              {hayFiltros && (
                <Button size="sm" h="10" variant="ghost" colorPalette="gray" onClick={() => onFiltros(FILTROS_INICIALES)}>
                  <LuX aria-hidden />
                  Limpiar filtros
                </Button>
              )}
              <Button size="sm" h="10" variant="outline" colorPalette="gray" onClick={onAlternarTodo}>
                {todoAbierto ? <LuChevronsDownUp aria-hidden /> : <LuChevronsUpDown aria-hidden />}
                {todoAbierto ? "Colapsar todo" : "Expandir todo"}
              </Button>
            </HStack>
          </HStack>
        </Box>
      )}
    </Tarjeta>
  );
}

const OPCIONES_ESTADO: { valor: FiltroEstado; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "pendientes", etiqueta: "Pendientes" },
  { valor: "completadas", etiqueta: "Completadas" },
];

/** Control segmentado de estado: tres botones de 44px, uno activo. */
function SelectorEstado({ valor, onCambio }: { valor: FiltroEstado; onCambio: (v: FiltroEstado) => void }) {
  return (
    <HStack
      role="radiogroup"
      aria-label="Filtrar por estado"
      gap="1"
      p="1"
      h="11"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      rounded="lg"
    >
      {OPCIONES_ESTADO.map((o) => {
        const activa = o.valor === valor;
        return (
          <Button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            size="sm"
            h="full"
            px="3"
            rounded="md"
            fontWeight={activa ? "semibold" : "medium"}
            bg={activa ? "teal.solid" : "transparent"}
            color={activa ? "teal.contrast" : "fg.muted"}
            _hover={activa ? undefined : { bg: "bg.muted", color: "fg" }}
            transition="background-color 0.15s ease, color 0.15s ease"
            onClick={() => onCambio(o.valor)}
          >
            {o.etiqueta}
          </Button>
        );
      })}
    </HStack>
  );
}
