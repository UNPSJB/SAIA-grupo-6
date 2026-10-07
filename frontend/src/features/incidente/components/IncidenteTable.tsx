import { Box, Table, Text } from "@chakra-ui/react";
import { IncidenteItem } from "./IncidenteItem";
import type { Incidente } from "../types/incidente";
import { TEAL } from "../../../common/theme/tokens";

interface IncidenteTableProps {
  incidentes: Incidente[];
  onCerrar?: (incidente: Incidente) => void;
  onReabrir?: (incidente: Incidente) => void;
  onVer?: (incidente: Incidente) => void;
  showActions?: boolean;
  mensajeVacio?: string;
}

export function IncidenteTable({
  incidentes,
  onCerrar,
  onReabrir,
  onVer,
  showActions = true,
  mensajeVacio = "Todavía no se registraron incidentes.",
}: IncidenteTableProps) {
  if (incidentes.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">{mensajeVacio}</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ borderRadius: "8px", overflow: "hidden" }}>
      <Table.Root
        variant="outline"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <Table.Header>
          <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Fecha
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px", width: "220px" }}
            >
              Título
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px", width: "90px" }}
            >
              Foto
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Tipo
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px", width: "130px" }}
            >
              Estado
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Reportado por
            </Table.ColumnHeader>

            {showActions && (
              <Table.ColumnHeader
                color="white"
                fontWeight="normal"
                fontSize="16px"
                style={{ padding: "12px", textAlign: "center" }}
              >
                Acciones
              </Table.ColumnHeader>
            )}
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {incidentes.map((incidente) => (
            <IncidenteItem
              key={incidente.id}
              incidente={incidente}
              onCerrar={onCerrar}
              onReabrir={onReabrir}
              onVer={onVer}
              showActions={showActions}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}