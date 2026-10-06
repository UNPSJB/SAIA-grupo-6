import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, Badge, Heading, Text, HStack, VStack } from "@chakra-ui/react";
import { useIncidente } from "../../hooks/useIncidente";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFechaCierre,
} from "../../types/incidente";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  EXITO_FONDO_CLARO,
  EXITO_TEXTO,
  FONDO_CARD,
  FONDO_NEUTRO,
  GRIS_MEDIO,
  TEAL,
  TEAL_OSCURO,
} from "../../../../common/theme/tokens";

export function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { incidente, loading, error, recargar } = useIncidente(Number(id));
  const { cerrar, reabrir, loading: procesando } = useIncidenteABM();
  const { user } = useAuth();
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [dialogoCierre, setDialogoCierre] = useState(false);
  const imagen = useImagenAutenticada(incidente?.foto_url);

  // Si es admin vuelve a gestión de incidentes, si es operador vuelve a reportar (sus reportes)
  const backUrl = puedeAdministrar(user) ? "/incidentes" : "/incidentes/reportar";

  const esAdmin = puedeAdministrar(user);
  const cerrado = incidente?.estado === "cerrado";

  const handleConfirmCerrar = async (observacionCierre: string) => {
    if (!incidente) return;
    try {
      await cerrar(incidente.id, observacionCierre);
      setDialogoCierre(false);
      await recargar();
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  const handleReabrir = async () => {
    if (!incidente) return;
    try {
      await reabrir(incidente.id);
      await recargar();
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  if (loading) {
    return <Box p="20px">Cargando incidente...</Box>;
  }

  if (error || !incidente) {
    return (
      <Box p="20px" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <Text color="red.500">{error || "No se encontró el incidente"}</Text>
        <Button 
          mt="16px" 
          bg={GRIS_MEDIO} 
          color="white" 
          height="auto" 
          onClick={() => navigate(backUrl)} 
          style={{ padding: "8px 16px", borderRadius: "6px" }}
        >
          Volver a la lista
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        {/* Encabezado - ESTILO ESTÁNDAR IGUAL A OTROS MÓDULOS */}
        <HStack justify="space-between" mb="24px">
          <Heading as="h2" size="lg" fontWeight="bold" color="black">
            Incidente #{incidente.id}
          </Heading>
          <Button 
            bg={GRIS_MEDIO} 
            color="white" 
            height="auto" 
            onClick={() => navigate(backUrl)} 
            style={{ padding: "8px 16px", borderRadius: "6px" }}
          >
            Volver a la lista
          </Button>
        </HStack>

        {/* Badge de estado + acción de cierre (solo administradores) */}
        <HStack justify="space-between" mb="24px">
          <Badge
            colorPalette={cerrado ? "green" : "red"}
            borderRadius="md"
            px="16px"
            py="6px"
            fontSize="16px"
            fontWeight="bold"
          >
            {estadoLabel(incidente.estado).toUpperCase()}
          </Badge>

          {esAdmin && (
            <HStack gap="10px">
              {cerrado ? (
                <Button
                  bg={ADVERTENCIA}
                  color="white"
                  height="auto"
                  loading={procesando}
                  onClick={handleReabrir}
                  style={{ padding: "8px 16px", borderRadius: "6px", fontWeight: "bold" }}
                  _hover={{ bg: ADVERTENCIA_HOVER }}
                >
                  Reabrir incidente
                </Button>
              ) : (
                <Button
                  bg={TEAL}
                  color="white"
                  height="auto"
                  onClick={() => setDialogoCierre(true)}
                  style={{ padding: "8px 16px", borderRadius: "6px", fontWeight: "bold" }}
                  _hover={{ bg: TEAL_OSCURO }}
                >
                  Cerrar incidente
                </Button>
              )}
            </HStack>
          )}
        </HStack>

        {/* Tipo */}
        <Box mb="20px">
          <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="6px" textTransform="uppercase">
            Tipo de Incidente
          </Text>
          <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="12px" py="6px" fontSize="16px">
            {tipoLabel(incidente.tipo)}
          </Badge>
        </Box>

        {/* Metadatos */}
        <Box
          mb="24px"
          p="20px"
          style={{
            backgroundColor: FONDO_CARD,
            border: "1px solid #d8e7e5",
            borderRadius: "10px",
          }}
        >
          <VStack align="start" gap="12px">
            <Text fontSize="16px">
              <strong>Reportado por:</strong>{" "}
              {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
            </Text>
            <Text fontSize="16px">
              <strong>Fecha y hora:</strong>{" "}
              {new Date(incidente.fecha_reporte).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })}
            </Text>
            {incidente.equipo_nombre && (
              <Text fontSize="16px">
                <strong>Equipo:</strong> {incidente.equipo_nombre}
              </Text>
            )}
          </VStack>
        </Box>

        {/* Descripción completa */}
        <Box mb="24px">
          <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="6px" textTransform="uppercase">
            Descripción
          </Text>
          <Text
            fontSize="16px"
            wordBreak="break-word"
            style={{
              whiteSpace: "pre-line",
              overflowWrap: "break-word",
              padding: "16px",
              backgroundColor: FONDO_NEUTRO,
              borderRadius: "8px",
              border: "1px solid #eee",
              lineHeight: "1.6",
            }}
          >
            {incidente.descripcion}
          </Text>
        </Box>

        {/* Evidencia fotográfica */}
        {incidente.foto_url && (
          <Box mb="24px">
            <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="6px" textTransform="uppercase">
              Evidencia Fotográfica
            </Text>
            <Box
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "16px",
                backgroundColor: FONDO_NEUTRO,
                borderRadius: "10px",
                border: "1px solid #eee",
              }}
            >
              {imagen.loading && (
                <Text fontSize="14px" color="gray.500">Cargando imagen...</Text>
              )}
              {!imagen.loading && imagen.error && (
                <Text fontSize="14px" color="red.500">{imagen.error}</Text>
              )}
              {imagen.src && (
                <img
                  src={imagen.src}
                  alt="Evidencia del incidente"
                  onClick={() => setImagenAmpliada(true)}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "300px",
                    width: "auto",
                    height: "auto",
                    borderRadius: "8px",
                    objectFit: "contain",
                    cursor: "pointer",
                  }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Resolución: qué se hizo, cuándo y quién lo resolvió */}
        {cerrado && (
          <Box
            mb="24px"
            p="20px"
            style={{
              backgroundColor: EXITO_FONDO_CLARO,
              border: "1px solid #c6f6d5",
              borderRadius: "10px",
            }}
          >
            <Text fontSize="16px" color={EXITO_TEXTO} fontWeight="bold">
              ✅ Incidente cerrado
            </Text>

            <VStack align="start" gap="8px" mt="12px">
              <Text fontSize="15px" color={EXITO_TEXTO}>
                <strong>Acción correctiva:</strong>{" "}
                {incidente.observacion_cierre ?? "Sin detalle registrado."}
              </Text>
              <Text fontSize="15px" color={EXITO_TEXTO}>
                <strong>Fecha de cierre:</strong>{" "}
                {formatoFechaCierre(incidente.fecha_cierre)}
              </Text>
              <Text fontSize="15px" color={EXITO_TEXTO}>
                <strong>Responsable de la resolución:</strong>{" "}
                {incidente.responsable_cierre_nombre ??
                  (incidente.responsable_cierre_id
                    ? `Usuario #${incidente.responsable_cierre_id}`
                    : "-")}
              </Text>
            </VStack>
          </Box>
        )}
      </Box>

      {/* Modal de imagen ampliada */}
      {imagenAmpliada && imagen.src && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
          onClick={() => setImagenAmpliada(false)}
        >
          <img
            src={imagen.src}
            alt="Evidencia ampliada"
            style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "8px" }}
          />
        </Box>
      )}

      {/* Confirmación de cierre con la acción correctiva */}
      <CerrarIncidenteDialog
        isOpen={dialogoCierre}
        incidente={incidente}
        isLoading={procesando}
        onClose={() => !procesando && setDialogoCierre(false)}
        onConfirm={handleConfirmCerrar}
      />
    </>
  );
}
