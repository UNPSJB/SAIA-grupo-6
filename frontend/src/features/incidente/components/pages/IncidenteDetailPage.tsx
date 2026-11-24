import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Box, Button, Image, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuCircleCheck, LuX } from "react-icons/lu";
import { useIncidente } from "../../hooks/useIncidente";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { notificarCambioIncidentes } from "../../eventoIncidentes";
import { HistorialIncidente } from "../HistorialIncidente";
import { IncidentesRelacionados, VinculosIncidente } from "../VinculosIncidente";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import {
  destinoResolucion,
  duracion,
  esDeCircuito,
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFecha,
  formatoFechaCierre,
} from "../../types/incidente";
import { BannerError, BotonTexto, EstadoCargando, EtiquetaEstado } from "../../../../components/ui/patrones";
import { VisorFoto } from "../../../../components/ui/VisorFoto";
import { DatoDetalle, GrillaDatos, PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { useAuth } from "../../../../common/context/useAuth";

export function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { incidente, loading, error, recargar } = useIncidente(Number(id));
  const { cerrar, loading: cerrando, error: errorCierre } = useIncidenteABM();
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [modalCerrarAbierto, setModalCerrarAbierto] = useState(false);

  const esAdmin = user?.puede_administrar ?? false;
  const cerrado = incidente?.estado === "cerrado";

  const handleCerrarIncidente = async (accionCorrectiva: string) => {
    if (!incidente) return;
    try {
      await cerrar(incidente.id, accionCorrectiva);
    } catch {
      return; // El diálogo queda abierto y muestra el error del hook.
    }
    setModalCerrarAbierto(false);
    notificarCambioIncidentes();
    await recargar();
  };

  const esReclamoCliente = incidente?.tipo === "reclamo_cliente";
  const esEntregaRechazada = incidente?.tipo === "entrega_rechazada";
  const esRetiroLote = incidente?.tipo === "retiro_lote";

  // Los de circuito se resuelven en su vista: acá solo se lleva hasta ahí.
  const destino =
    incidente &&
    destinoResolucion(incidente.tipo, {
      salida: incidente.salida?.id,
      reclamo: incidente.reclamo?.id,
      retiro: incidente.retiro?.id,
    });

  // Quien administra vuelve a la gestión, salvo que venga de "Mis reportes".
  // Quien opera no tiene ahí los incidentes: los suyos están en "Mis reportes".
  const backUrl =
    !esAdmin || location.state?.from === "mis-reportes" ? "/incidentes/reportar" : "/incidentes";
  const volver = {
    a: backUrl,
    etiqueta: backUrl === "/incidentes" ? "Incidentes" : "Mis reportes",
  };

  // El hook de imagen debe ir ANTES de los early returns: si no, cuando loading
  // es true o hay error, el componente retorna antes de llegar al hook y React
  // se queja de que el número de hooks cambió entre renders.
  const imagen = useImagenAutenticada(incidente?.foto_url);

  if (loading) {
    return (
      <PaginaDetalle volver={volver} titulo="Incidente">
        <EstadoCargando>Cargando incidente...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !incidente) {
    return (
      <PaginaDetalle volver={volver} titulo="Incidente">
        <BannerError>{error || "No se encontró el incidente"}</BannerError>
      </PaginaDetalle>
    );
  }

  return (
    <>
      <PaginaDetalle
        volver={volver}
        titulo={`${incidente.titulo} #${incidente.id}`}
        descripcion={`Reportado el ${formatoFecha(incidente.fecha_reporte)}`}
        estado={
          <EtiquetaEstado tono={cerrado ? "ok" : "alerta"}>
            {estadoLabel(incidente.estado)}
          </EtiquetaEstado>
        }
        acciones={
          esAdmin &&
          !cerrado &&
          (esDeCircuito(incidente.tipo) ? (
            destino && (
              <Button size="sm" variant="outline" onClick={() => navigate(destino.a)}>
                {destino.etiqueta}
                <LuArrowRight size={16} aria-hidden />
              </Button>
            )
          ) : (
            <Button
              colorPalette="red"
              variant="surface"
              size="sm"
              onClick={() => setModalCerrarAbierto(true)}
              aria-label="Cerrar incidente"
            >
              <LuX size={16} aria-hidden />
              Cerrar incidente
            </Button>
          ))
        }
      >
        {/* Apilado a todo el ancho: con los registros vinculados, un lateral
            con los datos del reporte quedaba casi todo vacío. */}
        {(esEntregaRechazada || esReclamoCliente || esRetiroLote) && (
          <Alert.Root
            status={esRetiroLote ? "error" : esEntregaRechazada ? "warning" : "info"}
            mb="6"
            alignItems="flex-start"
          >
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                {esRetiroLote
                  ? "Incidente generado por un retiro de lote"
                  : esEntregaRechazada
                  ? "Incidente generado por un rechazo"
                  : "Incidente generado por un reclamo"}
              </Alert.Title>
              <Alert.Description>
                {esRetiroLote
                  ? "Este incidente se abrió al iniciar el retiro del lote. No se puede cerrar ni reabrir desde acá: se cierra desde Cerrar retiro en la ficha del retiro."
                  : esEntregaRechazada
                  ? "Este incidente no se puede cerrar ni reabrir desde acá: se resuelve desde Resolver rechazo en la salida."
                  : "Este incidente se abrió al registrar el reclamo de cliente. Se cierra y se reabre desde la ficha del reclamo."}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        <SeccionDetalle titulo="Datos del incidente">
          <GrillaDatos>
            <DatoDetalle etiqueta="Tipo de incidente">
              <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="2" py="1">
                {tipoLabel(incidente.tipo)}
              </Badge>
            </DatoDetalle>
            <DatoDetalle etiqueta={cerrado ? "Tiempo de resolución" : "Abierto hace"}>
              {cerrado
                ? incidente.fecha_cierre
                  ? duracion(incidente.fecha_reporte, incidente.fecha_cierre)
                  : "-"
                : duracion(incidente.fecha_reporte)}
            </DatoDetalle>
            <DatoDetalle etiqueta="Reportado por">
              {esAdmin ? (
                <BotonTexto
                  onClick={() => navigate(`/personal/detalle/${incidente.usuario_id}`)}
                  title="Ver la ficha de quien reportó"
                  textAlign="left"
                  whiteSpace="normal"
                >
                  {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
                </BotonTexto>
              ) : (
                incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`
              )}
            </DatoDetalle>
            <DatoDetalle etiqueta="Fecha y hora">
              {formatoFecha(incidente.fecha_reporte)}
            </DatoDetalle>
          </GrillaDatos>
        </SeccionDetalle>

        <SeccionDetalle css={{ "& > *:last-child": { marginBottom: "0" } }}>
        {/* Descripción */}
        <Box mb="6">
          <Text fontSize="sm" color="fg.muted" fontWeight="medium" mb="2">
            Descripción
          </Text>
          <Box
            p="4"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
            rounded="lg"
            whiteSpace="pre-line"
            lineHeight={1.7}
          >
            <Text fontSize="md" wordBreak="break-word">
              {incidente.descripcion}
            </Text>
          </Box>
        </Box>

        {/* Evidencia fotográfica */}
        {incidente.foto_url && (
          <Box mb="6">
            <Text fontSize="sm" color="fg.muted" fontWeight="medium" mb="1">
              Evidencia fotográfica
            </Text>
            <Box
              display="flex"
              justifyContent="center"
              p="4"
              bg="bg.subtle"
              rounded="lg"
              borderWidth="1px"
              borderColor="border"
            >
              {imagen.loading && (
                <Text fontSize="sm" color="fg.muted">Cargando imagen...</Text>
              )}
              {!imagen.loading && imagen.error && (
                <Text fontSize="sm" color="red.fg">{imagen.error}</Text>
              )}
              {imagen.src && (
                <Image
                  src={imagen.src}
                  alt="Evidencia del incidente"
                  w="100%"
                  maxH="400px"
                  objectFit="contain"
                  rounded="lg"
                  cursor="pointer"
                  onClick={() => setImagenAmpliada(true)}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Resolución: qué se hizo, cuándo y quién lo resolvió */}
        {cerrado && (
          <Box
            mb="6"
            p="4"
            bg="green.subtle"
            borderWidth="1px"
            borderColor="green.border"
            rounded="lg"
          >
            <Text
              fontSize="md"
              color="green.fg"
              fontWeight="bold"
              display="flex"
              alignItems="center"
              gap="2"
            >
              <LuCircleCheck size={20} aria-hidden />
              Incidente cerrado
            </Text>

            <VStack align="start" gap="2" mt="3">
              <Text fontSize="sm" color="green.fg">
                <strong>Acción correctiva:</strong>{" "}
                {incidente.observacion_cierre ?? "Sin detalle registrado."}
              </Text>
              <Text fontSize="sm" color="green.fg">
                <strong>Fecha de cierre:</strong>{" "}
                {formatoFechaCierre(incidente.fecha_cierre)}
              </Text>
              <Text fontSize="sm" color="green.fg">
                <strong>Responsable de la resolución:</strong>{" "}
                {incidente.responsable_cierre_nombre ??
                  (incidente.responsable_cierre_id
                    ? `Usuario #${incidente.responsable_cierre_id}`
                    : "-")}
              </Text>
            </VStack>
          </Box>
        )}
        </SeccionDetalle>

        <VinculosIncidente incidente={incidente} esAdmin={esAdmin} />
        <IncidentesRelacionados incidente={incidente} esAdmin={esAdmin} />
        {/* La clave lo vuelve a pedir al cerrar o reabrir: hay un evento nuevo. */}
        <HistorialIncidente
          key={`${incidente.id}-${incidente.estado}-${incidente.fecha_cierre}`}
          incidente={incidente}
        />
      </PaginaDetalle>

      {/* Imagen ampliada */}
      {imagenAmpliada && imagen.src && (
        <VisorFoto
          src={imagen.src}
          alt="Evidencia ampliada"
          onClose={() => setImagenAmpliada(false)}
        />
      )}

      {/* Modal para cerrar incidente (solo admin) */}
      <CerrarIncidenteDialog
        isOpen={modalCerrarAbierto}
        incidente={incidente}
        isLoading={cerrando}
        error={errorCierre}
        onClose={() => {
          if (!cerrando) setModalCerrarAbierto(false);
        }}
        onConfirm={handleCerrarIncidente}
      />
    </>
  );
}
