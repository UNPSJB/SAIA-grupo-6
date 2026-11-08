import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  EstadoCargando,
  PageHeader,
} from "../../../../components/ui/patrones";
import { listarUnidadesMedida } from "../../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../../unidadMedida/types/unidadMedida";
import { useInsumosParaReceta } from "../../hooks/useRecetas";
import { crearVersion, obtenerReceta, obtenerVersion } from "../../services/recetaService";
import type { VersionInput } from "../../types/receta";
import { desdeDetalle } from "../../utils/versionForm";
import { RecetaVersionForm } from "../RecetaVersionForm";

export function RecetaNuevaVersionPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const recetaId = Number(id);
  const volver = `/recetas/${recetaId}`;

  const { registro: receta, loading: cargandoReceta, error: errorReceta } = useRegistro({
    cargar: obtenerReceta,
    id: Number.isFinite(recetaId) ? recetaId : null,
    etiqueta: "la receta",
  });
  const { registro: vigente, loading: cargandoVersion, error: errorVersion } = useRegistro({
    cargar: obtenerVersion,
    id: receta?.version_vigente?.id ?? null,
    etiqueta: "la versión vigente",
  });
  const { insumos, loading: cargandoInsumos, error: errorInsumos } = useInsumosParaReceta();
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    listarUnidadesMedida(false).then(setUnidades).catch(console.error);
  }, []);

  const guardar = async (datos: VersionInput) => {
    setGuardando(true);
    setError(null);
    try {
      await crearVersion(recetaId, datos);
      setExito(true);
      delayedNavigate(volver);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la versión.");
    } finally {
      setGuardando(false);
    }
  };

  const cargando = cargandoReceta || cargandoVersion || cargandoInsumos;
  const fallo = errorReceta ?? errorVersion ?? errorInsumos;

  return (
    <Box p="5" maxW="960px" mx="auto">
      <PageHeader
        title={receta ? `Nueva versión de ${receta.producto_nombre}` : "Nueva versión"}
        description="Parte de la versión vigente. Al guardar se crea la versión siguiente; la actual queda de solo lectura."
        actions={<BotonVolver onClick={() => navigate(volver)}>Volver a la receta</BotonVolver>}
      />

      {error && <BannerError>{error}</BannerError>}
      {fallo && <BannerError>{fallo}</BannerError>}
      {cargando && <EstadoCargando>Cargando receta...</EstadoCargando>}

      {!cargando && !fallo && vigente && (
        <RecetaVersionForm
          key={vigente.id}
          titulo={`Versión ${vigente.numero + 1}`}
          inicial={desdeDetalle(vigente)}
          insumos={insumos}
          unidades={unidades}
          onSubmit={guardar}
          isLoading={guardando}
          submitLabel="Guardar nueva versión"
          onCancel={() => navigate(volver)}
        />
      )}

      <DialogoExito isOpen={exito} mensaje="Nueva versión guardada correctamente." />
    </Box>
  );
}
