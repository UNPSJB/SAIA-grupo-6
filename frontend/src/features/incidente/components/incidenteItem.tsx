import { useNavigate } from "react-router-dom";
import { Button, HStack, Table, Badge, Text } from "@chakra-ui/react";
import type { Incidente, TipoIncidente } from "../types/incidente";
import { TIPOS_INCIDENTE } from "../types/incidente";

interface IncidenteItemProps {
  incidente: Incidente;
  onDelete: (incidente: Incidente) => void;
}

const TEAL = "#468189";

function tipoLabel(tipo: TipoIncidente): string {
  return TIPOS_INCIDENTE.find((t) => t.value === tipo)?.label ?? tipo;
}

function tipoColor(tipo: TipoIncidente): string {
  switch (tipo) {
    case "plagas":
      return "red";
    case "falla_equipo":
      return "orange";
    case "devolucion_cliente":
      return "yellow";
    case "higiene_contaminacion":
      return "purple";
    default:
      return "gray";
  }
}

export function IncidenteItem({ incidente, onDelete }: IncidenteItemProps) {
  const navigate = useNavigate();

  return (
    <Table.Row
      style={{
        borderBottom: "1px solid #eee",
        opacity: incidente.activo ? 1 : 0.65,
      }}
    >
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{incidente.id}
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px", maxWidth: "220px" }}>
        <Text
          lineClamp={2}
          wordBreak="break-word"
          whiteSpace="pre-line"
          title={incidente.descripcion}
        >
          {incidente.descripcion}
        </Text>
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="8px" py="4px">
          {tipoLabel(incidente.tipo)}
        </Badge>
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
      </Table.Cell>

      <Table.Cell fontSize="14px" style={{ padding: "12px" }}>
        {new Date(incidente.fecha_reporte).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })}
      </Table.Cell>

      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          <Button
            variant="ghost"
            fontSize="18px"
            cursor="pointer"
            onClick={() => navigate(`/incidentes/${incidente.id}`)}
            title="Ver Detalle"
          >
            👁️
          </Button>
          {incidente.activo && (
            <Button
              bg="#d9534f"
              color="white"
              fontSize="15px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: "#c9302c" }}
              onClick={() => onDelete(incidente)}
            >
              Eliminar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}
