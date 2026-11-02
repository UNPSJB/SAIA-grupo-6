import { useNavigate, useParams } from "react-router-dom";
import { Box, Stack, Text } from "@chakra-ui/react";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonVolver,
  EstadoCargando,
  PageHeader,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../../components/ui/patrones";
import { useInsumosDisponibles, useLote } from "../../hooks/useLotes";
import { AsociarInsumos } from "../AsociarInsumos";

const ESTADOS_CERRADOS = ["Finalizado", "Cancelado"];

export function LoteAsociarInsumosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loteId = Number(id);
  const { lote, loading, error } = useLote(loteId);
  const {
    insumos,
    loading: cargandoInsumos,
    error: errorInsumos,
  } = useInsumosDisponibles();

  if (!Number.isInteger(loteId) || loteId <= 0) {
    return (
      <Box p="5" maxW="760px" mx="auto">
        <BannerError>El lote indicado no es válido.</BannerError>
        <BotonVolver onClick={() => navigate("/lotes")}>
          Volver al historial
        </BotonVolver>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box p="5">
        <EstadoCargando>Cargando lote...</EstadoCargando>
      </Box>
    );
  }

  if (error || !lote) {
    return (
      <Box p="5" maxW="760px" mx="auto">
        <BannerError>{error || "No se encontró el lote"}</BannerError>
        <BotonVolver mt="4" onClick={() => navigate("/lotes")}>
          Volver al historial
        </BotonVolver>
      </Box>
    );
  }

  const cerrado = ESTADOS_CERRADOS.includes(lote.estado);

  return (
    <Box p="5" maxW="760px" mx="auto">
      <PageHeader
        title="Asociar insumos al lote"
        description={`Lote ${lote.codigo_lote} · ${lote.producto_nombre} · ${formatoFecha(lote.fecha_inicio)}`}
      />

      {cerrado ? (
        <>
          <BannerError>
            El lote está {lote.estado.toLowerCase()}; ya no admite nuevos
            insumos.
          </BannerError>

          <TarjetaFormulario>
            <TituloFormulario>Insumos asociados</TituloFormulario>
            {lote.insumos.length === 0 ? (
              <Text fontSize="sm" color="fg.subtle">
                El lote no tiene insumos asociados.
              </Text>
            ) : (
              <Stack gap="1">
                {lote.insumos.map((item) => (
                  <Text key={item.id} fontSize="sm" color="fg.muted">
                    · {item.insumo.nombre}: {item.cantidad}{" "}
                    {item.insumo.unidad_medida.simbolo}
                  </Text>
                ))}
              </Stack>
            )}

            <BotonVolver mt="5" onClick={() => navigate("/lotes")}>
              Volver al historial
            </BotonVolver>
          </TarjetaFormulario>
        </>
      ) : (
        <>
          {cargandoInsumos && (
            <EstadoCargando>Cargando insumos...</EstadoCargando>
          )}

          {!cargandoInsumos && errorInsumos && (
            <>
              <BannerError>{errorInsumos}</BannerError>
              <BotonVolver onClick={() => navigate("/lotes")}>
                Volver al historial
              </BotonVolver>
            </>
          )}

          {!cargandoInsumos && !errorInsumos && (
            <AsociarInsumos
              lote={lote}
              insumos={insumos}
              insumosIniciales={lote.insumos}
              onNuevoLote={() => navigate("/lotes")}
              textoCancelar="Volver al historial"
            />
          )}
        </>
      )}
    </Box>
  );
}
