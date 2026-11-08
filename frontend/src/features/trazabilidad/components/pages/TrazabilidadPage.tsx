import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonGuardar,
  EstadoCargando,
  FormField,
  FormNativeSelect,
  PageHeader,
  SelectPlaceholder,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { useLotes } from "../../../lotes/hooks/useLotes";
import { useStockLotes } from "../../../lotesInsumo/hooks/useStockInsumos";

export function TrazabilidadPage() {
  const navigate = useNavigate();
  const { lotes, loading: cargandoLotes, error: errorLotes } = useLotes();
  const { lotes: lotesInsumo, loading: cargandoInsumo, error: errorInsumo } = useStockLotes(
    undefined,
    true,
  );
  const [loteProducto, setLoteProducto] = useState(0);
  const [loteInsumo, setLoteInsumo] = useState(0);

  return (
    <Box p="5" maxW="1000px" mx="auto">
      <PageHeader
        title="Trazabilidad"
        description="Seguí un lote de producto hacia atrás hasta el proveedor de cada insumo, o un lote de insumo hacia adelante hasta los productos que lo usaron."
      />

      {errorLotes && <BannerError>{errorLotes}</BannerError>}
      {errorInsumo && <BannerError>{errorInsumo}</BannerError>}
      {(cargandoLotes || cargandoInsumo) && <EstadoCargando>Cargando lotes...</EstadoCargando>}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="6">
        <Tarjeta p="6">
          <Heading as="h3" size="lg" color="brand.fg" mb="2">
            Hacia atrás
          </Heading>
          <Text fontSize="sm" color="fg.muted" mb="5">
            Dado un lote de producto: receta y versión, quién lo elaboró, tareas, consumos, lotes de
            insumo y proveedores.
          </Text>
          <FormField label="Lote de producto">
            <FormNativeSelect value={loteProducto} onChange={(e) => setLoteProducto(Number(e.target.value))}>
              <SelectPlaceholder>Seleccioná un lote</SelectPlaceholder>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.numero_lote} · {l.producto_nombre} · {formatoFecha(l.fecha_inicio)}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>
          <BotonGuardar
            type="button"
            disabled={!loteProducto}
            onClick={() => navigate(`/trazabilidad/lotes-producto/${loteProducto}`)}
          >
            Ver trazabilidad
          </BotonGuardar>
        </Tarjeta>

        <Tarjeta p="6">
          <Heading as="h3" size="lg" color="brand.fg" mb="2">
            Hacia adelante
          </Heading>
          <Text fontSize="sm" color="fg.muted" mb="5">
            Dado un lote de insumo: los lotes de producto que lo consumieron y cuánto usó cada uno.
          </Text>
          <FormField label="Lote de insumo">
            <FormNativeSelect value={loteInsumo} onChange={(e) => setLoteInsumo(Number(e.target.value))}>
              <SelectPlaceholder>Seleccioná un lote</SelectPlaceholder>
              {lotesInsumo.map((l) => (
                <option key={l.lote_insumo_id} value={l.lote_insumo_id}>
                  {l.insumo_nombre} · lote {l.numero_lote} · {l.proveedor_nombre}
                  {l.activo ? "" : " (baja)"}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>
          <BotonGuardar
            type="button"
            disabled={!loteInsumo}
            onClick={() => navigate(`/trazabilidad/lotes-insumo/${loteInsumo}`)}
          >
            Ver trazabilidad
          </BotonGuardar>
        </Tarjeta>
      </SimpleGrid>
    </Box>
  );
}
