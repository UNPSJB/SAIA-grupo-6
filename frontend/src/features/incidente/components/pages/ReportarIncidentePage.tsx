import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, Text, VStack, Badge, Flex } from "@chakra-ui/react";
import { IncidenteForm } from "../IncidenteForm";
import { CeldaFoto } from "../MiniaturaFoto";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useMisIncidentes } from "../../hooks/useMisIncidentes";
import { ReportarIncidenteEmptyState } from "./ReportarIncidenteEmptyState";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { estadoLabel, tipoLabel, tipoColor, formatoFecha } from "../../types/incidente";
import type { IncidenteFormValues, Incidente } from "../../types/incidente";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO_FONDO,
  EXITO_TEXTO,
  EXITO_TEXTO_HOVER,
  FONDO_CARD,
  TEAL,
  TEXTO_FUERTE,
  TEXTO_SUAVE,
} from "../../../../common/theme/tokens";

/**
 * Pills de navegación.
 *
 * Está FUERA del componente que las usa a propósito: si se definieran
 * adentro, React vería un tipo de componente nuevo en cada render y
 * desmontaría/remontaría el formulario, perdiendo el foco mientras se escribe.
 */
function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      variant={isActive ? "solid" : "outline"}
      colorScheme={isActive ? "teal" : "gray"}
      style={{
        padding: "12px 28px",
        fontWeight: 700,
        fontSize: "15px",
        borderRadius: "9999px",
        minWidth: "180px",
        height: "48px",
        borderWidth: isActive ? 0 : "2px",
        borderColor: isActive ? "transparent" : "#cbd5e0",
        boxShadow: isActive
          ? "0 4px 14px rgba(70, 129, 137, 0.4)"
          : "0 1px 3px rgba(0,0,0,0.05)",
        transition: "all 0.2s ease",
        background: isActive
          ? "linear-gradient(135deg, #468189 0%, #3d737a 100%)"
          : "white",
        color: isActive ? "white" : TEXTO_SUAVE,
      }}
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: isActive
          ? "0 6px 20px rgba(70, 129, 137, 0.5)"
          : "0 4px 12px rgba(0,0,0,0.1)",
        background: isActive
          ? "linear-gradient(135deg, #3d737a 0%, #356368 100%)"
          : FONDO_CARD,
      }}
      _active={{ transform: "translateY(0)" }}
    >
      {label}
    </Button>
  );
}

/**
 * Tarjeta de "Mis Reportes".
 *
 * Muestra el estado porque el operador reportó algo y necesita ver si ya fue
 * resuelto, junto con la acción correctiva que dejó el administrador.
 */
function IncidenteCard({
  incidente,
  onVer,
}: {
  incidente: Incidente;
  onVer: (incidente: Incidente) => void;
}) {
  const cerrado = incidente.estado === "cerrado";

  return (
    <Box
      onClick={() => onVer(incidente)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onVer(incidente);
      }}
      style={{
        width: "100%",
        padding: "16px 20px",
        borderRadius: "10px",
        border: "1px solid #e8f0ef",
        background: "white",
        transition: "all 0.15s ease",
        cursor: "pointer",
      }}
      _hover={{
        background: "#fafbfb",
        borderColor: "#d8e7e5",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <Flex justify="space-between" align="flex-start" style={{ gap: "16px", flexWrap: "wrap" }}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          {/* ID + tipo + estado */}
          <Flex align="center" gap="8px" style={{ flexWrap: "wrap", marginBottom: "8px" }}>
            <Text fontWeight={700} fontSize="15px" color={TEXTO_FUERTE}>
              #{incidente.id}
            </Text>
            <Badge
              colorPalette={tipoColor(incidente.tipo)}
              variant="solid"
              borderRadius="md"
              px="8px"
              py="3px"
              fontSize="11px"
              fontWeight={600}
            >
              {tipoLabel(incidente.tipo)}
            </Badge>
            <Badge
              colorPalette={cerrado ? "green" : "red"}
              variant="subtle"
              borderRadius="md"
              px="8px"
              py="3px"
              fontSize="11px"
              fontWeight={600}
            >
              {estadoLabel(incidente.estado)}
            </Badge>
          </Flex>

          {/* Descripción */}
          <Text
            fontSize="14px"
            color="#374151"
            lineHeight={1.55}
            style={{ wordBreak: "break-word" }}
          >
            {incidente.descripcion}
          </Text>

          {/* Si ya fue resuelto, el operador ve qué se hizo */}
          {cerrado && incidente.observacion_cierre && (
            <Text fontSize="13px" color={EXITO_TEXTO} mt="8px" lineHeight={1.5}>
              <strong>Resolución:</strong> {incidente.observacion_cierre}
            </Text>
          )}

          {/* Meta: fecha + equipo */}
          <Flex
            align="center"
            gap="16px"
            style={{ fontSize: "12px", color: "#6b7280", flexWrap: "wrap", marginTop: "10px" }}
          >
            <span>{formatoFecha(incidente.fecha_reporte)}</span>
            {incidente.equipo_nombre && <span>{incidente.equipo_nombre}</span>}
          </Flex>
        </Box>

        {/* La foto que el mismo operador adjuntó, para que la reconozca */}
        <CeldaFoto rutaFoto={incidente.foto_url} />
      </Flex>
    </Box>
  );
}

export function ReportarIncidentePage() {
  const navigate = useNavigate();
  const { alta, loading: loadingAlta, error: errorAlta } = useIncidenteABM();
  const {
    misIncidentes,
    loading: loadingMis,
    error: errorMis,
    cargarMisIncidentes,
  } = useMisIncidentes();
  const [exito, setExito] = useState(false);
  // `setTimeout` a mano: sin cleanup, si el usuario navega antes de los 3s
  // el setState corre sobre un componente ya desmontado.
  const programarAviso = useSafeTimeout();
  const [activeTab, setActiveTab] = useState<"nuevo" | "mis-reportes">("nuevo");

  const handleSubmit = async (values: IncidenteFormValues, foto?: File) => {
    try {
      await alta(values, foto);
      setExito(true);
      setActiveTab("mis-reportes");
      await cargarMisIncidentes();
      programarAviso(() => setExito(false), 3000);
    } catch {
      // El mensaje de error ya quedó en errorAlta.
    }
  };

  const handleVerDetalle = (incidente: Incidente) => {
    navigate(`/incidentes/${incidente.id}`);
  };

  return (
    <Box style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <Heading as="h2" size="lg" fontWeight="bold" color={TEXTO_FUERTE} mb="24px">
        Reportar Incidente
      </Heading>

      {exito && (
        <Box
          style={{
            backgroundColor: EXITO_FONDO,
            color: EXITO_TEXTO_HOVER,
            padding: "14px 20px",
            borderRadius: "10px",
            marginBottom: "24px",
            border: "1px solid #c3e6cb",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(21, 87, 36, 0.15)",
          }}
        >
          Incidente registrado correctamente
        </Box>
      )}

      {errorAlta && (
        <Box
          style={{
            backgroundColor: ERROR_FONDO,
            color: ERROR_TEXTO,
            padding: "14px 20px",
            borderRadius: "10px",
            marginBottom: "24px",
            border: "1px solid #f5c6cb",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(114, 28, 36, 0.15)",
          }}
        >
          {errorAlta}
        </Box>
      )}

      {/* Tabs estilo pills */}
      <Box
        mb="24px"
        style={{
          display: "flex",
          gap: "12px",
          background: FONDO_CARD,
          padding: "6px",
          borderRadius: "12px",
          border: "1px solid #e8f0ef",
        }}
      >
        <TabButton
          label="Nuevo Incidente"
          isActive={activeTab === "nuevo"}
          onClick={() => setActiveTab("nuevo")}
        />
        <TabButton
          label="Mis Reportes"
          isActive={activeTab === "mis-reportes"}
          onClick={() => setActiveTab("mis-reportes")}
        />
      </Box>

      {activeTab === "nuevo" && (
        <Box
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
            border: "1px solid #eef3f2",
          }}
        >
          <IncidenteForm
            onSubmit={handleSubmit}
            isLoading={loadingAlta}
            title="Registrar Nuevo Incidente"
            submitLabel="Reportar Incidente"
            fullWidth
          />
        </Box>
      )}

      {activeTab === "mis-reportes" && (
        <Box
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
            border: "1px solid #eef3f2",
          }}
        >
          {loadingMis && (
            <Box style={{ textAlign: "center", padding: "60px 20px" }}>
              <Text color="gray.500" fontSize="16px">
                Cargando tus reportes...
              </Text>
            </Box>
          )}
          {errorMis && (
            <Box style={{ textAlign: "center", padding: "60px 20px" }}>
              <Text color="red.500" fontSize="16px">
                Error al cargar: {errorMis}
              </Text>
            </Box>
          )}
          {!loadingMis && !errorMis && misIncidentes.length === 0 && (
            <ReportarIncidenteEmptyState />
          )}
          {!loadingMis && !errorMis && misIncidentes.length > 0 && (
            <VStack align="stretch" gap="12px">
              <Box
                style={{
                  padding: "14px 20px",
                  backgroundColor: FONDO_CARD,
                  border: "1px solid #d8e7e5",
                  borderRadius: "10px 10px 0 0",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: TEAL,
                }}
              >
                Tus incidentes reportados (más recientes primero)
              </Box>
              <VStack align="stretch" gap="8px">
                {misIncidentes.map((inc) => (
                  <IncidenteCard key={inc.id} incidente={inc} onVer={handleVerDetalle} />
                ))}
              </VStack>
            </VStack>
          )}
        </Box>
      )}
    </Box>
  );
}