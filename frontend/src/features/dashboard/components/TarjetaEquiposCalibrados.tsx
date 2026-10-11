import { Box, Flex, Text, type BoxProps } from "@chakra-ui/react";
import { LuCheck, LuTriangleAlert } from "react-icons/lu";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import type { EstadoCalibracion } from "../types/dashboard";
import { TarjetaPanel } from "./TarjetaPanel";

interface TarjetaEquiposCalibradosProps {
  estado: EstadoCalibracion;
  loading: boolean;
  error: string | null;
}

/**
 * Equipos calibrados: cuántos están aptos y cuál falta.
 *
 * El círculo junto al dato es el semáforo de la tarjeta: teal con un tilde si
 * están todos aptos, ámbar tenue con una advertencia si hay alguno pendiente. Nombra
 * solo el primero pendiente porque el resto se ve en la gestión de planes, y
 * una lista de ocho nombres no entra en el cuadro.
 */
export function TarjetaEquiposCalibrados({
  estado,
  loading,
  error,
  ...rest
}: TarjetaEquiposCalibradosProps & BoxProps) {
  const { total, aptos, pendientes } = estado;
  const todosAptos = pendientes.length === 0;

  return (
    <TarjetaPanel titulo="Equipos Calibrados" tamanoTitulo="sm" {...rest}>
      {loading && <EstadoCargando />}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!loading && !error && total === 0 && (
        <Text fontSize="sm" color="fg.muted" my="auto">
          No hay equipos cargados.
        </Text>
      )}

      {!loading && !error && total > 0 && (
        /*
          El ícono va pegado al dato y no al borde de la tarjeta: separado por
          todo el ancho de la card se leía como un elemento suelto. Los dos
          bloques se centran en vertical entre sí.
        */
        <Flex align="center" gap="3" flex="1" my="auto">
          <Box minW="0">
            {/* El apto va grande y el total y la palabra "Aptos", apagados. */}
            <Flex align="baseline" gap="1" wrap="wrap">
              <Text
                as="span"
                fontSize="4xl"
                fontWeight="bold"
                lineHeight="1"
                color="brand.fg"
              >
                {aptos}
              </Text>
              <Text as="span" fontSize="lg" color="fg.muted">
                /{total} Aptos
              </Text>
            </Flex>

            <Text mt="2" fontSize="xs" color={todosAptos ? "green.fg" : "fg.muted"}>
              {todosAptos
                ? "Todos los equipos con calibración vigente."
                : `Pendiente: ${pendientes[0]}`}
            </Text>
          </Box>

          {/*
            Color sobrio: fondo tenue y el ícono en el tono de texto de su
            paleta, en vez del círculo ámbar sólido con ícono blanco.
          */}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="9"
            h="9"
            rounded="full"
            bg={todosAptos ? "brand.50" : "orange.50"}
            color={todosAptos ? "brand.fg" : "orange.fg"}
            borderWidth="1px"
            borderColor={todosAptos ? "brand.200" : "orange.200"}
            flexShrink={0}
            aria-hidden
          >
            {todosAptos ? <LuCheck size={18} /> : <LuTriangleAlert size={18} />}
          </Box>
        </Flex>
      )}
    </TarjetaPanel>
  );
}
