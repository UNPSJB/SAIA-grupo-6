import { useNavigate } from "react-router-dom";
import { Badge, Box, HStack, IconButton, Table, Text } from "@chakra-ui/react";
import { LuCamera, LuEye } from "react-icons/lu";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFecha,
} from "../types/incidente";
import type { Incidente } from "../types/incidente";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

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
      borderBottomWidth="1px"
      borderColor="border.subtle"
      opacity={cerrado ? 0.7 : 1}
    >
      <Celda p="3" whiteSpace="nowrap">
        {formatoFecha(incidente.fecha_reporte)}
      </Celda>

      <Celda p="3" maxW="220px">
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
          <Box
            display="inline-flex"
            color="brand.fg"
            title="Ver detalle para ver la foto"
            role="img"
            aria-label="Tiene foto adjunta"
          >
            <LuCamera size={20} />
          </Box>
        ) : (
          <Text color="fg.subtle">-</Text>
        )}
      </Celda>

      <Celda p="3">
        <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="2" py="1">
          {tipoLabel(incidente.tipo)}
        </Badge>
      </Celda>

      <Celda p="3">
        <Badge
          colorPalette={cerrado ? "green" : "red"}
          borderRadius="md"
          px="3"
          py="1"
        >
          {estadoLabel(incidente.estado)}
        </Badge>
      </Celda>

      <Celda p="3">
        {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
      </Celda>

      {showActions && (
        <Celda p="3" center>
          <HStack justify="center" gap="2">
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              colorPalette="neutral"
              aria-label="Ver detalle"
              onClick={handleVer}
              title="Ver detalle"
            >
              <LuEye />
            </IconButton>
            {cerrado
              ? onReabrir && (
                  <BotonTabla accion="reabrir" onClick={() => onReabrir(incidente)}>
                    Reabrir
                  </BotonTabla>
                )
              : onCerrar && (
                  <BotonTabla accion="cerrar" onClick={() => onCerrar(incidente)}>
                    Cerrar
                  </BotonTabla>
                )}
          </HStack>
        </Celda>
      )}
    </Table.Row>
  );
}