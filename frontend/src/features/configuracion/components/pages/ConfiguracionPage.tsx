import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Heading, HStack, Link, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import { CONFIGURACION, esVisibleEntrada, type EntradaMenu } from "../../../../common/components/menuEntradas";
import { useAuth } from "../../../../common/context/useAuth";
import {
  BannerError,
  BannerExito,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";
import { useConfiguracionAlertas } from "../../hooks/useConfiguracionAlertas";
import { AlertasVencimientoPersonalCard } from "../AlertasVencimientoPersonalCard";

/** Título de cada bloque de la pantalla. */
function TituloSeccion({ children }: { children: string }) {
  return (
    <Heading as="h2" fontSize="md" fontWeight="bold" color="fg" mb="3">
      {children}
    </Heading>
  );
}

/** Acceso a un catálogo o ajuste que tiene su propia pantalla. */
function TarjetaAcceso({ entrada }: { entrada: EntradaMenu }) {
  const Icono = entrada.icon;
  return (
    <Link
      asChild
      display="block"
      h="full"
      p="5"
      bg="bg.panel"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      textDecoration="none"
      _hover={{ textDecoration: "none", borderColor: "brand.400", bg: "brand.50" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
    >
      <RouterLink to={entrada.to}>
        <HStack gap="3" align="flex-start">
          <Box color="brand.700" mt="0.5" aria-hidden>
            <Icono size={22} />
          </Box>
          <Box flex="1" minW={0}>
            <Text fontWeight="bold" color="fg">
              {entrada.label}
            </Text>
            {entrada.ayuda ? (
              <Text mt="1" fontSize="sm" color="fg.muted">
                {entrada.ayuda}
              </Text>
            ) : null}
          </Box>
          <Box color="fg.subtle" mt="1" aria-hidden>
            <LuChevronRight size={18} />
          </Box>
        </HStack>
      </RouterLink>
    </Link>
  );
}

/**
 * Ajustes generales del sistema. Se llega desde el menú de usuario (el avatar
 * de la barra superior), junto a "Mi perfil" y "Cerrar sesión".
 *
 * Reúne todo lo que es configuración: los catálogos generales (sectores,
 * unidades de medida) y la vista pública, que tienen pantalla propia y acá
 * aparecen como accesos, y los ajustes que se editan en el lugar.
 *
 * Para sumar un acceso: una línea en `CONFIGURACION` (`menuEntradas.ts`).
 * Para sumar un ajuste: una tarjeta más dentro del `Stack` de "Alertas".
 */
export function ConfiguracionPage() {
  const {
    configuracion,
    cargando,
    errorCarga,
    recargar,
    guardando,
    errorGuardado,
    exito,
    guardar,
    limpiarMensajes,
  } = useConfiguracionAlertas();
  const { user } = useAuth();
  const accesos = CONFIGURACION.filter((e) => esVisibleEntrada(e, user));

  return (
    <Pagina
      ancho="ancho"
      titulo="Configuración"
      descripcion="Catálogos generales y ajustes del sistema."
    >
      {accesos.length > 0 ? (
        <Box mb="8">
          <TituloSeccion>Catálogos y vista pública</TituloSeccion>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
            {accesos.map((entrada) => (
              <TarjetaAcceso key={entrada.to} entrada={entrada} />
            ))}
          </SimpleGrid>
        </Box>
      ) : null}

      <TituloSeccion>Alertas</TituloSeccion>

      {cargando && !configuracion ? (
        <EstadoCargando>Cargando configuración...</EstadoCargando>
      ) : null}

      {!cargando && errorCarga && !configuracion ? (
        <>
          <BannerError mb="4">{errorCarga}</BannerError>
          <Button
            type="button"
            variant="outline"
            colorPalette="neutral"
            onClick={() => void recargar()}
          >
            Reintentar
          </Button>
        </>
      ) : null}

      {errorGuardado ? <BannerError>{errorGuardado}</BannerError> : null}
      {exito ? <BannerExito>{exito}</BannerExito> : null}

      {configuracion ? (
        <Stack gap="5">
          <AlertasVencimientoPersonalCard
            diasGuardados={configuracion.dias_alerta_vencimiento_personal}
            guardando={guardando}
            onGuardar={guardar}
            onEditar={limpiarMensajes}
          />
        </Stack>
      ) : null}
    </Pagina>
  );
}
