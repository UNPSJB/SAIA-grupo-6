import {
  Badge,
  Box,
  Button,
  Stack,
  Text,
  chakra,
  type BoxProps,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { useNavigate } from "react-router-dom";
import { LuSprayCan, LuTriangleAlert, LuWrench } from "react-icons/lu";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import {
  PRIORIDAD_LABEL,
  type AlertaPanel,
  type IconoAlerta,
  type PrioridadAlerta,
} from "../types/dashboard";
import { TarjetaPanel } from "./TarjetaPanel";

interface TarjetaAlertasProps {
  /** Las más urgentes, ya ordenadas (vencimientos e incidentes abiertos). */
  alertas: AlertaPanel[];
  loading: boolean;
  error: string | null;
  /** Registra el recambio del elemento de limpieza de la fila. */
  onRecambio: (alerta: AlertaPanel) => void;
  /** `clave` de la fila cuyo recambio se está registrando, si hay alguna. */
  recambiando: string | null;
}

const ICONO: Record<IconoAlerta, IconType> = {
  limpieza: LuSprayCan,
  calibracion: LuWrench,
  incidente: LuTriangleAlert,
};

/**
 * Estilo del badge y del ícono de cada prioridad.
 *
 * Lo crítico va en rojo sólido, lo urgente en ámbar sólido, y lo pendiente y lo
 * programado en ámbar suave: el color baja de intensidad a medida que baja la
 * urgencia, así la lista se lee de arriba hacia abajo sin leer los textos.
 */
const ESTILO_PRIORIDAD: Record<
  PrioridadAlerta,
  {
    paleta: string;
    variante: "solid" | "subtle";
    fondoIcono: string;
    colorIcono: string;
  }
> = {
  critico: {
    paleta: "red",
    variante: "solid",
    fondoIcono: "red.50",
    colorIcono: "red.fg",
  },
  urgente: {
    paleta: "yellow",
    variante: "solid",
    fondoIcono: "yellow.50",
    colorIcono: "orange.fg",
  },
  pendiente: {
    paleta: "yellow",
    variante: "subtle",
    fondoIcono: "yellow.50",
    colorIcono: "orange.fg",
  },
  programada: {
    paleta: "yellow",
    variante: "subtle",
    fondoIcono: "yellow.50",
    colorIcono: "orange.fg",
  },
};

/**
 * Lo que requiere atención: vencimientos próximos o vencidos e incidentes
 * abiertos, con su prioridad y el acceso para atenderlos.
 *
 * Cada fila tiene dos zonas. La principal es un `<button>` real y no un `div`
 * con `role="button"`: se llega con Tab y se activa con Enter, y lleva al
 * destino de la alerta (el `link_destino` que manda el backend, o el detalle
 * del incidente). Los elementos de limpieza llevan además, **aparte** de ese
 * botón (un botón no puede contener otro), el "Registrar recambio" que ya tiene
 * el centro de notificaciones: se resuelve sin salir del panel.
 */
export function TarjetaAlertas({
  alertas,
  loading,
  error,
  onRecambio,
  recambiando,
  ...rest
}: TarjetaAlertasProps & BoxProps) {
  const navigate = useNavigate();

  return (
    <TarjetaPanel titulo="Requiere Atención" tamanoTitulo="xl" {...rest}>
      {loading && <EstadoCargando />}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!loading && !error && alertas.length === 0 && (
        <Text fontSize="sm" color="fg.muted" my="auto">
          No hay alertas ni incidentes pendientes: todo está al día.
        </Text>
      )}

      {!loading && !error && alertas.length > 0 && (
        /*
          La lista va dentro de un recuadro con filas separadas por una línea,
          como en el panel de referencia, y no como tarjetitas sueltas.
        */
        <Stack
          as="ul"
          gap="0"
          listStyleType="none"
          p="0"
          m="0"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="md"
          overflow="hidden"
          alignSelf="stretch"
        >
          {alertas.map((alerta, i) => {
            const estilo = ESTILO_PRIORIDAD[alerta.prioridad];
            const Icono = ICONO[alerta.icono];
            const conRecambio = alerta.recambioId !== null;

            return (
              <Box
                as="li"
                key={alerta.clave}
                minW="0"
                display="flex"
                alignItems="center"
                bg="bg.panel"
                borderTopWidth={i === 0 ? "0" : "1px"}
                borderColor="border.subtle"
                _hover={{ bg: "bg.subtle" }}
              >
                {/*
                  `chakra.button` y no el componente `Button` de Chakra: la
                  receta pone su propio `background` en `@layer recipes`, que
                  le gana al `bg` de las props. Sigue siendo un `<button>`
                  real, con Enter y Espacio.
                */}
                <chakra.button
                  type="button"
                  display="flex"
                  alignItems="center"
                  flex="1"
                  minW="0"
                  gap="3"
                  px="3"
                  py="3"
                  textAlign="left"
                  cursor="pointer"
                  fontWeight="normal"
                  _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "brand.focusRing",
                    outlineOffset: "-2px",
                  }}
                  onClick={() => navigate(alerta.destino)}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="8"
                    h="8"
                    rounded="md"
                    flexShrink={0}
                    bg={estilo.fondoIcono}
                    color={estilo.colorIcono}
                    aria-hidden
                  >
                    <Icono size={16} />
                  </Box>

                  {/*
                    Una sola línea: "Título: detalle". El título va en
                    negrita y el detalle (qué equipo, elemento o tipo de
                    incidente) en tono suave; si no entra, se corta con "…" y
                    el texto completo queda en el `title`.
                  */}
                  <Text
                    as="span"
                    fontSize="sm"
                    flex="1"
                    minW="0"
                    truncate
                    title={`${alerta.titulo}: ${alerta.detalle}`}
                  >
                    <Text as="span" fontWeight="semibold" color="fg">
                      {alerta.titulo}
                    </Text>
                    <Text as="span" color="fg.muted">
                      {alerta.detalle ? `: ${alerta.detalle}` : ""}
                    </Text>
                  </Text>

                  <Text
                    as="span"
                    fontSize="xs"
                    color={alerta.prioridad === "critico" ? "red.fg" : "fg.muted"}
                    whiteSpace="nowrap"
                    flexShrink={0}
                    display={{ base: "none", md: "inline" }}
                  >
                    {alerta.plazo}
                  </Text>

                  <Badge
                    colorPalette={estilo.paleta}
                    variant={estilo.variante}
                    px="2.5"
                    py="0.5"
                    borderRadius="full"
                    fontSize="xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    flexShrink={0}
                  >
                    {PRIORIDAD_LABEL[alerta.prioridad]}
                  </Badge>

                  {!conRecambio && (
                    <Text
                      as="span"
                      fontSize="sm"
                      fontWeight="medium"
                      color="brand.fg"
                      flexShrink={0}
                      minW="14"
                      textAlign="right"
                    >
                      Acción
                    </Text>
                  )}
                </chakra.button>

                {conRecambio && (
                  <Button
                    size="xs"
                    colorPalette="brand"
                    fontWeight="bold"
                    flexShrink={0}
                    mr="3"
                    loading={recambiando === alerta.clave}
                    disabled={recambiando !== null}
                    onClick={() => onRecambio(alerta)}
                  >
                    Registrar recambio
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </TarjetaPanel>
  );
}
