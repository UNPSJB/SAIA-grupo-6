import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Heading,
  Table,
  Badge,
  Button,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { obtenerNotificaciones } from "../../services/notificacionService";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import type { Notificacion } from "../../types/notificacion";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
  TEXTO_SUAVE,
} from "../../../../common/theme/tokens";

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
    <Box style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      <Heading as="h2" size="md" mb="20px">
        🔔 Centro de Notificaciones del Sistema
      </Heading>

      {/* CARTEL VERDE DE ÉXITO ESTILO SAIA */}
      {exito && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <Box
            style={{
              backgroundColor: "white",
              padding: "30px 50px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <Box style={{ fontSize: "50px", marginBottom: "10px" }}>✅</Box>
            <Heading
              as="h3"
              style={{ margin: 0, color: EXITO, fontSize: "24px" }}
            >
              Éxito
            </Heading>
            <Text
              style={{
                color: TEXTO_SECUNDARIO,
                marginTop: "10px",
                fontSize: "16px",
                fontWeight: 500,
              }}
            >
              Recambio registrado correctamente.
            </Text>
          </Box>
        </Box>
      )}

      {error && (
        <Box style={{ backgroundColor: ERROR_FONDO, color: ERROR_TEXTO, padding: "12px",
          borderRadius: "6px", marginBottom: "20px", border: "1px solid #f5c6cb",
          fontWeight: "bold" }}>
          ⚠️ {error}
        </Box>
      )}

      {loading ? (
        <Spinner />
      ) : notificacionesOrdenadas.length === 0 ? (
        <Box p="30px" textAlign="center" bg="#f8f9fa" borderRadius="8px">
          <Text fontSize="18px" color={EXITO} fontWeight="bold">
            ✅ No hay notificaciones pendientes
          </Text>
          <Text color={GRIS_MEDIO}>
            Todos los vencimientos están al día.
          </Text>
        </Box>
      ) : (
        <Box bg="white" borderRadius="10px" boxShadow="0 4px 15px rgba(0,0,0,0.05)" overflow="hidden" border="1px solid #e2e8f0">
          <Table.Root variant="outline" size="md">
            <Table.Header bg="#f8fafc">
                <Table.Row>
                  <Table.ColumnHeader color={TEXTO_SUAVE} fontWeight="bold" textTransform="uppercase" fontSize="12px">Origen</Table.ColumnHeader>
                  <Table.ColumnHeader color={TEXTO_SUAVE} fontWeight="bold" textTransform="uppercase" fontSize="12px">Estado</Table.ColumnHeader>
                  <Table.ColumnHeader color={TEXTO_SUAVE} fontWeight="bold" textTransform="uppercase" fontSize="12px">Detalle / Mensaje</Table.ColumnHeader>
                  <Table.ColumnHeader color={TEXTO_SUAVE} fontWeight="bold" textTransform="uppercase" fontSize="12px">Vencimiento</Table.ColumnHeader>
                  <Table.ColumnHeader color={TEXTO_SUAVE} fontWeight="bold" textTransform="uppercase" fontSize="12px" textAlign="center">Acción</Table.ColumnHeader>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {notificacionesOrdenadas.map((n) => (
                  <Table.Row key={n.id_notificacion} _hover={{ bg: "#f7fafc" }} transition="background 0.2s">
                    <Table.Cell>
                      <Badge bg="#e9d8fd" color="#553c9a" px="2" py="1" borderRadius="md" fontWeight="bold">
                        {n.tipo === "ELEMENTO_LIMPIEZA"
                          ? "Elemento Limpieza"
                          : "Plan Calibración/Mantenimiento"}
                      </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge 
                      bg={n.nivel === "VENCIDO" ? "#fed7d7" : "#feebc8"} 
                      color={n.nivel === "VENCIDO" ? "#c53030" : "#c05621"}
                      px="2" py="1" borderRadius="md" fontWeight="bold"
                    >
                      {n.nivel === "VENCIDO" ? "VENCIDO" : "PRÓXIMO A VENCER"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontWeight="bold" color="#2d3748" mb="1">{n.titulo}</Text>
                    <Text fontSize="14px" color="#718096">
                        {n.mensaje}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="14px" color={TEXTO_SUAVE}>
                        {formatoFechaOCorta(n.fecha_referencia)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell textAlign="center">
                    <Button
                      size="sm"
                      bg="#3182ce"
                      color="white"
                      _hover={{ bg: "#2b6cb0" }}
                      fontWeight="bold"
                      borderRadius="6px"
                      onClick={() => handleResolver(n)}
                    >
                      {n.tipo === "ELEMENTO_LIMPIEZA" ? "Registrar Recambio" : "Ver plan"}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Box>
  );
}
