import { useNavigate } from "react-router-dom";
import { Button, HStack, Table, Badge, Text } from "@chakra-ui/react";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFecha,
} from "../types/incidente";
import type { Incidente } from "../types/incidente";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  TEAL,
  TEAL_OSCURO,
} from "../../../common/theme/tokens";

interface IncidenteItemProps {
  incidente: Incidente;
  onCerrar?: (incidente: Incidente) => void;
  onReabrir?: (incidente: Incidente) => void;
  onVer?: (incidente: Incidente) => void;
  showActions?: boolean;
}

export function IncidenteItem({
  incidente,
  onCerrar,
  onReabrir,
  onVer,
  showActions = true,
}: IncidenteItemProps) {
  const navigate = useNavigate();
  const cerrado = incidente.estado === "cerrado";

  const handleVer = () => {
    if (onVer) {
      onVer(incidente);
    } else {
      navigate(`/incidentes/${incidente.id}`);
    }
  };

  return (
    <Table.Row
      style={{
        borderBottom: "1px solid #eee",
        opacity: cerrado ? 0.7 : 1,
      }}
    >
      <Table.Cell fontSize="14px" style={{ padding: "12px", whiteSpace: "nowrap" }}>
        {formatoFecha(incidente.fecha_reporte)}
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px", maxWidth: "220px" }}>
        <Text
          lineClamp={2}
          wordBreak="break-word"
          whiteSpace="pre-line"
          title={incidente.titulo}
        >
          {incidente.titulo}
        </Text>
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px", textAlign: "center" }}>
        {incidente.foto_url ? (
          <Text fontSize="18px" title="Ver detalle para ver la foto">📷</Text>
        ) : (
          <Text color="gray.400">-</Text>
        )}
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="8px" py="4px">
          {tipoLabel(incidente.tipo)}
        </Badge>
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        <Badge
          colorPalette={cerrado ? "green" : "red"}
          borderRadius="md"
          px="10px"
          py="4px"
        >
          {estadoLabel(incidente.estado)}
        </Badge>
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
      </Table.Cell>

      {showActions && (
        <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
          <HStack justify="center" style={{ gap: "10px" }}>
            <Button
              variant="ghost"
              fontSize="18px"
              cursor="pointer"
              onClick={handleVer}
              title="Ver Detalle"
            >
              👁️
            </Button>
            {cerrado
              ? onReabrir && (
                  <Button
                    bg={ADVERTENCIA}
                    color="white"
                    fontSize="15px"
                    fontWeight="normal"
                    style={{
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                    }}
                    _hover={{ bg: ADVERTENCIA_HOVER }}
                    onClick={() => onReabrir(incidente)}
                  >
                    Reabrir
                  </Button>
                )
              : onCerrar && (
                  <Button
                    bg={TEAL}
                    color="white"
                    fontSize="15px"
                    fontWeight="normal"
                    style={{
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                    }}
                    _hover={{ bg: TEAL_OSCURO }}
                    onClick={() => onCerrar(incidente)}
                  >
                    Cerrar
                  </Button>
                )}
          </HStack>
        </Table.Cell>
      )}
    </Table.Row>
  );
}
