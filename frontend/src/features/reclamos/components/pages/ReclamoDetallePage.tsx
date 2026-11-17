import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Image, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import { puedeAdministrar } from "../../../../common/api/permissions";
import {
  BannerError,
  BotonTexto,
  EstadoCargando,
  EtiquetaEstado,
} from "../../../../components/ui/patrones";
import { ModalIniciarRetiro } from "../../../retiros/components/ModalIniciarRetiro";
import {
  DatoDetalle,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";
import { VisorFoto } from "../../../../components/ui/VisorFoto";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import { useAuth } from "../../../../common/context/useAuth";
import { useReclamo } from "../../hooks/useReclamo";
import { BadgePlazo, BadgePrioridad } from "../ReclamosTable";

/**
 * Ficha completa de un reclamo de cliente: los datos heredados de la entrega,
 * el plazo con el que se registró (guardado, no recalculado), la evidencia y el
 * incidente abierto en E6 con su resolución.
 */
export function ReclamoDetallePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const reclamoId = Number(id);
  const idValido = Number.isFinite(reclamoId) ? reclamoId : null;
  const { user } = useAuth();
  const { reclamo, loading, error } = useReclamo(idValido);
  const esAdmin = puedeAdministrar(user);
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [modalRetirar, setModalRetirar] = useState(false);

  // El hook va antes de los early returns: si no, cambia la cantidad de hooks
  // entre renders cuando la carga termina.
  const imagen = useImagenAutenticada(reclamo?.incidente?.foto_url);

  if (loading) {
    return (
      <PaginaDetalle volver={{ a: "/reclamos", etiqueta: "Reclamos" }} titulo="Reclamo">
        <EstadoCargando>Cargando reclamo...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !reclamo) {
    return (
      <PaginaDetalle volver={{ a: "/reclamos", etiqueta: "Reclamos" }} titulo="Reclamo">
        <BannerError>{error || "No se encontró el reclamo"}</BannerError>
      </PaginaDetalle>
    );
  }

  const cerrado = reclamo.incidente_estado === "cerrado";

  return (
    <>
      <PaginaDetalle
        volver={{ a: "/reclamos", etiqueta: "Reclamos" }}
        titulo={`Reclamo de ${reclamo.cliente_nombre}`}
        descripcion={`Registrado el ${formatoFecha(reclamo.fecha_reclamo)} · Lote ${reclamo.lote_numero}`}
        estado={
          <EtiquetaEstado tono={cerrado ? "ok" : "alerta"}>
            {cerrado ? "Cerrado" : "Abierto"}
          </EtiquetaEstado>
        }
      >
        <Stack gap="6">
          <SeccionDetalle titulo="Datos del reclamo">
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
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
            </SimpleGrid>

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
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap="6">
              <DatoDetalle etiqueta="Producto">
                {reclamo.salida.producto_nombre}
              </DatoDetalle>
              <DatoDetalle etiqueta="Lote">
                {reclamo.salida.lote_numero}
              </DatoDetalle>
              <DatoDetalle etiqueta="Cantidad">
                {cantidadConUnidad(
                  reclamo.salida.cantidad,
                  reclamo.salida.unidad_medida
                )}
              </DatoDetalle>
              <DatoDetalle etiqueta="Fecha de despacho">
                {formatoFecha(reclamo.salida.fecha_despacho)}
              </DatoDetalle>
            </SimpleGrid>
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
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="6">
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
                </SimpleGrid>
                {!cerrado && (
                  <Text fontSize="sm" color="fg.muted">
                    El incidente se cierra desde Gestión de incidentes (E6) con
                    la acción correctiva.
                  </Text>
                )}
              </Stack>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                El reclamo no tiene un incidente asociado.
              </Text>
            )}
          </SeccionDetalle>

          {!cerrado && reclamo.lote_id && esAdmin && (
            <SeccionDetalle sinMarco titulo="Retiro del lote">
              <Button
                colorPalette="red"
                onClick={() => {
                  setModalRetirar(true);
                }}
              >
                Iniciar retiro del lote
              </Button>
              <Text fontSize="xs" color="fg.muted" mt="2">
                Abrirá el modal para retirar el lote {reclamo.lote_numero} del
                mercado, con el motivo "Reclamos de clientes" preseleccionado.
              </Text>
            </SeccionDetalle>
          )}
        </Stack>
      </PaginaDetalle>

      {imagenAmpliada && imagen.src && (
        <VisorFoto
          src={imagen.src}
          alt="Evidencia ampliada del reclamo"
          onClose={() => setImagenAmpliada(false)}
        />
      )}

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
