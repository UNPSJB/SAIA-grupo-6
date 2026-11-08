import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  EstadoCargando,
  FormField,
  FormNativeSelect,
  PageHeader,
  SelectPlaceholder,
} from "../../../../components/ui/patrones";
import { listarProductos } from "../../../productos/services/productoService";
import type { Producto } from "../../../productos/types/producto";
import { listarUnidadesMedida } from "../../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../../unidadMedida/types/unidadMedida";
import { useInsumosParaReceta, useRecetas } from "../../hooks/useRecetas";
import { crearReceta } from "../../services/recetaService";
import type { VersionInput } from "../../types/receta";
import { estadoInicial } from "../../utils/versionForm";
import { RecetaVersionForm } from "../RecetaVersionForm";

export function RecetaCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { insumos, loading: cargandoInsumos, error: errorInsumos } = useInsumosParaReceta();
  const { recetas, loading: cargandoRecetas } = useRecetas();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [productoId, setProductoId] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    listarProductos().then(setProductos).catch((e: unknown) => setError(String(e)));
    listarUnidadesMedida(false).then(setUnidades).catch(console.error);
  }, []);

  // Un producto solo puede tener una receta: los que ya la tienen no se ofrecen.
  const conReceta = new Set(recetas.map((r) => r.producto_id));
  const disponibles = productos.filter((p) => !conReceta.has(p.id));

  const guardar = useCallback(
    async (version: VersionInput) => {
      setGuardando(true);
      setError(null);
      try {
        await crearReceta({ producto_id: productoId, version });
        setExito(true);
        delayedNavigate("/recetas");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear la receta.");
      } finally {
        setGuardando(false);
      }
    },
    [productoId, delayedNavigate],
  );

  const cargando = cargandoInsumos || cargandoRecetas;

  return (
    <Box p="5" maxW="960px" mx="auto">
      <PageHeader
        title="Nueva receta"
        actions={<BotonVolver onClick={() => navigate("/recetas")}>Volver a la lista</BotonVolver>}
      />

      {error && <BannerError>{error}</BannerError>}
      {errorInsumos && <BannerError>{errorInsumos}</BannerError>}
      {cargando && <EstadoCargando>Cargando datos...</EstadoCargando>}

      {!cargando && !errorInsumos && (
        <RecetaVersionForm
          titulo="Receta del producto (versión 1)"
          inicial={estadoInicial()}
          insumos={insumos}
          unidades={unidades}
          onSubmit={guardar}
          isLoading={guardando}
          submitLabel="Crear receta"
          onCancel={() => navigate("/recetas")}
          bloqueado={!productoId}
          encabezado={
            <FormField
              label="Producto"
              required
              helper={
                disponibles.length === 0
                  ? "No hay productos sin receta. Creá primero el producto en Datos maestros."
                  : undefined
              }
            >
              <FormNativeSelect
                value={productoId}
                onChange={(e) => setProductoId(Number(e.target.value))}
                maxW="500px"
              >
                <SelectPlaceholder>Seleccioná un producto</SelectPlaceholder>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>
          }
        />
      )}

      <DialogoExito isOpen={exito} mensaje="Receta creada correctamente." />
    </Box>
  );
}
