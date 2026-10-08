import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, Flex, Heading, Text, VStack } from "@chakra-ui/react";
import { IncidenteForm } from "../IncidenteForm";
import { CeldaFoto } from "../MiniaturaFoto";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useMisIncidentes } from "../../hooks/useMisIncidentes";
import { ReportarIncidenteEmptyState } from "./ReportarIncidenteEmptyState";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { estadoLabel, tipoLabel, tipoColor, formatoFecha } from "../../types/incidente";
import type { IncidenteFormValues, Incidente } from "../../types/incidente";
import { BannerError } from "../../../../components/ui/patrones";

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
      colorPalette={isActive ? "brand" : "gray"}
      fontWeight="bold"
      fontSize="sm"
      rounded="full"
      minW="180px"
      h="48px"
      borderWidth={isActive ? 0 : "2px"}
      borderColor={isActive ? "transparent" : "gray.300"}
      boxShadow={isActive ? "0 4px 14px var(--chakra-colors-brand-200)" : "xs"}
      transition="all 0.2s ease"
      color={isActive ? "white" : "gray.700"}
      _hover={{ transform: "translateY(-2px)" }}
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
      w="100%"
      p="4 5"
      rounded="lg"
      borderWidth="1px"
      borderColor="brand.100"
      bg="white"
      transition="all 0.15s ease"
      cursor="pointer"
      _hover={{
        bg: "gray.50",
        borderColor: "brand.200",
        boxShadow: "sm",
      }}
    >
      <Flex justify="space-between" align="flex-start" gap="4" flexWrap="wrap">
        <Box flex="1" minW={0}>
          {/* ID + tipo + estado */}
          <Flex align="center" gap="2" flexWrap="wrap" mb="2">
            <Text fontWeight="bold" fontSize="sm" color="gray.900">
              #{incidente.id} — {incidente.titulo}
            </Text>
            <Badge
              colorPalette={tipoColor(incidente.tipo)}
              variant="solid"
              borderRadius="md"
              px="8px"
              py="3px"
              fontSize="11px"
              fontWeight="semibold"
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
              fontWeight="semibold"
            >
              {estadoLabel(incidente.estado)}
            </Badge>
          </Flex>

          {/* Descripción con "Ver más" */}
          <Text fontSize="sm" color="gray.800" lineHeight={1.55} wordBreak="break-word">
            {incidente.descripcion.length > 120
              ? `${incidente.descripcion.substring(0, 117)}...`
              : incidente.descripcion}
            {incidente.descripcion.length > 120 && (
              <Text as="span" color="brand.500" fontWeight="semibold" ml="4px">
                Ver más
              </Text>
            )}
          </Text>

          {/* Si ya fue resuelto, el operador ve qué se hizo */}
          {cerrado && incidente.observacion_cierre && (
            <Text fontSize="xs" color="green.700" mt="2" lineHeight={1.5}>
              <strong>Resolución:</strong> {incidente.observacion_cierre}
            </Text>
          )}

          {/* Meta: fecha + equipo */}
          <Flex
            align="center"
            gap="4"
            fontSize="xs"
            color="gray.500"
            flexWrap="wrap"
            mt="2.5"
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
    <Box p="6" maxW="1100px" mx="auto">
      <Heading as="h2" size="lg" fontWeight="bold" color="gray.900" mb="6">
        Reportar Incidente
      </Heading>

      {exito && (
        <Box
          role="status"
          bg="green.100"
          color="green.800"
          p="3.5 5"
          rounded="lg"
          mb="6"
          borderWidth="1px"
          borderColor="green.200"
          fontWeight="semibold"
          boxShadow="0 4px 12px var(--chakra-colors-green-100)"
        >
          ✓ Incidente registrado correctamente
        </Box>
      )}

      {errorAlta && <BannerError>{errorAlta}</BannerError>}

      {/* Tabs estilo pills */}
      <Flex
        mb="6"
        gap="3"
        bg="gray.50"
        p="1.5"
        rounded="xl"
        borderWidth="1px"
        borderColor="brand.100"
      >
        <TabButton
          label="Mis Reportes"
          isActive={activeTab === "mis-reportes"}
          onClick={() => setActiveTab("mis-reportes")}
        />
        <TabButton
          label="Nuevo Incidente"
          isActive={activeTab === "nuevo-incidente"}
          onClick={() => setActiveTab("nuevo-incidente")}
        />
      </Flex>

      {activeTab === "nuevo-incidente" && (
        <Box
          bg="white"
          rounded="2xl"
          p="8"
          boxShadow="sm"
          borderWidth="1px"
          borderColor="brand.100"
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
          bg="white"
          rounded="2xl"
          p="6"
          boxShadow="sm"
          borderWidth="1px"
          borderColor="brand.100"
        >
          {loadingMis && (
            <Box textAlign="center" p="15 5">
              <Text color="gray.500" fontSize="md">
                Cargando tus reportes...
              </Text>
            </Box>
          )}
          {errorMis && (
            <Box textAlign="center" p="15 5">
              <Text color="red.600" fontSize="md" role="alert">
                Error al cargar: {errorMis}
              </Text>
            </Box>
          )}
          {!loadingMis && !errorMis && misIncidentes.length === 0 && (
            <ReportarIncidenteEmptyState />
          )}
          {!loadingMis && !errorMis && misIncidentes.length > 0 && (
            <VStack align="stretch" gap="3">
              <Box
                p="3.5 5"
                bg="gray.50"
                borderWidth="1px"
                borderColor="brand.200"
                roundedTop="lg"
                borderBottomWidth="0"
                fontWeight="semibold"
                fontSize="sm"
                color="brand.500"
              >
                Tus incidentes reportados (más recientes primero)
              </Box>
              <VStack align="stretch" gap="2">
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