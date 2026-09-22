import { useState } from "react";
import {
  Box,
  Heading,
  HStack,
  NativeSelect,
  Input,
  Spinner,
  Text,
  Field,
  Button,
  Badge,
} from "@chakra-ui/react";
import { useEquipos } from "../../../equipo/hooks/useEquipos";
import { useChecklist } from "../../hooks/useChecklist";
import { ChecklistPlanGroup } from "../ChecklistPlanGroup";

const TEAL = "#468189";

const estiloInput = {
  backgroundColor: "#fff",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "2px solid #90BEBB",
  fontSize: "15px",
  color: "#333",
};

const estiloSelect = {
  ...estiloInput,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
};

export function ChecklistPage() {
  const hoyISO = new Date().toISOString().split("T")[0];
  const [selectedEquipoId, setSelectedEquipoId] = useState<number>(0);
  const [selectedFecha, setSelectedFecha] = useState<string>(hoyISO);

  const { equipos, loading: cargandoEquipos } = useEquipos();
  const {
    checklistData,
    planes,
    loading: cargandoChecklist,
    error,
    actualizandoId,
    toggleTarea,
    recargar,
  } = useChecklist(selectedEquipoId || null, selectedFecha);

  const totalTareas = planes.reduce((acc, p) => acc + p.tareas.length, 0);
  const tareasCompletadas = planes.reduce(
    (acc, p) => acc + p.tareas.filter((t) => t.completado).length,
    0,
  );

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px" flexWrap="wrap" gap="15px">
        <Box>
          <HStack gap="12px" alignItems="center">
            <Heading as="h2" size="md" fontWeight="bold" color="black">
              Checklist Diario de Limpieza
            </Heading>
            {checklistData &&
              checklistData.checklist_id &&
              checklistData.estado && (
                <Badge
                  colorPalette={
                    checklistData.estado === "completo" ? "green" : "blue"
                  }
                  fontSize="12px"
                  px="8px"
                  py="3px"
                >
                  Folio #{checklistData.checklist_id} —{" "}
                  {checklistData.estado.toUpperCase()}
                </Badge>
              )}
          </HStack>
          <Text color="gray.600" fontSize="14px" mt="2px">
            Control, persistencia e historial auditable por equipo y fecha.
          </Text>
        </Box>
        {selectedEquipoId > 0 && (
          <Button
            bg="#e0e0e0"
            color="#333"
            fontSize="14px"
            fontWeight="bold"
            height="auto"
            onClick={recargar}
            style={{ padding: "8px 16px", borderRadius: "6px" }}
          >
            Actualizar
          </Button>
        )}
      </HStack>

      {/* Barra de Filtros */}
      <Box
        bg="white"
        p="20px"
        borderRadius="10px"
        boxShadow="0 2px 6px rgba(0,0,0,0.05)"
        mb="25px"
      >
        <HStack gap="20px" flexWrap="wrap" alignItems="flex-end">
          <Box flex="1" minW="240px">
            <Field.Root required>
              <Box
                as="label"
                display="block"
                fontSize="14px"
                fontWeight="bold"
                mb="6px"
                color="#555"
              >
                EQUIPO *
              </Box>
              <NativeSelect.Root disabled={cargandoEquipos}>
                <NativeSelect.Field
                  value={selectedEquipoId}
                  onChange={(e) => setSelectedEquipoId(Number(e.target.value))}
                  style={estiloSelect}
                >
                  <option value={0}>
                    {cargandoEquipos
                      ? "Cargando equipos..."
                      : "Seleccioná un equipo"}
                  </option>
                  {equipos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} ({e.ubicacion})
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </Box>

          <Box minW="180px">
            <Field.Root>
              <Box
                as="label"
                display="block"
                fontSize="14px"
                fontWeight="bold"
                mb="6px"
                color="#555"
              >
                FECHA
              </Box>
              <Input
                type="date"
                value={selectedFecha}
                onChange={(e) => setSelectedFecha(e.target.value)}
                style={estiloInput}
              />
            </Field.Root>
          </Box>
        </HStack>
      </Box>

      {error && (
        <Box
          style={{
            backgroundColor: "#f8d7da",
            color: "#721c24",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb",
            fontWeight: "bold",
          }}
        >
          ⚠️ {error}
        </Box>
      )}

      {selectedEquipoId === 0 && (
        <Box bg="white" borderRadius="8px" p={10} textAlign="center">
          <Text fontSize="16px" color="gray.600">
            Elegí un equipo arriba para visualizar o generar el checklist de la
            fecha seleccionada.
          </Text>
        </Box>
      )}

      {selectedEquipoId > 0 && cargandoChecklist && (
        <HStack justify="center" p={10}>
          <Spinner size="lg" color={TEAL} />
          <Text color="gray.600">Cargando checklist...</Text>
        </HStack>
      )}

      {selectedEquipoId > 0 &&
        !cargandoChecklist &&
        planes.length === 0 &&
        !error && (
          <Box bg="white" borderRadius="8px" p={10} textAlign="center">
            <Text fontSize="16px" color="gray.600">
              No hay planes de limpieza programados para este equipo en la fecha
              seleccionada.
            </Text>
          </Box>
        )}

      {selectedEquipoId > 0 && !cargandoChecklist && planes.length > 0 && (
        <>
          <HStack justify="space-between" mb="16px">
            <Text fontSize="14px" color="gray.600">
              Progreso general: <strong>{tareasCompletadas}</strong> de{" "}
              <strong>{totalTareas}</strong> tareas completadas.
            </Text>
          </HStack>

          {planes.map((plan) => (
            <ChecklistPlanGroup
              key={plan.plan_id}
              plan={plan}
              actualizandoId={actualizandoId}
              onToggle={toggleTarea}
            />
          ))}
        </>
      )}
    </Box>
  );
}
