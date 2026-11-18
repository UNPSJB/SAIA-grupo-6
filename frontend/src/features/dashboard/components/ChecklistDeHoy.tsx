import { useLayoutEffect, useRef, useState } from "react";
import { Badge, Box, Flex, Link, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { LuArrowRight, LuCircleCheck, LuSprayCan } from "react-icons/lu";
import { formatoCantidad } from "../../../common/utils/numeros";
import type { ChecklistHoy, FilaAtencion } from "../types/paneles";
import { TEMAS_AREA } from "../types/temasArea";
import { AnilloProgreso } from "./AnilloProgreso";
import { EncabezadoTarjeta, TarjetaInicio } from "./TarjetaHoy";

const tema = TEMAS_AREA.limpieza;
/** Ámbar claro de las advertencias de los paneles (fondo, borde, texto). */
const AMBAR = { fondo: "#fbf1dc", borde: "#ecd3a0", texto: "#8a5a12" } as const;

/** Barra fina de avance (hechas sobre el total), para cada momento del día. */
function BarraAvance({ cumplen, total }: { cumplen: number; total: number }) {
  const porcentaje = total === 0 ? 0 : (cumplen / total) * 100;
  return (
    <Box h="1.5" rounded="full" bg="blackAlpha.100" overflow="hidden" aria-hidden>
      <Box h="full" w={`${porcentaje}%`} rounded="full" bg={cumplen === total ? "green.500" : tema.acento} />
    </Box>
  );
}

/** Alto de una fila de pendientes (dos renglones), si todavía no se pudo medir. */
const ALTO_FILA = 48;

/**
 * Cuántas filas de una lista entran enteras en su contenedor. Mide el alto
 * disponible (y el de una fila ya dibujada) cada vez que cambia el tamaño, así
 * en una pantalla baja se muestran menos filas en vez de aparecer un scroll.
 * Si el contenedor crece con su contenido (celular), entran todas.
 */
function useFilasQueEntran(cantidad: number) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [visibles, setVisibles] = useState(cantidad);

  useLayoutEffect(() => {
    const caja = contenedor.current;
    if (!caja) return;
    const medir = () => {
      const fila = caja.querySelector("li");
      const alto = fila?.getBoundingClientRect().height || ALTO_FILA;
      setVisibles(Math.min(cantidad, Math.max(1, Math.floor(caja.clientHeight / alto))));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    return () => observador.disconnect();
  }, [cantidad]);

  return { contenedor, visibles };
}

/**
 * Una tarea pendiente: el nombre y, debajo, el plan de limpieza al que
 * pertenece (en una segunda línea, porque los nombres de plan son largos y
 * en una etiqueta quedaban cortados); el operador a la derecha. El `detalle`
 * llega como "Plan · Operador" desde el backend.
 */
function FilaPendiente({ tarea }: { tarea: FilaAtencion }) {
  const [plan, operador] = (tarea.detalle ?? "").split(" · ");
  return (
    <Flex
      as="li"
      align="center"
      gap="3"
      px="2"
      mx="-2"
      py="1.5"
      rounded="md"
      borderTopWidth="1px"
      borderColor="border.subtle"
      _first={{ borderTopWidth: "0" }}
      _hover={{ bg: "gray.50" }}
      fontSize="sm"
    >
      <Box flex="1" minW="0">
        <Text truncate color="fg" title={tarea.titulo}>
          {tarea.titulo}
        </Text>
        {plan ? (
          <Text truncate fontSize="xs" color="fg.muted" title={plan}>
            {plan}
          </Text>
        ) : null}
      </Box>
      {operador ? (
        <Text color="fg.muted" fontSize="xs" flexShrink={0} w="28" textAlign="right" truncate title={operador}>
          {operador}
        </Text>
      ) : null}
    </Flex>
  );
}

/**
 * El checklist de limpieza de hoy: el anillo con el avance, el avance por
 * momento del día y las tareas que faltan, con enlace al checklist.
 *
 * Durante el día el porcentaje sube de a poco, así que no se pinta de ámbar
 * por estar debajo de la meta: la meta se muestra como referencia y el verde
 * aparece cuando se completa todo.
 */
export function ChecklistDeHoy({ checklist }: { checklist: ChecklistHoy }) {
  const { total, completadas, porcentaje, meta, por_momento, pendientes, pendientes_total } = checklist;
  const completo = total > 0 && completadas === total;
  const color = completo ? "var(--chakra-colors-green-500)" : tema.acento;
  const { contenedor, visibles } = useFilasQueEntran(pendientes.length);

  return (
    <TarjetaInicio>
      <EncabezadoTarjeta
        icono={LuSprayCan}
        fondoIcono={tema.fondo[1]}
        colorIcono={tema.acento}
        titulo="Checklist de limpieza de hoy"
        bajada={total === 0 ? "Hoy no hay tareas programadas" : `Meta de cumplimiento: ${meta}%`}
      />

      {total === 0 ? (
        <Flex align="center" gap="2" color="fg.muted" fontSize="sm">
          <LuCircleCheck aria-hidden /> Sin tareas de limpieza para hoy.
        </Flex>
      ) : (
        <Stack gap={{ base: "5", lg: "4" }} flex={{ base: "none", lg: "1" }} minH="0">
          <Flex align="center" gap="5" flexShrink={0}>
            <Box w={{ base: "24", "2xl": "28" }} h={{ base: "24", "2xl": "28" }} flexShrink={0}>
              <AnilloProgreso porcentaje={porcentaje ?? 0} color={color}>
                <Text fontSize="2xl" fontWeight="extrabold" color="fg" lineHeight="1">
                  {formatoCantidad(Math.round(porcentaje ?? 0))}%
                </Text>
              </AnilloProgreso>
            </Box>
            <Stack gap="1" minW="0" align="flex-start">
              <Text fontSize="3xl" fontWeight="extrabold" lineHeight="1" color="fg" fontVariantNumeric="tabular-nums">
                {completadas}
                <Text as="span" fontSize="lg" fontWeight="semibold" color="fg.muted">
                  {" "}de {total}
                </Text>
              </Text>
              <Text fontSize="sm" color="fg.muted">
                tareas completadas
              </Text>
              {completo ? (
                <Badge mt="1.5" rounded="full" px="2.5" py="1" colorPalette="green" variant="subtle">
                  <LuCircleCheck aria-hidden /> Todo al día
                </Badge>
              ) : (
                <Box
                  as="span"
                  mt="1.5"
                  display="inline-flex"
                  rounded="full"
                  px="2.5"
                  py="1"
                  fontSize="xs"
                  fontWeight="medium"
                  bg={AMBAR.fondo}
                  color={AMBAR.texto}
                  borderWidth="1px"
                  borderColor={AMBAR.borde}
                >
                  Faltan {pendientes_total} {pendientes_total === 1 ? "tarea" : "tareas"}
                </Box>
              )}
            </Stack>
          </Flex>

          {por_momento.length > 0 ? (
            <Stack gap="2" flexShrink={0}>
              {por_momento.map((m) => (
                <Box key={m.clave}>
                  <Flex justify="space-between" fontSize="sm" mb="0.5">
                    <Text color="fg">{m.etiqueta}</Text>
                    <Text color="fg.muted" fontVariantNumeric="tabular-nums">
                      {m.cumplen} de {m.total}
                    </Text>
                  </Flex>
                  <BarraAvance cumplen={m.cumplen} total={m.total} />
                </Box>
              ))}
            </Stack>
          ) : null}

          {pendientes.length > 0 ? (
            <Flex direction="column" flex={{ base: "none", lg: "1" }} minH="0">
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="0.04em" mb="1" flexShrink={0}>
                Pendientes
              </Text>
              {/* Ocupa lo que queda de la tarjeta y muestra solo las filas que
                  entran enteras: en pantallas bajas, menos filas, sin scroll. */}
              <Box
                ref={contenedor}
                flex={{ base: "none", lg: "1" }}
                minH="0"
                overflow={{ base: "visible", lg: "hidden" }}
              >
                <Stack gap="0" as="ul" listStyleType="none" m="0" p="0">
                  {pendientes.slice(0, visibles).map((t) => (
                    <FilaPendiente key={t.clave} tarea={t} />
                  ))}
                </Stack>
              </Box>
              <Link asChild fontSize="sm" color={tema.acento} fontWeight="medium" mt="1.5" flexShrink={0} display="inline-flex" gap="1" alignItems="center">
                <RouterLink to="/checklist">
                  {pendientes_total > visibles
                    ? `Ver las ${pendientes_total} pendientes en el checklist`
                    : "Ir al checklist"}
                  <LuArrowRight size={14} aria-hidden />
                </RouterLink>
              </Link>
            </Flex>
          ) : null}
        </Stack>
      )}
    </TarjetaInicio>
  );
}
