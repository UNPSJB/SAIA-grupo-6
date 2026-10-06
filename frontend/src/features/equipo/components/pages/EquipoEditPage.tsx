import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { EquipoForm } from "../../components/EquipoForm";
import { useEquipo } from "../../hooks/useEquipo";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { Equipo } from "../../types/equipo";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../../common/theme/tokens";

export function EquipoEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const equipoId = Number(id);

  const {
    equipo,
    loading: cargando,
    error: errorCarga,
  } = useEquipo(Number.isFinite(equipoId) ? equipoId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useEquipoABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Equipo, "id">) => {
    try {
      await modificar(equipoId, values);
      setExito(true);
      // Espera 2 segundos para que el usuario lea el cartel antes de volver a la lista
      delayedNavigate("/equipos");
    } catch {
      // El error ya queda reflejado en useEquipoABM().error
    }
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Editar Equipo
        </Heading>
        <Button
          bg={GRIS_MEDIO}
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }}
          _hover={{ bg: GRIS_MEDIO }}
          onClick={() => navigate("/equipos")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && <Text color="red.500">{errorCarga}</Text>}

      {cargando && (
        <Text style={{ fontStyle: "italic", color: TEXTO_TERCIARIO }}>
          Cargando datos del Equipo...
        </Text>
      )}

      {!cargando && !errorCarga && equipo && (
        <>
          {/* Cartel rojo de error */}
          {errorGuardado && (
            <Box
              style={{
                backgroundColor: ERROR_FONDO,
                color: ERROR_TEXTO,
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #f5c6cb",
                fontWeight: "bold",
              }}
            >
              ⚠️ {errorGuardado}
            </Box>
          )}

          {/* Cartel verde de éxito */}
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
                  equipo modificado correctamente.
                </Text>
              </Box>
            </Box>
          )}

          <EquipoForm
            key={equipo.id}
            initialValues={{ nombre: equipo.nombre, tipo: equipo.tipo, ubicacion: equipo.ubicacion, activo: equipo.activo,}}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Equipo"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/equipos")}
            mostrarBaja={true}
          />
        </>
      )}
    </Box>
  );
}
