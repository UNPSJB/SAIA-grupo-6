import { Badge, Box, HStack, Stack, Switch, Text } from "@chakra-ui/react";
import { LuShieldCheck, LuTriangleAlert } from "react-icons/lu";

import {
  BannerError,
  BannerExito,
  EstadoCargando,
  Tarjeta,
} from "../../../components/ui/patrones";
import { useIndicadoresVistaPublica } from "../hooks/useIndicadoresVistaPublica";

export function ElegirIndicadoresPanel() {
  const { indicadores, cargando, guardandoClave, error, exito, cambiar } =
    useIndicadoresVistaPublica();

  // Un indicador puede estar "Visible" y aun así no aparecer en la vista
  // pública: se omite mientras no tenga datos suficientes para calcularlo.
  const visiblesSinDatos = indicadores.filter(
    (indicador) => indicador.habilitado && !indicador.con_datos,
  );

  return (
    <Tarjeta p="6">
      <Stack gap="5">
        <HStack gap="2">
          <LuShieldCheck aria-hidden />
          <Text fontWeight="bold" color="fg">
            Indicadores de la vista pública
          </Text>
        </HStack>
        <Text fontSize="sm" color="fg.muted">
          Elegí qué indicadores agregados se muestran a los visitantes. Los
          cambios se aplican al instante, sin volver a activar la vista.
        </Text>

        {cargando ? (
          <EstadoCargando>Cargando indicadores...</EstadoCargando>
        ) : null}
        {!cargando && error ? <BannerError mb="0">{error}</BannerError> : null}
        {!cargando && exito ? <BannerExito mb="0">{exito}</BannerExito> : null}

        {!cargando && visiblesSinDatos.length > 0 ? (
          <Box
            p="4"
            borderWidth="1px"
            borderColor="orange.300"
            rounded="md"
            bg="orange.50"
          >
            <HStack gap="2" align="flex-start">
              <Box color="orange.800" pt="0.5">
                <LuTriangleAlert aria-hidden />
              </Box>
              <Box>
                <Text fontWeight="semibold" fontSize="sm" color="orange.800">
                  {visiblesSinDatos.length === 1
                    ? "Un indicador visible todavía no se muestra al público"
                    : `${visiblesSinDatos.length} indicadores visibles todavía no se muestran al público`}
                </Text>
                <Text mt="1" fontSize="sm" color="orange.800">
                  {visiblesSinDatos
                    .map((indicador) => indicador.etiqueta)
                    .join(", ")}
                  . La vista pública omite las tarjetas sin datos suficientes
                  para calcularlas, así que no se publica un 0 % falso. Cuando
                  haya datos, aparecerán automáticamente.
                </Text>
              </Box>
            </HStack>
          </Box>
        ) : null}

        {!cargando ? (
          <Stack gap="3">
            {indicadores.map((indicador) => (
              <Box
                key={indicador.clave}
                p="4"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="md"
                bg={indicador.habilitado ? "bg.panel" : "bg.subtle"}
              >
                <HStack justify="space-between" align="flex-start" gap="4">
                  <Box>
                    <HStack gap="2" flexWrap="wrap">
                      <Text fontWeight="semibold" color="fg">
                        {indicador.etiqueta}
                      </Text>
                      <Badge
                        colorPalette={
                          indicador.habilitado
                            ? indicador.con_datos
                              ? "green"
                              : "orange"
                            : "gray"
                        }
                      >
                        {indicador.habilitado
                          ? indicador.con_datos
                            ? "Visible"
                            : "Visible, sin datos"
                          : "Oculto"}
                      </Badge>
                    </HStack>
                    <Text mt="1" fontSize="sm" color="fg.muted">
                      {indicador.descripcion}
                    </Text>
                    {indicador.habilitado && !indicador.con_datos ? (
                      <Text mt="2" fontSize="sm" fontWeight="medium" color="orange.800">
                        El público todavía no lo ve: faltan datos suficientes
                        para calcularlo.
                      </Text>
                    ) : null}
                  </Box>

                  <Switch.Root
                    checked={indicador.habilitado}
                    disabled={!indicador.disponible || guardandoClave !== null}
                    colorPalette="green"
                    aria-label={`Mostrar ${indicador.etiqueta} en la vista pública`}
                    onCheckedChange={({ checked }) => {
                      void cambiar(indicador.clave, checked);
                    }}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                  </Switch.Root>
                </HStack>
              </Box>
            ))}
          </Stack>
        ) : null}

        <Text fontSize="sm" color="fg.muted">
          Solo se publican indicadores agregados y positivos. Nunca se muestran
          incidentes, no conformidades ni datos que identifiquen al personal.
        </Text>
      </Stack>
    </Tarjeta>
  );
}
