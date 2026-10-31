import { useEffect, useState } from "react";
import { Box, Button, Flex, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { LuGlobe, LuShieldCheck, LuTriangleAlert } from "react-icons/lu";
import { useParams } from "react-router-dom";

import { validarVistaPublica } from "../../services/vistaPublicaPublicaService";

type EstadoVistaPublica = "cargando" | "disponible" | "no_disponible" | "error";

export function VistaPublicaPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [estado, setEstado] = useState<EstadoVistaPublica>("cargando");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    const validar = async () => {
      if (!codigo) {
        if (!cancelado) setEstado("no_disponible");
        return;
      }

      if (!cancelado) setEstado("cargando");
      try {
        const valida = await validarVistaPublica(codigo);
        if (!cancelado) setEstado(valida ? "disponible" : "no_disponible");
      } catch {
        if (!cancelado) setEstado("error");
      }
    };

    // La primera validación se difiere igual que otras cargas iniciales de SAIA.
    const timeoutId = window.setTimeout(() => void validar(), 0);
    const alRecuperarFoco = () => void validar();
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") void validar();
    };
    window.addEventListener("focus", alRecuperarFoco);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      cancelado = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", alRecuperarFoco);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [codigo, intento]);

  return (
    <Flex minH="100dvh" bg="brand.50" align="center" justify="center" p={{ base: "5", md: "8" }}>
      <Box
        w="full"
        maxW="xl"
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        rounded="xl"
        px={{ base: "6", md: "10" }}
        py={{ base: "10", md: "14" }}
        textAlign="center"
        boxShadow="sm"
      >
        <Stack align="center" gap="6">
          <Flex
            w="14"
            h="14"
            rounded="full"
            bg="brand.600"
            color="white"
            align="center"
            justify="center"
          >
            <LuShieldCheck size={30} aria-hidden />
          </Flex>
          <Stack gap="1">
            <Text fontWeight="bold" color="brand.700" letterSpacing="wide">
              SAIA
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Sistema de Apoyo a la Inocuidad Alimentaria
            </Text>
          </Stack>

          {estado === "cargando" ? (
            <Stack align="center" gap="3" role="status" aria-live="polite">
              <Spinner size="lg" color="brand.500" />
              <Text color="fg.muted">Validando enlace público...</Text>
            </Stack>
          ) : null}

          {estado === "disponible" ? (
            <Stack align="center" gap="3">
              <LuGlobe size={36} color="var(--chakra-colors-brand-600)" aria-hidden />
              <Heading as="h1" size="xl" color="fg">
                Vista pública próximamente
              </Heading>
              <Text color="fg.muted">
                Los indicadores públicos de buenas prácticas estarán disponibles próximamente.
              </Text>
            </Stack>
          ) : null}

          {estado === "no_disponible" ? (
            <Stack align="center" gap="3">
              <LuTriangleAlert size={36} color="var(--chakra-colors-orange-500)" aria-hidden />
              <Heading as="h1" size="xl" color="fg">
                Esta vista pública no está disponible
              </Heading>
              <Text color="fg.muted">Verificá el enlace o solicitá uno nuevo al establecimiento.</Text>
            </Stack>
          ) : null}

          {estado === "error" ? (
            <Stack align="center" gap="4">
              <LuTriangleAlert size={36} color="var(--chakra-colors-red-500)" aria-hidden />
              <Heading as="h1" size="xl" color="fg">
                No se pudo validar el enlace
              </Heading>
              <Text color="fg.muted">Revisá tu conexión e intentá nuevamente.</Text>
              <Button onClick={() => setIntento((actual) => actual + 1)} colorPalette="brand">
                Reintentar
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Flex>
  );
}
