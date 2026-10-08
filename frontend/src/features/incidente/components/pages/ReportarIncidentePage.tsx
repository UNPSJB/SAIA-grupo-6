import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, Flex, Text, VStack } from "@chakra-ui/react";
import { IncidenteForm } from "../IncidenteForm";
import { CeldaFoto } from "../MiniaturaFoto";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useMisIncidentes } from "../../hooks/useMisIncidentes";
import { ReportarIncidenteEmptyState } from "./ReportarIncidenteEmptyState";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { estadoLabel, tipoLabel, tipoColor, formatoFecha } from "../../types/incidente";
import type { IncidenteFormValues, Incidente } from "../../types/incidente";
import {
  BannerError,
  BannerExito,
  EstadoCargando,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";

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
      type="button"
      onClick={onClick}
      variant={isActive ? "solid" : "outline"}
      colorPalette={isActive ? "brand" : "neutral"}
      fontWeight="bold"
      fontSize="sm"
      rounded="full"
      minW="180px"
      h="12"
      borderWidth="1px"
      borderColor={isActive ? "transparent" : "border.muted"}
      color={isActive ? "white" : "fg.muted"}
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
      w="100%"
      p="4"
      rounded="lg"
      borderWidth="1px"
      borderColor="border"
      bg="bg.panel"
      transition="all 0.15s ease"
      cursor="pointer"
      _hover={{
        bg: "bg.subtle",
        borderColor: "border.muted",
        boxShadow: "sm",
      }}
    >
      <Flex justify="space-between" align="flex-start" gap="4" flexWrap="wrap">
        <Box flex="1" minW={0}>
          {/* ID + tipo + estado */}
          <Flex align="center" gap="2" flexWrap="wrap" mb="2">
            <Text fontWeight="bold" fontSize="sm" color="fg">
              #{incidente.id} — {incidente.titulo}
            </Text>
            <Badge
              colorPalette={tipoColor(incidente.tipo)}
              variant="solid"
              borderRadius="md"
              px="2"
              py="1"
              fontSize="xs"
              fontWeight="medium"
            >
              {tipoLabel(incidente.tipo)}
            </Badge>
            <Badge
              colorPalette={cerrado ? "green" : "red"}
              variant="subtle"
              borderRadius="md"
              px="2"
              py="1"
              fontSize="xs"
              fontWeight="medium"
            >
              {estadoLabel(incidente.estado)}
            </Badge>
          </Flex>

          {/* Descripción con "Ver más" */}
          <Text fontSize="sm" color="fg" lineHeight={1.55} wordBreak="break-word">
            {incidente.descripcion.length > 120
              ? `${incidente.descripcion.substring(0, 117)}...`
              : incidente.descripcion}
            {incidente.descripcion.length > 120 && (
              <Text as="span" color="brand.fg" fontWeight="bold" ml="1">
                Ver más
              </Text>
            )}
          </Text>

          {/* Si ya fue resuelto, el operador ve qué se hizo */}
          {cerrado && incidente.observacion_cierre && (
            <Text fontSize="xs" color="green.fg" mt="2" lineHeight={1.5}>
              <strong>Resolución:</strong> {incidente.observacion_cierre}
            </Text>
          )}

          {/* Meta: fecha + equipo */}
          <Flex
            align="center"
            gap="4"
            fontSize="xs"
            color="fg.muted"
            flexWrap="wrap"
            mt="2"
          >
            <Text as="span">{formatoFecha(incidente.fecha_reporte)}</Text>
            {incidente.equipo_nombre && <Text as="span">{incidente.equipo_nombre}</Text>}
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
  const [activeTab, setActiveTab] = useState<"mis-reportes" | "nuevo-incidente">("mis-reportes");

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
    navigate(`/incidentes/${incidente.id}`, { state: { from: "mis-reportes" } });
  };

  return (
    <Box p="5" maxW="1100px" mx="auto">
      <PageHeader
        title="Reportar incidente"
        description="Registrá un incidente nuevo o seguí el estado de los que ya reportaste."
      />

      {exito && <BannerExito>Incidente registrado correctamente</BannerExito>}

      {errorAlta && <BannerError>{errorAlta}</BannerError>}

      {/* Tabs estilo pills */}
      <Flex
        mb="6"
        gap="3"
        bg="bg.subtle"
        p="1"
        rounded="full"
        borderWidth="1px"
        borderColor="border.subtle"
      >
        <TabButton
          label="Mis reportes"
          isActive={activeTab === "mis-reportes"}
          onClick={() => setActiveTab("mis-reportes")}
        />
        <TabButton
          label="Nuevo incidente"
          isActive={activeTab === "nuevo-incidente"}
          onClick={() => setActiveTab("nuevo-incidente")}
        />
      </Flex>

      {activeTab === "nuevo-incidente" && (
        <IncidenteForm
          onSubmit={handleSubmit}
          isLoading={loadingAlta}
          title="Registrar nuevo incidente"
          submitLabel="Reportar incidente"
          fullWidth
        />
      )}

      {activeTab === "mis-reportes" && (
        <Tarjeta p="6">
          {loadingMis && <EstadoCargando>Cargando tus reportes...</EstadoCargando>}
          {errorMis && (
            <BannerError mb="0">Error al cargar: {errorMis}</BannerError>
          )}
          {!loadingMis && !errorMis && misIncidentes.length === 0 && (
            <ReportarIncidenteEmptyState />
          )}
          {!loadingMis && !errorMis && misIncidentes.length > 0 && (
            <VStack align="stretch" gap="3">
              <Text fontWeight="bold" fontSize="sm" color="fg.muted">
                Tus incidentes reportados (más recientes primero)
              </Text>
              <VStack align="stretch" gap="2">
                {misIncidentes.map((inc) => (
                  <IncidenteCard key={inc.id} incidente={inc} onVer={handleVerDetalle} />
                ))}
              </VStack>
            </VStack>
          )}
        </Tarjeta>
      )}
    </Box>
  );
}