import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  HStack,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { obtenerNotificaciones } from "../../services/notificacionService";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import type { Notificacion } from "../../types/notificacion";
import { CambiarFechaVencimientoDialog } from "../CambiarFechaVencimientoDialog";
import { ConfiguracionAlertasPanel } from "../ConfiguracionAlertasPanel";
import {
  BannerError,
  Celda,
  DialogoExito,
  EncabezadoOscuro,
  FilaEncabezado,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";

/**
 * Paleta del badge de "Origen", para que el color signifique lo mismo en
 * todas las vistas: el morado es limpieza y el gris, calibración/mantenimiento.
 */
const PALETA_ORIGEN: Record<string, string> = {
  ELEMENTO_LIMPIEZA: "purple",
  VENCIMIENTO_PERSONAL: "blue",
};

const paletaOrigen = (tipo: string) => PALETA_ORIGEN[tipo] ?? "gray";

function etiquetaOrigen(tipo: string) {
  switch (tipo) {
    case "ELEMENTO_LIMPIEZA":
      return "Elemento Limpieza";
    case "VENCIMIENTO_PERSONAL":
      return "Vencimiento Personal";
    case "PLAN_CALIBRACION":
      return "Calibración";
    case "PLAN_MANTENIMIENTO":
      return "Mantenimiento";
  }
}

function etiquetaAccion(tipo: string) {
  switch (tipo) {
    case "ELEMENTO_LIMPIEZA":
      return "Registrar Recambio";
    case "VENCIMIENTO_PERSONAL":
      return "Cambiar fecha";
    case "PLAN_CALIBRACION":
      return "Registrar calibración";
    case "PLAN_MANTENIMIENTO":
      return "Registrar mantenimiento";
  }
}

export function NotificacionesPage() {
  const navigate = useNavigate();
  const delayed = useSafeTimeout();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null); // <-- Cartel verde
  const [notifEditando, setNotifEditando] = useState<Notificacion | null>(null);

  const cargar = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerNotificaciones();
      setNotificaciones(data);
    } catch (e) {
      // Antes el catch era vacío: un 500 mostraba "No hay notificaciones
      // pendientes", que es exactamente lo contrario de lo que pasó.
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const mostrarExito = (mensaje: string) => {
    // Avisamos a la campana
    window.dispatchEvent(new Event("actualizar_notificaciones"));

    // Mostramos el cartel de éxito
    setMensajeExito(mensaje);
    delayed(() => {
      setMensajeExito(null);
      cargar(); // Recién cuando se va el cartel recargamos la tabla
    }, 1500);
  };

  const handleResolver = async (notif: Notificacion) => {
    if (notif.tipo === "ELEMENTO_LIMPIEZA") {
      try {
        await registrarRecambioElemento(notif.entidad_id);
        mostrarExito("Recambio registrado correctamente.");
      } catch (error) {
        // Antes solo iba a la consola: si el recambio fallaba, la campana
        // quedaba con el mismo número y el usuario no se enteraba de nada,
        // porque la UI no cambiaba. Ahora se lo decimos.
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo registrar el recambio",
        );
        console.error("Error al registrar recambio:", error);
      }
    } else if (notif.tipo === "VENCIMIENTO_PERSONAL") {
      setNotifEditando(notif); // abre el diálogo
    } else {
      navigate(notif.link_destino);
    }
  };

  const handleFechaGuardada = () => {
    setNotifEditando(null);
    mostrarExito("Fecha de vencimiento actualizada correctamente.");
  };

  // Ordenamos para que los VENCIDOS (rojos) queden siempre primeros en la lista
  const notificacionesOrdenadas = [...notificaciones].sort((a, b) => {
    if (a.nivel === "VENCIDO" && b.nivel !== "VENCIDO") return -1;
    if (a.nivel !== "VENCIDO" && b.nivel === "VENCIDO") return 1;
    return 0;
  });

  return (
    <Box p="5">
      <PageHeader
        title={
          <HStack gap="2" flexWrap="wrap" rowGap="2">
            <span aria-hidden>🔔</span>
            Centro de notificaciones
          </HStack>
        }
        description="Vencimientos pendientes del sistema."
      />

<ConfiguracionAlertasPanel
        onGuardado={() => mostrarExito("Configuración guardada correctamente.")}
      />

      {/* Aviso de éxito: sale antes de recargar la tabla. */}
      <DialogoExito isOpen={mensajeExito !== null} mensaje={mensajeExito ?? ""} />

      {/* DIÁLOGO PARA CAMBIAR LA FECHA DE UN VENCIMIENTO DE PERSONAL */}
      {notifEditando && (
        <CambiarFechaVencimientoDialog
          key={notifEditando.id_notificacion}
          notificacion={notifEditando}
          onClose={() => setNotifEditando(null)}
          onSaved={handleFechaGuardada}
        />
      )}

      {error && <BannerError>{error}</BannerError>}

      {loading ? (
        <Spinner color="brand.500" />
      ) : notificacionesOrdenadas.length === 0 ? (
        <Tarjeta p="8" textAlign="center">
          <Text fontSize="lg" color="green.fg" fontWeight="bold">
            ✅ No hay notificaciones pendientes
          </Text>
          <Text color="fg.muted" fontSize="sm">
            Todos los vencimientos están al día.
          </Text>
        </Tarjeta>
      ) : (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" size="md" w="100%" minW="940px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro ancho="media">Origen</EncabezadoOscuro>
                <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                <EncabezadoOscuro>Detalle / Mensaje</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Vencimiento</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acción</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {notificacionesOrdenadas.map((n) => (
                <Table.Row
                  key={n.id_notificacion}
                  _hover={{ bg: "brand.50" }}
                  transition="background 0.2s"
                >
                    <Celda>
                      {/* Mismo motivo que en `IncidenteItem`: con la tabla de
                          ancho fijo la etiqueta ya no hace crecer la columna,
                          y "Plan Calibración/Mantenimiento" mide 204px. */}
                      <Badge
                        colorPalette={paletaOrigen(n.tipo)}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                        fontWeight="bold"
                        maxW="100%"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {etiquetaOrigen(n.tipo)}
                      </Badge>
                    </Celda>
                    <Celda>
                      <Badge
                        colorPalette={n.nivel === "VENCIDO" ? "red" : "orange"}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                        fontWeight="bold"
                        maxW="100%"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {n.nivel === "VENCIDO" ? "VENCIDO" : "PRÓXIMO A VENCER"}
                      </Badge>
                    </Celda>
                    <Celda>
                      <Text fontWeight="bold" color="fg" mb="1">{n.titulo}</Text>
                      <Text fontSize="sm" color="fg.muted">
                        {n.mensaje}
                      </Text>
                    </Celda>
                    <Celda fontSize="sm">
                      {formatoFechaOCorta(n.fecha_referencia)}
                    </Celda>
                    <Celda center>
                      <Button
                        size="sm"
                        colorPalette="brand"
                        fontWeight="bold"
                        onClick={() => handleResolver(n)}
                      >
                        {etiquetaAccion(n.tipo)}
                      </Button>
                    </Celda>
                  </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}
    </Box>
  );
}