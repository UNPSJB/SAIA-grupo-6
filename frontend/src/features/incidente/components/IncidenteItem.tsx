import { useNavigate } from "react-router-dom";
import { Badge, Box, HStack, IconButton, Table, Text } from "@chakra-ui/react";
import { LuCamera, LuTriangleAlert, LuEye } from "react-icons/lu";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
} from "../types/incidente";
import type { Incidente } from "../types/incidente";
import { formatoFecha as formatoFechaDia } from "../../../common/utils/fechas";
import { BotonTabla, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface IncidenteItemProps {
  incidente: Incidente;
  onCerrar?: (incidente: Incidente) => void;
  onReabrir?: (incidente: Incidente) => void;
  onVer?: (incidente: Incidente) => void;
  showActions?: boolean;
}

// HU #55: Calcular si pasaron más de 7 días desde el reporte
function llevaMuchoTiempoAbierto(fechaReporte: string): boolean {
  const reporte = new Date(fechaReporte);
  const hoy = new Date();
  const diffTime = hoy.getTime() - reporte.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 7;
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

  // Resaltado visual si está abierto y es viejo
  const esViejo = !cerrado && llevaMuchoTiempoAbierto(incidente.fecha_reporte);

  return (
    <Table.Row
      borderBottomWidth="1px"
      borderColor="border.subtle"
      opacity={cerrado ? 0.7 : 1}
      /*
       * Un incidente abierto que lleva más de una semana sin resolverse se
       * marca sin pintar la fila entera: el título pasa a rojo y debajo
       * aparece el texto "Lleva más de 7 días sin resolver". El fondo rojo
       * completo tapaba la jerarquía visual del listado (parecía un error
       * de render antes que un estado).
       */
    >
      {/*
        Solo el día en la tabla: la hora completa queda en el `title`,
        para no perderla del todo. El detalle la muestra completa.
      */}
      <Celda
        p="3"
        whiteSpace="nowrap"
        title={new Date(incidente.fecha_reporte).toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour12: false,
        })}
      >
        {formatoFechaDia(incidente.fecha_reporte)}
      </Celda>

      <Celda p="3" maxW="220px">
        <Text
          fontWeight="bold"
          fontSize="15px"
          lineClamp={1}
          color={esViejo ? "red.fg" : "fg"}
          title={incidente.titulo}
        >
          {incidente.titulo}
        </Text>
        {/*
          La descripción no se muestra acá: se lee en el detalle. En la
          lista solo el título, y para los cerrados, la acción correctiva.
        */}
        {cerrado && incidente.observacion_cierre && (
          <Text fontSize="xs" color="fg.subtle" mt="4px" lineClamp={2}>
            <strong>Resolución:</strong> {incidente.observacion_cierre}
          </Text>
        )}
        {esViejo && (
          <HStack gap="1" color="red.fg" fontSize="xs" fontWeight="bold" mt="4px">
            <Box as="span" display="inline-flex" flexShrink={0} aria-hidden>
              <LuTriangleAlert size={12} />
            </Box>
            <Text as="span">Lleva más de 7 días sin resolver</Text>
          </HStack>
        )}
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
        {/*
          `maxW` + ellipsis en los badges: con `table-layout: fixed` la columna
          ya no crece para acomodar la etiqueta, y "Falla / Rotura de Equipo"
          se salía de la celda. Con puntos suspensivos el texto largo se
          recorta dentro de la píldora en vez de pisar la columna de al lado.
        */}
        <Badge
          colorPalette={tipoColor(incidente.tipo)}
          borderRadius="md"
          px="2"
          py="1"
          maxW="100%"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {tipoLabel(incidente.tipo)}
        </Badge>
      </Celda>

      <Celda p="3">
        <Badge
          colorPalette={cerrado ? "green" : "red"}
          borderRadius="md"
          px="3"
          py="1"
          maxW="100%"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {estadoLabel(incidente.estado)}
        </Badge>
      </Celda>

      <Celda p="3">
        <TextoTruncado
          texto={incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
        />
      </Celda>

      {showActions && (
        <Celda p="3" center>
          <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
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