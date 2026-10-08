import { useNavigate } from "react-router-dom";
import { Badge, Button, HStack, Table, Text } from "@chakra-ui/react";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFecha,
} from "../types/incidente";
import type { Incidente } from "../types/incidente";
import { Celda } from "../../../components/ui/patrones";

interface IncidenteItemProps {
  incidente: Incidente;
  onCerrar?: (incidente: Incidente) => void;
  onReabrir?: (incidente: Incidente) => void;
  onVer?: (incidente: Incidente) => void;
  showActions?: boolean;
}

/**
 * Métricas del botón de acción de fila.
 *
 * `BotonTabla` cubre "editar"/"eliminar"/"reactivar", pero acá las dos
 * acciones posibles son cerrar (marca) y reabrir (naranja), que no están
 * en esa paleta. Se replican las mismas medidas para que la fila no se
 * desalinee respecto de las tablas de las demás features.
 */
const BOTON_ACCION = {
  size: "sm",
  fontWeight: "normal",
  h: "auto",
  px: "3",
  py: "1.5",
  rounded: "md",
} as const;

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
      borderBottomWidth="1px"
      borderColor="gray.100"
      opacity={cerrado ? 0.7 : 1}
    >
      <Celda p="3" whiteSpace="nowrap">
        {formatoFecha(incidente.fecha_reporte)}
      </Celda>

      <Celda p="3" fontSize="md" maxW="220px">
        <Text
          lineClamp={2}
          wordBreak="break-word"
          whiteSpace="pre-line"
          title={incidente.titulo}
        >
          {incidente.titulo}
        </Text>
      </Celda>

      <Celda p="3" center>
        {incidente.foto_url ? (
          <Text fontSize="lg" title="Ver detalle para ver la foto" aria-hidden>
            📷
          </Text>
        ) : (
          <Text color="gray.400">-</Text>
        )}
      </Celda>

      <Celda p="3" fontSize="md">
        <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="8px" py="4px">
          {tipoLabel(incidente.tipo)}
        </Badge>
      </Celda>

      <Celda p="3" fontSize="md">
        <Badge
          colorPalette={cerrado ? "green" : "red"}
          borderRadius="md"
          px="10px"
          py="4px"
        >
          {estadoLabel(incidente.estado)}
        </Badge>
      </Celda>

      <Celda p="3" fontSize="md">
        {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
      </Celda>

      {showActions && (
        <Celda p="3" center>
          <HStack justify="center" gap="2">
            <Button
              type="button"
              variant="ghost"
              fontSize="lg"
              aria-label="Ver detalle"
              onClick={handleVer}
              title="Ver Detalle"
            >
              <Text as="span" aria-hidden>
                👁️
              </Text>
            </Button>
            {cerrado
              ? onReabrir && (
                  <Button
                    {...BOTON_ACCION}
                    colorPalette="orange"
                    variant="solid"
                    onClick={() => onReabrir(incidente)}
                  >
                    Reabrir
                  </Button>
                )
              : onCerrar && (
                  <Button
                    {...BOTON_ACCION}
                    colorPalette="brand"
                    variant="solid"
                    onClick={() => onCerrar(incidente)}
                  >
                    Cerrar
                  </Button>
                )}
          </HStack>
        </Celda>
      )}
    </Table.Row>
  );
}