import type { ReactNode } from "react";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { LuCalendarClock, LuChevronDown, LuCog, LuLock } from "react-icons/lu";
import { EtiquetaEstado, type TonoEstado } from "../../../../components/ui/patrones";
import { iniciales, responsable, type EstadoGrupo, type GrupoPlan } from "./modelo";

/** Color de la franja lateral, de la mini barra y etiqueta de cada estado. */
const ESTILO: Record<EstadoGrupo, { franja: string; barra: string; tono: TonoEstado; texto: string }> = {
  completo: { franja: "green.solid", barra: "green.solid", tono: "ok", texto: "Completado" },
  en_progreso: { franja: "cyan.solid", barra: "cyan.solid", tono: "info", texto: "En progreso" },
  demorado: { franja: "orange.solid", barra: "orange.solid", tono: "alerta", texto: "Con demora" },
  pendiente: { franja: "gray.400", barra: "teal.solid", tono: "neutro", texto: "Pendiente" },
};

/**
 * Acordeón de un plan/equipo. Sin abrirlo ya dice todo lo que se busca de un
 * vistazo: estado (franja lateral de color + etiqueta), avance ("2/5" con mini
 * barra) y quiénes tienen tareas ahí (iniciales). Abierto, gana borde teal y
 * una sombra suave para separarse de los cerrados.
 */
export function GrupoChecklist({
  grupo,
  estado,
  abierto,
  onAlternar,
  visibles,
  children,
}: {
  grupo: GrupoPlan;
  estado: EstadoGrupo;
  abierto: boolean;
  onAlternar: () => void;
  /** Tareas del grupo que pasan los filtros (si es distinto del total, se aclara). */
  visibles: number;
  children: ReactNode;
}) {
  const estilo = ESTILO[estado];
  const total = grupo.tareas.length;
  const hechas = grupo.tareas.filter((t) => t.completado).length;
  const porcentaje = total > 0 ? Math.round((hechas / total) * 100) : 0;
  const operadores = [...new Set(grupo.tareas.map(responsable).filter((n): n is string => Boolean(n)))];
  const cerrado = grupo.tareas[0]?.checklist_estado === "cerrado";
  const vistaPrevia = grupo.tareas[0]?.registro_id === 0;
  const idPanel = `grupo-${grupo.key}`;

  return (
    <Box
      mb="3"
      bg="bg.panel"
      rounded="xl"
      borderWidth="1px"
      borderColor={abierto ? "teal.muted" : "border.subtle"}
      boxShadow={abierto ? "md" : "xs"}
      overflow="hidden"
      position="relative"
      transition="border-color 0.2s ease, box-shadow 0.2s ease"
    >
      {/* Franja de estado */}
      <Box position="absolute" left="0" top="0" bottom="0" w="1.5" bg={estilo.franja} aria-hidden />

      <Button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierto}
        aria-controls={idPanel}
        variant="ghost"
        w="100%"
        h="auto"
        minH="16"
        ps="6"
        pe="4"
        py="3.5"
        rounded="none"
        textAlign="left"
        justifyContent="flex-start"
        color="fg"
        bg={abierto ? "bg.subtle" : "transparent"}
        _hover={{ bg: "bg.subtle" }}
        whiteSpace="normal"
      >
        <Stack
          direction={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "center" }}
          justify="space-between"
          gap={{ base: "3", md: "5" }}
          w="100%"
        >
          <HStack gap="3" minW="0" flex="1" align="center">
            <Box
              color="fg.muted"
              transform={abierto ? "rotate(0deg)" : "rotate(-90deg)"}
              transition="transform 0.2s ease"
              display="inline-flex"
              flexShrink={0}
              aria-hidden
            >
              <LuChevronDown size={20} />
            </Box>
            <Box minW="0">
              <Text fontSize="md" fontWeight="semibold" color="fg" lineHeight="1.3">
                {grupo.planNombre}
              </Text>
              <HStack gap="1.5" mt="1" color="fg.muted" fontSize="sm">
                <LuCog size={14} aria-hidden />
                <Text as="span" lineClamp={1}>
                  {grupo.equipoNombre}
                </Text>
              </HStack>
            </Box>
          </HStack>

          <HStack gap="4" flexShrink={0} flexWrap="wrap" ps={{ base: "8", md: "0" }}>
            {operadores.length > 0 && <Iniciales nombres={operadores} />}

            <HStack gap="2" minW="120px">
              <Box w="20" h="1.5" bg="bg.muted" rounded="full" overflow="hidden" aria-hidden>
                <Box h="full" w={`${porcentaje}%`} bg={estilo.barra} rounded="full" transition="width 0.4s ease" />
              </Box>
              <Text
                fontSize="sm"
                fontWeight="bold"
                fontVariantNumeric="tabular-nums"
                color="fg"
                aria-label={`${hechas} de ${total} tareas hechas`}
              >
                {hechas}/{total}
              </Text>
            </HStack>

            {cerrado ? (
              <EtiquetaEstado tono="neutro">
                <LuLock size={12} aria-hidden /> Cerrado
              </EtiquetaEstado>
            ) : vistaPrevia ? (
              <EtiquetaEstado tono="neutro">
                <LuCalendarClock size={12} aria-hidden /> Vista previa
              </EtiquetaEstado>
            ) : (
              <EtiquetaEstado tono={estilo.tono}>{estilo.texto}</EtiquetaEstado>
            )}
          </HStack>
        </Stack>
      </Button>

      {visibles < total && abierto && (
        <Text ps="6" pe="4" pb="2" pt="0" fontSize="xs" color="fg.muted" bg="bg.subtle">
          Mostrando {visibles} de {total} tareas de este plan por los filtros.
        </Text>
      )}

      {/*
        Despliegue animado con `grid-template-rows: 0fr → 1fr` (la altura se
        anima sin medirla en JavaScript); `inert` evita que el teclado entre a
        los controles de un grupo plegado.
      */}
      <Box
        id={idPanel}
        display="grid"
        gridTemplateRows={abierto ? "1fr" : "0fr"}
        transitionProperty="grid-template-rows"
        transitionDuration="moderate"
        transitionTimingFunction="ease-in-out"
        inert={!abierto}
      >
        <Box overflow="hidden">
          <Stack gap="3" ps={{ base: "4", md: "6" }} pe={{ base: "3", md: "4" }} py="4" borderTopWidth="1px" borderColor="border.subtle">
            {children}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

/** Iniciales superpuestas de los operadores del plan (hasta 3, y "+N"). */
function Iniciales({ nombres }: { nombres: string[] }) {
  const visibles = nombres.slice(0, 3);
  const resto = nombres.length - visibles.length;
  return (
    <HStack gap="0" title={nombres.join(", ")} aria-label={`Operadores: ${nombres.join(", ")}`}>
      {visibles.map((n, i) => (
        <Box
          key={n}
          w="8"
          h="8"
          ms={i === 0 ? "0" : "-2"}
          rounded="full"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xs"
          fontWeight="bold"
          bg="teal.subtle"
          color="teal.fg"
          borderWidth="2px"
          borderColor="bg.panel"
          aria-hidden
        >
          {iniciales(n)}
        </Box>
      ))}
      {resto > 0 && (
        <Box
          w="8"
          h="8"
          ms="-2"
          rounded="full"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xs"
          fontWeight="bold"
          bg="bg.muted"
          color="fg.muted"
          borderWidth="2px"
          borderColor="bg.panel"
          aria-hidden
        >
          +{resto}
        </Box>
      )}
    </HStack>
  );
}
