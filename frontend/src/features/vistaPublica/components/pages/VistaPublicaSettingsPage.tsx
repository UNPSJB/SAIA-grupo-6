import { useEffect, useState } from "react";
import { Badge, Box, Button, HStack, Input, Stack, Switch, Text } from "@chakra-ui/react";
import { QRCodeSVG } from "qrcode.react";
import { LuCopy, LuQrCode } from "react-icons/lu";

import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import {
  BannerError,
  BannerExito,
  EstadoCargando,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";
import {
  actualizarConfiguracionVistaPublica,
  obtenerConfiguracionVistaPublica,
} from "../../services/vistaPublicaService";
import type { ConfiguracionVistaPublica } from "../../types/vistaPublica";

export function VistaPublicaSettingsPage() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionVistaPublica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoDesactivacion, setConfirmandoDesactivacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargarConfiguracion = async () => {
    try {
      setCargando(true);
      setError(null);
      setConfiguracion(await obtenerConfiguracionVistaPublica());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la configuración.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Diferir la carga evita una actualización de estado durante el efecto.
    const timeoutId = window.setTimeout(() => {
      void cargarConfiguracion();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const actualizarEstado = async (habilitada: boolean) => {
    try {
      setGuardando(true);
      setError(null);
      setExito(null);
      const actualizada = await actualizarConfiguracionVistaPublica(habilitada);
      setConfiguracion(actualizada);
      setConfirmandoDesactivacion(false);
      setExito(
        habilitada
          ? "La vista pública fue activada."
          : "La vista pública fue desactivada y el enlace anterior dejó de ser válido.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la vista pública.");
    } finally {
      setGuardando(false);
    }
  };

  const copiarEnlace = async () => {
    if (!configuracion?.url_publica) return;

    try {
      if (!navigator.clipboard) {
        throw new Error("El navegador no permite copiar al portapapeles.");
      }
      await navigator.clipboard.writeText(configuracion.url_publica);
      setError(null);
      setExito("El enlace público fue copiado al portapapeles.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo copiar el enlace.");
    }
  };

  return (
    <Box p="5" maxW="4xl">
      <PageHeader
        title="Vista pública"
        description="Controlá si se puede compartir el enlace público del establecimiento."
      />

      {cargando ? <EstadoCargando>Cargando configuración...</EstadoCargando> : null}
      {!cargando && error ? <BannerError>{error}</BannerError> : null}
      {!cargando && exito ? <BannerExito>{exito}</BannerExito> : null}

      {!cargando && configuracion ? (
        <Stack gap="5">
          <Tarjeta p="6">
            <Stack gap="5">
              <HStack justify="space-between" align="flex-start" gap="4" flexWrap="wrap">
                <Box>
                  <Text fontWeight="bold" color="fg">
                    Estado de publicación
                  </Text>
                  <Text mt="1" fontSize="sm" color="fg.muted">
                    La vista pública está desactivada por defecto y solo se comparte al activarla.
                  </Text>
                </Box>
                <Badge colorPalette={configuracion.habilitada ? "green" : "gray"} size="lg">
                  {configuracion.habilitada ? "Activa" : "Desactivada"}
                </Badge>
              </HStack>

              <Switch.Root
                checked={configuracion.habilitada}
                disabled={guardando}
                colorPalette={configuracion.habilitada ? "green" : "neutral"}
                onCheckedChange={({ checked }) => {
                  if (checked) {
                    void actualizarEstado(true);
                  } else {
                    setConfirmandoDesactivacion(true);
                  }
                }}
              >
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="sm" fontWeight="bold" color="fg.muted">
                  {configuracion.habilitada ? "Vista pública activada" : "Activar vista pública"}
                </Switch.Label>
              </Switch.Root>
            </Stack>
          </Tarjeta>

          {configuracion.habilitada && configuracion.url_publica ? (
            <Tarjeta p="6">
              <Stack gap="5">
                <HStack gap="2">
                  <LuQrCode aria-hidden />
                  <Text fontWeight="bold" color="fg">
                    Enlace y código QR
                  </Text>
                </HStack>
                <Text fontSize="sm" color="fg.muted">
                  Compartí este enlace cuando la futura vista de indicadores esté disponible. Al
                  desactivar la publicación, este QR y los enlaces anteriores dejarán de funcionar
                  permanentemente.
                </Text>
                <Stack direction={{ base: "column", md: "row" }} gap="3">
                  <Input value={configuracion.url_publica} readOnly bg="bg.subtle" />
                  <Button onClick={() => void copiarEnlace()} colorPalette="brand" flexShrink="0">
                    <LuCopy aria-hidden />
                    Copiar enlace
                  </Button>
                </Stack>
                <Box alignSelf="flex-start" p="4" bg="white" borderWidth="1px" borderColor="border" rounded="md">
                  <QRCodeSVG
                    value={configuracion.url_publica}
                    size={192}
                    level="M"
                    includeMargin
                    title="Código QR del enlace público"
                  />
                </Box>
              </Stack>
            </Tarjeta>
          ) : null}

          <Tarjeta p="5" bg="bg.subtle">
            <Text fontSize="sm" color="fg.muted">
              La selección de indicadores y la página pública de consulta se implementarán en
              historias posteriores. Esta configuración no publica incidentes, no conformidades ni
              otros datos internos.
            </Text>
          </Tarjeta>
        </Stack>
      ) : null}

      <ConfirmDialog
        isOpen={confirmandoDesactivacion}
        titulo="¿Desactivar la vista pública?"
        mensaje="El enlace y el código QR actuales dejarán de funcionar. Si la activás nuevamente, se generará un código nuevo."
        textoConfirmar="Sí, desactivar"
        isLoading={guardando}
        onConfirm={() => void actualizarEstado(false)}
        onCancel={() => {
          if (!guardando) setConfirmandoDesactivacion(false);
        }}
      />
    </Box>
  );
}
