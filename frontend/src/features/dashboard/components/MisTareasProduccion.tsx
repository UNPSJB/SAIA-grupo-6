import { Badge, Box, Flex, Link, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { LuArrowRight, LuCircleCheck, LuFactory } from "react-icons/lu";
import type { TareaProduccionHoy } from "../types/paneles";
import { TEMAS_AREA } from "../types/temasArea";
import { EncabezadoTarjeta, TarjetaInicio } from "./TarjetaHoy";

const tema = TEMAS_AREA.produccion;
/** Las que entran sin estirar la tarjeta; el resto se ve en Lotes. */
const MAXIMO = 6;

/**
 * Inicio de quien opera: las tareas pendientes de los lotes en proceso que
 * tiene asignadas y, después, las que no tienen a nadie asignado (las puede
 * hacer cualquiera). Cada fila lleva a la ficha del lote, donde se registra.
 */
export function MisTareasProduccion({ tareas }: { tareas: TareaProduccionHoy[] }) {
  const propias = tareas.filter((t) => t.asignada).length;
  // Si todas son del mismo tipo, la bajada ya lo dice: el badge en cada fila
  // solo distingue cuando hay tareas propias y sin asignar mezcladas.
  const mostrarBadge = propias > 0 && propias < tareas.length;
  return (
    <TarjetaInicio h="auto">
      <EncabezadoTarjeta
        icono={LuFactory}
        fondoIcono={tema.fondo[1]}
        colorIcono={tema.acento}
        titulo="Mis tareas de producción"
        bajada={
          tareas.length === 0
            ? "No hay lotes en proceso con tareas para vos"
            : `${propias} ${propias === 1 ? "asignada" : "asignadas"} a vos · ${tareas.length - propias} sin asignar`
        }
      />
      {tareas.length === 0 ? (
        <Flex align="center" gap="2" color="fg.muted" fontSize="sm">
          <LuCircleCheck aria-hidden /> Nada pendiente en producción.
        </Flex>
      ) : (
        <>
          <Stack gap="0" as="ul" listStyleType="none" m="0" p="0">
            {tareas.slice(0, MAXIMO).map((t) => (
              <Box
                as="li"
                key={`${t.lote_id}-${t.orden}`}
                borderTopWidth="1px"
                borderColor="border.subtle"
                _first={{ borderTopWidth: "0" }}
              >
                <Link
                  asChild
                  display="flex"
                  alignItems="center"
                  gap="3"
                  px="2"
                  mx="-2"
                  py="1.5"
                  rounded="md"
                  fontSize="sm"
                  textDecoration="none"
                  _hover={{ bg: "bg.subtle", textDecoration: "none" }}
                >
                  <RouterLink to={`/lotes/${t.lote_id}`}>
                    <Box flex="1" minW="0">
                      <Text lineClamp={{ base: 2, md: 1 }} color={t.habilitada ? "fg" : "fg.muted"}>
                        {t.orden}. {t.descripcion}
                      </Text>
                      <Text lineClamp={{ base: 2, md: 1 }} fontSize="xs" color="fg.muted">
                        Lote {t.numero_lote} · {t.producto}
                      </Text>
                    </Box>
                    {!t.habilitada && (
                      <Text
                        flexShrink={0}
                        fontSize="xs"
                        color="fg.muted"
                        title="Primero se completa la etapa anterior del lote"
                      >
                        En espera
                      </Text>
                    )}
                    {mostrarBadge && (
                      <Badge flexShrink={0} colorPalette={t.asignada ? "orange" : "gray"} variant="subtle">
                        {t.asignada ? "Tuya" : "Sin asignar"}
                      </Badge>
                    )}
                  </RouterLink>
                </Link>
              </Box>
            ))}
          </Stack>
          <Link asChild fontSize="sm" color={tema.acento} fontWeight="medium" mt="1.5" display="inline-flex" gap="1" alignItems="center">
            <RouterLink to="/lotes">
              {tareas.length > MAXIMO ? `Ver las ${tareas.length} en Lotes` : "Ir a Lotes"}
              <LuArrowRight size={14} aria-hidden />
            </RouterLink>
          </Link>
        </>
      )}
    </TarjetaInicio>
  );
}
