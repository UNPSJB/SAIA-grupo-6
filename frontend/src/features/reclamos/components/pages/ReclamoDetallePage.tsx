import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Image, Stack, Text } from "@chakra-ui/react";
import { LuCircleCheck, LuRotateCcw } from "react-icons/lu";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { puedeAdministrar } from "../../../../common/api/permissions";
import {
  BannerError,
  BotonGuardar,
  BotonTexto,
  EstadoCargando,
  EtiquetaEstado,
} from "../../../../components/ui/patrones";
import { ModalIniciarRetiro } from "../../../retiros/components/ModalIniciarRetiro";
import {
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";
import { VisorFoto } from "../../../../components/ui/VisorFoto";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import { useAuth } from "../../../../common/context/useAuth";
import { notificarCambioIncidentes } from "../../../incidente/eventoIncidentes";
import { ReabrirIncidenteDialog } from "../../../incidente/components/ReabrirIncidenteDialog";
import { useNotificacionesListener } from "../../../notificaciones/hooks/useNotificacionesListener";
import { useReclamo } from "../../hooks/useReclamo";
import { reabrirReclamo } from "../../services/reclamoService";
import { ModalCerrarReclamo } from "../ModalCerrarReclamo";
import { BadgePlazo, BadgePrioridad } from "../ReclamosTable";

/**
 * Ficha completa de un reclamo de cliente: los datos heredados de la entrega,
 * el plazo con el que se registró (guardado, no recalculado), la evidencia y el
 * incidente asociado con su resolución. El reclamo se cierra y se reabre acá.
 */
export function ReclamoDetallePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const reclamoId = Number(id);
  const idValido = Number.isFinite(reclamoId) ? reclamoId : null;
  const { user } = useAuth();
  const { reclamo, loading, error, recargar } = useReclamo(idValido);
  const { notificarCambio } = useNotificacionesListener();
  const esAdmin = puedeAdministrar(user);
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [modalRetirar, setModalRetirar] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [modalReabrir, setModalReabrir] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);
  const [errorReabrir, setErrorReabrir] = useState<string | null>(null);

  // El cambio también mueve el incidente y sus alertas.
  const alCambiarEstado = async () => {
    setModalCerrar(false);
    setModalReabrir(false);
    notificarCambioIncidentes();
    notificarCambio();
    await recargar();
  };

  const handleReabrir = async (motivo: string) => {
    if (idValido === null) return;
    setReabriendo(true);
    setErrorReabrir(null);
    try {
      await reabrirReclamo(idValido, motivo);
    } catch (err) {
      setErrorReabrir(err instanceof Error ? err.message : "No se pudo reabrir el reclamo.");
      return;
    } finally {
      setReabriendo(false);
    }
    await alCambiarEstado();
  };

  // El hook va antes de los early returns: si no, cambia la cantidad de hooks
  // entre renders cuando la carga termina.
  const imagen = useImagenAutenticada(reclamo?.incidente?.foto_url);

  if (loading) {
    return (
      <PaginaDetalle volver={{ a: "/incidentes?tab=reclamos", etiqueta: "Reclamos" }} titulo="Reclamo">
        <EstadoCargando>Cargando reclamo...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !reclamo) {
    return (
      <PaginaDetalle volver={{ a: "/incidentes?tab=reclamos", etiqueta: "Reclamos" }} titulo="Reclamo">
        <BannerError>{error || "No se encontró el reclamo"}</BannerError>
      </PaginaDetalle>
    );
  }

  const cerrado = reclamo.incidente_estado === "cerrado";

  return (
    <>
      <PaginaDetalle
        volver={{ a: "/incidentes?tab=reclamos", etiqueta: "Reclamos" }}
        titulo={`Reclamo de ${reclamo.cliente_nombre}`}
        descripcion={`Registrado el ${formatoFecha(reclamo.fecha_reclamo)} · Lote ${reclamo.lote_numero}`}
        estado={
          <EtiquetaEstado tono={cerrado ? "ok" : "alerta"}>
            {cerrado ? "Cerrado" : "Abierto"}
          </EtiquetaEstado>
        }
        acciones={
          <>
            {/* Un lote admite un solo retiro: si ya existe se muestra, no se ofrece otro. */}
            {reclamo.retiro ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/retiros/${reclamo.retiro!.id}`)}
              >
                Ver retiro #{reclamo.retiro.id} (
                {reclamo.retiro.estado === "CERRADO" ? "cerrado" : "en curso"})
              </Button>
            ) : !cerrado && reclamo.lote_id && esAdmin ? (
              <Button
                size="sm"
                variant="surface"
                colorPalette="red"
                onClick={() => {
                  setModalRetirar(true);
                }}
                title={`Abre el retiro del lote ${reclamo.lote_numero} del mercado, con el motivo "Reclamos de clientes" preseleccionado.`}
              >
                Iniciar retiro del lote
              </Button>
            ) : null}
            {esAdmin &&
              reclamo.incidente &&
              (cerrado ? (
                <Button
                  size="sm"
                  variant="surface"
                  colorPalette="orange"
                  onClick={() => {
                    setErrorReabrir(null);
                    setModalReabrir(true);
                  }}
                >
                  <LuRotateCcw aria-hidden />
                  Reabrir reclamo
                </Button>
              ) : (
                <BotonGuardar type="button" size="sm" onClick={() => setModalCerrar(true)}>
                  <LuCircleCheck aria-hidden />
                  Cerrar reclamo
                </BotonGuardar>
              ))}
          </>
        }
      >
        {/* Secciones apiladas a todo el ancho: lado a lado, la columna del
            reclamo quedaba con más de la mitad vacía. Iniciar el retiro del
            lote es una acción: va en el encabezado. */}
        <Stack gap="6">
          <SeccionDetalle titulo="Datos del reclamo">
            <GrillaDatos>
              <DatoDetalle etiqueta="Cliente">
                {reclamo.cliente_nombre}
              </DatoDetalle>
              <DatoDetalle etiqueta="Lote">
                <BotonTexto
                  onClick={() => navigate(`/lotes/${reclamo.lote_id}`)}
                  title="Ver ficha del lote"
                >
                  {reclamo.lote_numero}
                </BotonTexto>
              </DatoDetalle>
              <DatoDetalle etiqueta="Entrega original">
                <BotonTexto
                  onClick={() => navigate(`/salidas/${reclamo.salida_id}/detalle`)}
                  title="Ver la salida/entrega original"
                >
                  Ver entrega de {formatoFecha(reclamo.fecha_entrega)}
                </BotonTexto>
              </DatoDetalle>
              <DatoDetalle etiqueta="Fecha de entrega">
                {formatoFecha(reclamo.fecha_entrega)}
              </DatoDetalle>
              <DatoDetalle etiqueta="Fecha del reclamo">
                {formatoFecha(reclamo.fecha_reclamo)}
              </DatoDetalle>
              <DatoDetalle etiqueta="Plazo">
                <BadgePlazo
                  dias={reclamo.dias_desde_entrega}
                  fueraDePlazo={reclamo.fuera_de_plazo}
                />
              </DatoDetalle>
              <DatoDetalle etiqueta="Motivo">
                <Stack gap="2" align="flex-start">
                  <Text>{reclamo.motivo_label}</Text>
                  <BadgePrioridad motivo={reclamo.motivo} />
                </Stack>
              </DatoDetalle>
              <DatoDetalle etiqueta="Registrado por">
                {reclamo.registrado_por_nombre ?? "-"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Fecha de registro">
                {formatoFechaHora(reclamo.fecha_registro)}
              </DatoDetalle>
              <Box gridColumn="1 / -1">
                <DatoDetalle etiqueta="Detalle">
                  <Text whiteSpace="pre-line">
                    {reclamo.detalle?.trim() || "Sin detalle adicional."}
                  </Text>
                </DatoDetalle>
              </Box>
            </GrillaDatos>

            {reclamo.fuera_de_plazo && (
              <Text mt="4" fontSize="sm" color="orange.fg">
                Este reclamo se registró fuera del plazo de referencia de{" "}
                {reclamo.plazo_referencia_dias} días (pasaron{" "}
                {reclamo.dias_desde_entrega} días desde la entrega). El plazo no
                bloquea el registro: queda marcado para el seguimiento.
              </Text>
            )}
          </SeccionDetalle>

          <SeccionDetalle titulo="Entrega asociada">
            <GrillaDatos>
              <DatoDetalle etiqueta="Producto">
                {reclamo.salida.producto_nombre}
              </DatoDetalle>
              <DatoDetalle etiqueta="Lote">
                {reclamo.salida.lote_numero}
              </DatoDetalle>
              <DatoDetalle etiqueta="Cantidad">
                {/* El backend ya la manda formateada ("0,749"): parsearla daba NaN. */}
                {[reclamo.salida.cantidad, reclamo.salida.unidad_medida].filter(Boolean).join(" ")}
              </DatoDetalle>
              <DatoDetalle etiqueta="Fecha de despacho">
                {formatoFecha(reclamo.salida.fecha_despacho)}
              </DatoDetalle>
            </GrillaDatos>
            <Box mt="4">
              <BotonTexto
                onClick={() => navigate(`/salidas/${reclamo.salida_id}/detalle`)}
              >
                Ver la salida completa
              </BotonTexto>
            </Box>
          </SeccionDetalle>

          {imagen.src && (
            <SeccionDetalle titulo="Evidencia fotográfica">
              <Box
                display="flex"
                justifyContent="center"
                p="4"
                bg="bg.subtle"
                rounded="lg"
                borderWidth="1px"
                borderColor="border"
              >
                <Image
                  src={imagen.src}
                  alt="Evidencia del reclamo"
                  w="100%"
                  maxH="400px"
                  objectFit="contain"
                  rounded="lg"
                  cursor="pointer"
                  onClick={() => setImagenAmpliada(true)}
                />
              </Box>
            </SeccionDetalle>
          )}

          <SeccionDetalle titulo="Incidente asociado">
            {reclamo.incidente ? (
              <Stack gap="4">
                <GrillaDatos>
                  <DatoDetalle etiqueta="Incidente">
                    <BotonTexto
                      onClick={() =>
                        navigate(`/incidentes/${reclamo.incidente!.id}`)
                      }
                    >
                      Incidente #{reclamo.incidente.id}
                    </BotonTexto>
                  </DatoDetalle>
                  <DatoDetalle etiqueta="Estado">
                    <EtiquetaEstado tono={cerrado ? "ok" : "alerta"}>
                      {cerrado ? "Cerrado" : "Abierto"}
                    </EtiquetaEstado>
                  </DatoDetalle>
                  {cerrado && (
                    <>
                      <DatoDetalle etiqueta="Acción correctiva">
                        {reclamo.incidente.observacion_cierre ??
                          "Sin detalle registrado."}
                      </DatoDetalle>
                      <DatoDetalle etiqueta="Fecha de cierre">
                        {formatoFechaHora(reclamo.incidente.fecha_cierre)}
                      </DatoDetalle>
                      <DatoDetalle etiqueta="Responsable de la resolución">
                        {reclamo.incidente.responsable_cierre_nombre ?? "-"}
                      </DatoDetalle>
                    </>
                  )}
                </GrillaDatos>
              </Stack>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                El reclamo no tiene un incidente asociado.
              </Text>
            )}
          </SeccionDetalle>
        </Stack>
      </PaginaDetalle>

      {imagenAmpliada && imagen.src && (
        <VisorFoto
          src={imagen.src}
          alt="Evidencia ampliada del reclamo"
          onClose={() => setImagenAmpliada(false)}
        />
      )}

      <ModalCerrarReclamo
        reclamo={modalCerrar ? reclamo : null}
        onClose={() => setModalCerrar(false)}
        onCerrado={() => void alCambiarEstado()}
      />

      <ReabrirIncidenteDialog
        isOpen={modalReabrir}
        entidad="reclamo"
        incidente={{ id: reclamo.id }}
        isLoading={reabriendo}
        error={errorReabrir}
        onClose={() => setModalReabrir(false)}
        onConfirm={(motivo) => void handleReabrir(motivo)}
      />

      <ModalIniciarRetiro
        isOpen={modalRetirar}
        loteIdInicial={reclamo.lote_id}
        reclamoIdInicial={reclamo.id}
        onClose={() => setModalRetirar(false)}
        onRetiroIniciado={() => {
          setModalRetirar(false);
        }}
      />
    </>
  );
}
