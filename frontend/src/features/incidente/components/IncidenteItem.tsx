import { useNavigate } from "react-router-dom";
import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import { LuCamera, LuTriangleAlert } from "react-icons/lu";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
} from "../types/incidente";
import type { Incidente } from "../types/incidente";
import { formatoFecha as formatoFechaDia } from "../../../common/utils/fechas";
import { BotonAccion, Celda, EtiquetaEstado, FilaClickeable, TextoTruncado } from "../../../components/ui/patrones";
import { Tooltip } from "../../../components/ui/tooltip";

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
  const esEntregaRechazada =
    incidente.tipo === "entrega_rechazada" ||
    (incidente.tipo as string) === "Entrega rechazada" ||
    (incidente as any).tipo_incidente === "entrega_rechazada" ||
    (incidente as any).tipo_incidente === "Entrega rechazada";
  // El retiro de lote también se resuelve desde su circuito (cerrar el retiro),
  // igual que el rechazo de mercadería: acá no se ofrece el cierre manual.
  const esRetiroLote = incidente.tipo === "retiro_lote";

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
    <FilaClickeable onAbrir={handleVer}
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
        whiteSpace="nowrap"
        title={new Date(incidente.fecha_reporte).toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour12: false,
        })}
      >
        {formatoFechaDia(incidente.fecha_reporte)}
      </Celda>

      <Celda maxW="220px">
        <Text
          fontWeight="semibold"
          fontSize="sm"
          lineClamp={1}
          color={esViejo ? "red.fg" : "#1E293B"}
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

      <Celda center>
        {incidente.foto_url ? (
          <Tooltip content="Ver detalle para ver la foto" showArrow openDelay={300} closeDelay={0}>
            <Box
              display="inline-flex"
              color="brand.fg"
              role="img"
              aria-label="Tiene foto adjunta"
            >
              <LuCamera size={20} />
            </Box>
          </Tooltip>
        ) : (
          <Text color="fg.subtle">-</Text>
        )}
      </Celda>

      <Celda>
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

      <Celda>
        {/* Abierto en naranja (pendiente), no en rojo: el rojo es "vencido". */}
        <EtiquetaEstado tono={cerrado ? "ok" : "alerta"}>
          {estadoLabel(incidente.estado)}
        </EtiquetaEstado>
      </Celda>

      <Celda>
        <TextoTruncado
          texto={incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
        />
      </Celda>

      {showActions && (
        <Celda center>
          <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
            <BotonAccion accion="ver" label="Ver detalle" onClick={handleVer} />
            {cerrado ? (
              // Los incidentes generados por un rechazo de mercadería o por un
              // retiro de lote son inmutables desde acá: se resuelven desde su
              // propio circuito ("Resolver rechazo" en la salida, "Cerrar
              // retiro" en E6). El botón se muestra deshabilitado con el
              // motivo en el tooltip.
              esEntregaRechazada || esRetiroLote ? (
                <Tooltip
                  content={
                    esRetiroLote
                      ? "Este incidente se resuelve desde Cerrar retiro en la ficha del retiro y no se puede reabrir desde acá."
                      : "Los incidentes de rechazo de mercadería son inmutables y no se pueden reabrir"
                  }
                  showArrow
                  openDelay={300}
                  closeDelay={0}
                >
                  {/* Un botón `disabled` no dispara tooltips: el span hace de
                      ancla para el hover. */}
                  <Box as="span" display="inline-flex">
                    <BotonAccion
                      accion="reabrir"
                      label="Reabrir incidente"
                      tooltip={
                        esRetiroLote
                          ? "Este incidente se resuelve desde Cerrar retiro en la ficha del retiro y no se puede reabrir desde acá."
                          : "Los incidentes de rechazo de mercadería son inmutables y no se pueden reabrir"
                      }
                      disabled
                      onClick={() => {}}
                    />
                  </Box>
                </Tooltip>
              ) : (
                onReabrir && (
                  <BotonAccion
                    accion="reabrir"
                    label="Reabrir incidente"
                    onClick={() => onReabrir(incidente)}
                  />
                )
              )
            ) : (
              // El cierre de un incidente de rechazo o de retiro de lote también
              // está bloqueado: se resuelve desde su circuito ("Resolver rechazo"
              // en la salida, "Cerrar retiro" en E6).
              !esEntregaRechazada &&
              !esRetiroLote &&
              onCerrar && (
                <BotonAccion
                  accion="cerrar"
                  label="Cerrar incidente"
                  onClick={() => onCerrar(incidente)}
                />
              )
            )}
          </HStack>
        </Celda>
      )}
    </FilaClickeable>
  );
}