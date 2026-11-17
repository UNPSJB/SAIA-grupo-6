import { useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Box, Button, HStack, SimpleGrid, Table, Text, VStack } from "@chakra-ui/react";
import { LuCircleCheck, LuDownload, LuFileBadge, LuMinus } from "react-icons/lu";
import { useTransportista } from "../../hooks/useTransportista";
import { useCertificaciones } from "../../hooks/useCertificaciones";
import {
  BannerError,
  BotonTexto,
  EstadoCargando,
  EtiquetaEstado,
  type TonoEstado,
} from "../../../../components/ui/patrones";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { formatoFecha, formatoFechaHora, hoyISO } from "../../../../common/utils/fechas";
import {
  descargarArchivoCertificacion,
  verArchivoCertificacion,
} from "../../services/certificacionService";
import type {
  CertificacionTransportista,
  EstadoCertificacion,
  EstadoHabilitacion,
} from "../../types/certificacion";
import { ModalNuevaCertificacion } from "../ModalNuevaCertificacion";
import { ModalAnularCertificacion } from "../ModalAnularCertificacion";

const TONO_HABILITACION: Record<EstadoHabilitacion, TonoEstado> = {
  Habilitado: "ok",
  "Certificación vencida": "peligro",
  "Sin certificaciones": "neutro",
};

const TONO_ESTADO_CERTIFICACION: Record<EstadoCertificacion, TonoEstado> = {
  Vigente: "ok",
  Vencida: "peligro",
  Reemplazada: "neutro",
  Anulada: "neutro",
};

/** Etiqueta visual opcional: vence hoy o dentro de los próximos 15 días. */
function estaPorVencer(fechaVencimiento: string): boolean {
  const hoy = new Date(`${hoyISO()}T00:00:00`);
  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`);
  const dias = Math.round(
    (vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );
  return dias >= 0 && dias <= 15;
}

/** Ver y descargar el comprobante adjunto, o un guion si no tiene archivo. */
function AccionesComprobante({
  certificacion,
}: {
  certificacion: CertificacionTransportista;
}) {
  if (!certificacion.archivo_url) {
    return (
      <Text fontSize="xs" color="fg.muted">
        -
      </Text>
    );
  }

  return (
    <HStack gap="3" justify="center" flexWrap="wrap">
      <BotonTexto
        onClick={() => void verArchivoCertificacion(certificacion.id)}
        title="Abrir el comprobante en una pestaña nueva"
      >
        Ver
      </BotonTexto>
      <BotonTexto
        onClick={() =>
          void descargarArchivoCertificacion(
            certificacion.id,
            certificacion.archivo_url,
          )
        }
        title="Descargar el comprobante adjunto"
      >
        <LuDownload size={14} aria-hidden /> Descargar
      </BotonTexto>
    </HStack>
  );
}

function TablaCertificaciones({
  certificaciones,
  historial = false,
  onRenovar,
  onAnular,
}: {
  certificaciones: CertificacionTransportista[];
  historial?: boolean;
  onRenovar?: (certificacion: CertificacionTransportista) => void;
  onAnular?: (certificacion: CertificacionTransportista) => void;
}) {
  return (
    <Table.Root variant="outline" w="100%">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader px="4" py="3">Tipo</Table.ColumnHeader>
          <Table.ColumnHeader px="4" py="3">Número</Table.ColumnHeader>
          <Table.ColumnHeader px="4" py="3">Emisión</Table.ColumnHeader>
          <Table.ColumnHeader px="4" py="3">Vencimiento</Table.ColumnHeader>
          <Table.ColumnHeader px="4" py="3" textAlign="center">
            Estado
          </Table.ColumnHeader>
          <Table.ColumnHeader px="4" py="3" textAlign="center">
            Comprobante
          </Table.ColumnHeader>
          {!historial && (
            <Table.ColumnHeader px="4" py="3" textAlign="center">
              Acciones
            </Table.ColumnHeader>
          )}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {certificaciones.map((certificacion) => (
          <Table.Row key={certificacion.id} opacity={historial ? 0.75 : 1}>
            <Table.Cell px="4" py="3">
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {certificacion.tipo}
              </Text>
            </Table.Cell>
            <Table.Cell px="4" py="3">
              <Text fontSize="sm" color="fg">
                {certificacion.numero}
              </Text>
            </Table.Cell>
            <Table.Cell px="4" py="3">
              <Text fontSize="sm" color="fg">
                {formatoFecha(certificacion.fecha_emision)}
              </Text>
            </Table.Cell>
            <Table.Cell px="4" py="3">
              <Text fontSize="sm" color="fg">
                {formatoFecha(certificacion.fecha_vencimiento)}
              </Text>
            </Table.Cell>
            <Table.Cell px="4" py="3" textAlign="center">
              <VStack gap="1">
                <EtiquetaEstado
                  tono={TONO_ESTADO_CERTIFICACION[certificacion.estado] ?? "neutro"}
                >
                  {certificacion.estado}
                </EtiquetaEstado>
                {certificacion.estado === "Vigente" &&
                  estaPorVencer(certificacion.fecha_vencimiento) && (
                    <EtiquetaEstado tono="alerta">Por vencer</EtiquetaEstado>
                  )}
                {certificacion.estado === "Anulada" &&
                  certificacion.motivo_anulacion && (
                    <Text fontSize="xs" color="fg.muted" maxW="180px">
                      {certificacion.motivo_anulacion}
                    </Text>
                  )}
              </VStack>
            </Table.Cell>
            <Table.Cell px="4" py="3" textAlign="center">
              <AccionesComprobante certificacion={certificacion} />
            </Table.Cell>
            {!historial && (
              <Table.Cell px="4" py="3" textAlign="center">
                <HStack justify="center" gap="3" flexWrap="wrap">
                  {certificacion.activa && onRenovar && (
                    <BotonTexto onClick={() => onRenovar(certificacion)}>
                      Renovar
                    </BotonTexto>
                  )}
                  {certificacion.activa && onAnular && (
                    <BotonTexto
                      color="red.fg"
                      onClick={() => onAnular(certificacion)}
                    >
                      Anular
                    </BotonTexto>
                  )}
                </HStack>
              </Table.Cell>
            )}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export function TransportistaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const transportistaId = Number(id);
  const {
    transportista,
    loading,
    error,
    cargarTransportista,
  } = useTransportista(transportistaId);
  const {
    certificaciones,
    loading: cargandoCertificaciones,
    error: errorCertificaciones,
    cargarCertificaciones,
  } = useCertificaciones(transportistaId, true);

  const [modalNueva, setModalNueva] = useState<{ open: boolean; tipo?: string }>({
    open: false,
  });
  const [certificacionAAnular, setCertificacionAAnular] =
    useState<CertificacionTransportista | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const backUrl =
    location.state?.from === "transportistas" ? "/transportistas" : "/transportistas";
  const volver = {
    a: backUrl,
    etiqueta: "Transportistas",
  };

  const recargar = async () => {
    // El estado global de habilitación vive en el transportista; las filas y
    // los estados individuales, en las certificaciones.
    await Promise.all([cargarCertificaciones(), cargarTransportista()]);
  };

  const handleCertificacionCreada = () => {
    setModalNueva({ open: false });
    void recargar();
  };

  const handleAnulada = () => {
    setCertificacionAAnular(null);
    void recargar();
  };

  if (loading) {
    return (
      <PaginaDetalle volver={volver} titulo="Transportista">
        <EstadoCargando>Cargando transportista...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !transportista) {
    return (
      <PaginaDetalle volver={volver} titulo="Transportista">
        <BannerError>{error || "No se encontró el transportista"}</BannerError>
      </PaginaDetalle>
    );
  }

  const certificacionesActivas = certificaciones.filter((cert) => cert.activa);
  const certificacionesHistorial = certificaciones.filter((cert) => !cert.activa);
  const tiposActivos = certificacionesActivas.map((cert) => cert.tipo);

  return (
    <PaginaDetalle
      volver={volver}
      titulo={transportista.razon_social}
      descripcion={`Transportista ${transportista.activo ? "activo" : "dado de baja"}`}
    >
      {/* Sección: Datos principales */}
      <SeccionDetalle titulo="Datos principales">
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Razón Social
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.razon_social}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              CUIT
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.cuit}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Teléfono
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.telefono}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Email
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.email ?? "-"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Domicilio
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.domicilio ?? "-"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Habilitación
            </Text>
            <EtiquetaEstado
              tono={TONO_HABILITACION[transportista.estado_habilitacion] ?? "neutro"}
            >
              {transportista.estado_habilitacion}
            </EtiquetaEstado>
          </Box>
          <Box gridColumn="1 / -1">
            <Text fontSize="xs" color="fg.muted" mb="1">
              Observaciones
            </Text>
            <Text
              fontSize="sm"
              fontWeight="medium"
              color="fg"
              wordBreak="break-word"
              whiteSpace="pre-line"
            >
              {transportista.observaciones ?? "-"}
            </Text>
          </Box>
        </SimpleGrid>
      </SeccionDetalle>

      {/* Sección: Certificaciones y Habilitaciones */}
      <SeccionDetalle
        titulo="Certificaciones y Habilitaciones"
        descripcion="Solo un transportista con certificaciones vigentes puede despachar."
        acciones={
          <Button
            colorPalette="brand"
            size="md"
            onClick={() => setModalNueva({ open: true })}
          >
            <LuFileBadge aria-hidden />
            Nueva certificación
          </Button>
        }
      >
        <HStack mb="4" gap="2" flexWrap="wrap">
          <Text fontSize="sm" color="fg.muted">
            Estado de habilitación:
          </Text>
          <EtiquetaEstado
            tono={TONO_HABILITACION[transportista.estado_habilitacion] ?? "neutro"}
          >
            {transportista.estado_habilitacion}
          </EtiquetaEstado>
        </HStack>

        {cargandoCertificaciones && (
          <EstadoCargando>Cargando certificaciones...</EstadoCargando>
        )}

        {!cargandoCertificaciones && errorCertificaciones && (
          <BannerError>{errorCertificaciones}</BannerError>
        )}

        {!cargandoCertificaciones &&
          !errorCertificaciones &&
          certificacionesActivas.length === 0 && (
            <Text color="fg.muted" fontSize="sm">
              Este transportista no tiene certificaciones activas.
            </Text>
          )}

        {!cargandoCertificaciones &&
          !errorCertificaciones &&
          certificacionesActivas.length > 0 && (
            <TablaCertificaciones
              certificaciones={certificacionesActivas}
              onRenovar={(certificacion) =>
                setModalNueva({ open: true, tipo: certificacion.tipo })
              }
              onAnular={setCertificacionAAnular}
            />
          )}

        {!cargandoCertificaciones &&
          !errorCertificaciones &&
          certificacionesHistorial.length > 0 && (
            <Box mt="5">
              <BotonTexto onClick={() => setMostrarHistorial((visible) => !visible)}>
                {mostrarHistorial
                  ? "Ocultar historial"
                  : `Ver historial (${certificacionesHistorial.length})`}
              </BotonTexto>

              {mostrarHistorial && (
                <Box mt="4">
                  <TablaCertificaciones
                    certificaciones={certificacionesHistorial}
                    historial
                  />
                </Box>
              )}
            </Box>
          )}
      </SeccionDetalle>

      {/* Sección: Información del sistema */}
      <SeccionDetalle titulo="Información del sistema">
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Estado
            </Text>
            <Box display="flex" alignItems="center" gap="2">
              {transportista.activo ? (
                <LuCircleCheck size={14} color="green.fg" aria-hidden />
              ) : (
                <LuMinus size={14} color="gray.fg" aria-hidden />
              )}
              <Text
                fontSize="sm"
                fontWeight="medium"
                color={transportista.activo ? "green.fg" : "gray.fg"}
              >
                {transportista.activo ? "Activo" : "Inactivo"}
              </Text>
            </Box>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Fecha de creación
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {formatoFechaHora(transportista.fecha_creacion)}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Última actualización
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {formatoFechaHora(transportista.fecha_actualizacion)}
            </Text>
          </Box>
        </SimpleGrid>
      </SeccionDetalle>

      <ModalNuevaCertificacion
        isOpen={modalNueva.open}
        transportistaId={transportista.id}
        transportistaNombre={transportista.razon_social}
        tipoInicial={modalNueva.tipo}
        tipoBloqueado={modalNueva.tipo !== undefined}
        tiposActivos={tiposActivos}
        onClose={() => setModalNueva({ open: false })}
        onCertificacionCreada={handleCertificacionCreada}
      />

      <ModalAnularCertificacion
        isOpen={certificacionAAnular !== null}
        certificacion={certificacionAAnular}
        onClose={() => setCertificacionAAnular(null)}
        onAnulada={handleAnulada}
      />
    </PaginaDetalle>
  );
}
