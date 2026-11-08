import { Button, Stack } from "@chakra-ui/react";
import {
  BannerError,
  BannerExito,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";
import { useConfiguracionAlertas } from "../../hooks/useConfiguracionAlertas";
import { AlertasVencimientoPersonalCard } from "../AlertasVencimientoPersonalCard";

/**
 * Ajustes generales del sistema. Se llega desde el menú de usuario (el avatar
 * de la barra superior), junto a "Mi perfil" y "Cerrar sesión".
 *
 * Para sumar un ajuste nuevo: una tarjeta más dentro del `Stack`.
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

  return (
    <Pagina
      ancho="ancho"
      titulo="Configuración"
      descripcion="Ajustes generales del sistema."
    >
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
