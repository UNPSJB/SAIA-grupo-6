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
};

const paletaOrigen = (tipo: string) => PALETA_ORIGEN[tipo] ?? "gray";

export function NotificacionesPage() {
  const navigate = useNavigate();
  const delayed = useSafeTimeout();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false); // <-- Estado para el cartel verde

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

  const handleResolver = async (notif: Notificacion) => {
    if (notif.tipo === "ELEMENTO_LIMPIEZA") {
      try {
        await registrarRecambioElemento(notif.entidad_id);

        // Avisamos a la campana
        window.dispatchEvent(new Event("actualizar_notificaciones"));

        // Mostramos el cartel de éxito
        setExito(true);
        delayed(() => {
          setExito(false);
          cargar(); // Recién cuando se va el cartel recargamos la tabla
        }, 1500); // 1.5 segundos es ideal para no hacerlos esperar mucho

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
    } else {
      navigate(notif.link_destino);
    }
  };

  // Ordenamos para que los VENCIDOS (rojos) queden siempre primeros en la lista
  const notificacionesOrdenadas = [...notificaciones].sort((a, b) => {
    if (a.nivel === "VENCIDO" && b.nivel !== "VENCIDO") return -1;
    if (a.nivel !== "VENCIDO" && b.nivel === "VENCIDO") return 1;
    return 0;
  });

  return (
    <Box p="5" maxW="1000px" mx="auto">
      <PageHeader
        title={
          <HStack gap="2">
            <span aria-hidden>🔔</span>
            Centro de notificaciones
          </HStack>
        }
        description="Vencimientos pendientes del sistema."
      />

      {/* CARTEL VERDE DE ÉXITO */}
      <DialogoExito
        isOpen={exito}
        mensaje="Recambio registrado correctamente."
      />

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
        <Tarjeta>
          <Table.Root variant="outline" size="md">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Origen</EncabezadoOscuro>
                <EncabezadoOscuro>Estado</EncabezadoOscuro>
                <EncabezadoOscuro>Detalle / Mensaje</EncabezadoOscuro>
                <EncabezadoOscuro>Vencimiento</EncabezadoOscuro>
                <EncabezadoOscuro center>Acción</EncabezadoOscuro>
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
                      <Badge
                        colorPalette={paletaOrigen(n.tipo)}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                        fontWeight="bold"
                      >
                        {n.tipo === "ELEMENTO_LIMPIEZA"
                          ? "Elemento Limpieza"
                          : "Plan Calibración/Mantenimiento"}
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
                        {n.tipo === "ELEMENTO_LIMPIEZA" ? "Registrar Recambio" : "Ver plan"}
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