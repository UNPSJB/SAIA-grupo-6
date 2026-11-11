import { useParams } from "react-router-dom";
import { SimpleGrid, Stack } from "@chakra-ui/react";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { BannerError, EstadoCargando, Tarjeta } from "../../../../components/ui/patrones";
import { obtenerComposicion } from "../../services/recetaService";
import { GraficoComposicion } from "../GraficoComposicion";
import { FaltantesComposicion, ResumenComposicion, TablaComposicion } from "../TablaComposicion";

export function RecetaComposicionPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const id = Number(versionId);

  const { registro: composicion, loading, error } = useRegistro({
    cargar: obtenerComposicion,
    id: Number.isFinite(id) ? id : null,
    etiqueta: "la composición",
  });

  return (
    <PaginaDetalle
      volver={
        composicion
          ? { a: `/recetas/${composicion.receta_id}`, etiqueta: "Receta" }
          : { a: "/recetas", etiqueta: "Recetas" }
      }
      titulo={composicion ? `Composición de ${composicion.producto_nombre}` : "Composición porcentual"}
      descripcion="Porcentaje de cada ingrediente y aditivo sobre el peso total de la formulación."
    >
      {loading && <EstadoCargando>Cargando composición...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {composicion && (
        <SeccionDetalle titulo={`Versión ${composicion.version_numero}`}>
          {composicion.completa ? (
            <Stack gap="6">
              <ResumenComposicion composicion={composicion} />
              <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6" alignItems="start">
                <TablaComposicion composicion={composicion} />
                <Tarjeta p="4">
                  <GraficoComposicion composicion={composicion} />
                </Tarjeta>
              </SimpleGrid>
            </Stack>
          ) : (
            <FaltantesComposicion faltantes={composicion.faltantes} />
          )}
        </SeccionDetalle>
      )}
    </PaginaDetalle>
  );
}