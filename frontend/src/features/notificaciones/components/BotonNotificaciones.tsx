import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Popover,
  Portal,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { LuBell, LuCircleCheck, LuClock, LuTriangleAlert } from "react-icons/lu";
import { Tooltip } from "../../../components/ui/tooltip";
import { formatoFechaOCorta } from "../../../common/utils/fechas";
import { useNotificaciones } from "../hooks/useNotificaciones";
import { escucharCambioNotificaciones } from "../eventoNotificaciones";
import { nivelLabel, type Notificacion } from "../types/notificacion";

/** Cuántas alertas se listan en el desplegable. El resto se ve en la página. */
const MAX_VISIBLES = 6;

/**
 * A dónde lleva cada alerta. Es la misma regla que `handleResolver` en
 * `NotificacionesPage`: el recambio de elementos de limpieza y el cambio de
 * fecha de vencimiento se resuelven EN la página de notificaciones; el resto
 * (calibración, mantenimiento) lleva a su propio destino.
 */
function destinoDe(notificacion: Notificacion): string {
  if (
    notificacion.tipo === "ELEMENTO_LIMPIEZA" ||
    notificacion.tipo === "VENCIMIENTO_PERSONAL"
  ) {
    return "/notificaciones";
  }
  return notificacion.link_destino || "/notificaciones";
}

interface BotonNotificacionesProps {
  /**
   * Marca la campana como seleccionada cuando la vista actual es la de
   * notificaciones: mismo lenguaje que el `NavItem` activo del menú.
   */
  activa?: boolean;
}

export function BotonNotificaciones({ activa = false }: BotonNotificacionesProps) {
  const navigate = useNavigate();
  const { notificaciones, cantidad, loading, error, recargar } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => escucharCambioNotificaciones(() => void recargar()), [recargar]);

  // Lo más urgente primero: VENCIDO antes que PRÓXIMO A VENCER y, dentro de cada
  // nivel, la fecha más vieja arriba.
  const visibles = useMemo(
    () =>
      [...notificaciones]
        .sort((a, b) => {
          if (a.nivel !== b.nivel) return a.nivel === "VENCIDO" ? -1 : 1;
          return (a.fecha_referencia ?? "").localeCompare(b.fecha_referencia ?? "");
        })
        .slice(0, MAX_VISIBLES),
    [notificaciones],
  );

  // El número va en el nombre accesible: el badge visual queda `aria-hidden`
  // para que el lector no anuncie la cantidad dos veces.
  const etiqueta = cantidad > 0 ? `Notificaciones (${cantidad})` : "Notificaciones";

  const ir = (destino: string) => {
    setAbierto(false);
    navigate(destino);
  };

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(e) => {
        setAbierto(e.open);
        // Al abrir se pide de nuevo: así la lista nunca muestra algo ya resuelto.
        if (e.open) void recargar();
      }}
      positioning={{ placement: "bottom-end" }}
      lazyMount
      unmountOnExit
    >
      <Tooltip
        content={etiqueta}
        showArrow
        openDelay={300}
        positioning={{ placement: "bottom" }}
      >
        {/* El span evita que el tooltip y el popover compitan por el mismo trigger. */}
        <Box as="span" position="relative" display="inline-flex">
          <Popover.Trigger asChild>
            <IconButton
              aria-label={etiqueta}
              aria-current={activa ? "page" : undefined}
              variant="ghost"
              size="md"
              rounded="md"
              // Va sobre la barra superior teal.
              bg={activa ? "whiteAlpha.300" : "transparent"}
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              _focusVisible={{
                outline: "2px solid",
                outlineColor: "white",
                outlineOffset: "-2px",
              }}
            >
              <LuBell size={20} aria-hidden />
            </IconButton>
          </Popover.Trigger>

          {cantidad > 0 && (
            <Badge
              aria-hidden
              pointerEvents="none"
              variant="solid"
              bg="red.600"
              color="white"
              rounded="full"
              position="absolute"
              top="-4px"
              right="-4px"
              minW="5"
              h="5"
              px="1"
              justifyContent="center"
              fontSize="xs"
              lineHeight="1"
              fontWeight="bold"
              borderWidth="2px"
              borderStyle="solid"
              borderColor="white"
            >
              {cantidad > 99 ? "99+" : cantidad}
            </Badge>
          )}
        </Box>
      </Tooltip>

      <Portal>
        <Popover.Positioner>
          <Popover.Content w="380px" maxW="calc(100vw - 16px)" overflow="hidden">
            <Flex
              align="center"
              justify="space-between"
              px="4"
              py="3"
              borderBottomWidth="1px"
              borderColor="border.subtle"
            >
              <Popover.Title fontSize="sm" fontWeight="bold">
                Notificaciones
              </Popover.Title>
              {cantidad > 0 && (
                <Badge colorPalette="red" variant="subtle">
                  {cantidad}
                </Badge>
              )}
            </Flex>

            <Popover.Body p="0" maxH="380px" overflowY="auto">
              {loading && visibles.length === 0 ? (
                <Flex justify="center" py="8">
                  <Spinner size="sm" color="brand.500" />
                </Flex>
              ) : error && visibles.length === 0 ? (
                <Text px="4" py="6" fontSize="sm" color="fg.error" textAlign="center">
                  {error}
                </Text>
              ) : visibles.length === 0 ? (
                <Flex direction="column" align="center" gap="2" px="4" py="8">
                  <Box color="green.fg" aria-hidden>
                    <LuCircleCheck size={28} />
                  </Box>
                  <Text fontSize="sm" color="fg.muted">
                    No hay alertas pendientes
                  </Text>
                </Flex>
              ) : (
                <Box as="ul" listStyleType="none" m={0} p={0}>
                  {visibles.map((notificacion, i) => {
                    const vencida = notificacion.nivel === "VENCIDO";
                    const Icono = vencida ? LuTriangleAlert : LuClock;
                    return (
                      <Box
                        as="li"
                        key={notificacion.id_notificacion}
                        borderBottomWidth={i < visibles.length - 1 ? "1px" : "0"}
                        borderColor="border.subtle"
                      >
                        <Flex
                          as="button"
                          w="100%"
                          align="flex-start"
                          gap="3"
                          px="4"
                          py="3"
                          textAlign="left"
                          cursor="pointer"
                          _hover={{ bg: "brand.50" }}
                          _focusVisible={{
                            outline: "2px solid",
                            outlineColor: "brand.700",
                            outlineOffset: "-2px",
                          }}
                          onClick={() => ir(destinoDe(notificacion))}
                        >
                          <Box
                            mt="0.5"
                            flexShrink={0}
                            color={vencida ? "red.fg" : "orange.fg"}
                            aria-hidden
                          >
                            <Icono size={18} />
                          </Box>
                          <Box flex="1" minW={0}>
                            <Text fontSize="sm" fontWeight="bold" truncate>
                              {notificacion.titulo}
                            </Text>
                            <Text fontSize="xs" color="fg.muted" lineClamp="2">
                              {notificacion.mensaje}
                            </Text>
                            <Flex align="center" gap="2" mt="1">
                              <Badge
                                size="xs"
                                variant="subtle"
                                colorPalette={vencida ? "red" : "orange"}
                              >
                                {nivelLabel(notificacion.nivel)}
                              </Badge>
                              {notificacion.fecha_referencia && (
                                <Text fontSize="xs" color="fg.muted">
                                  {formatoFechaOCorta(notificacion.fecha_referencia)}
                                </Text>
                              )}
                            </Flex>
                          </Box>
                        </Flex>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Popover.Body>

            <Box borderTopWidth="1px" borderColor="border.subtle" p="2">
              <Button
                variant="ghost"
                size="sm"
                w="100%"
                color="brand.700"
                _hover={{ bg: "brand.50" }}
                onClick={() => ir("/notificaciones")}
              >
                {cantidad > MAX_VISIBLES
                  ? `Ver todas (${cantidad})`
                  : "Ver todas las notificaciones"}
              </Button>
            </Box>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
