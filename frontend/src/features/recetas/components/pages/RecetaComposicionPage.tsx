import { useParams } from "react-router-dom";
import { SimpleGrid, Stack, Text, Heading } from "@chakra-ui/react";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { BannerError, EstadoCargando, Tarjeta } from "../../../../components/ui/patrones";
import { obtenerComposicion } from "../../services/recetaService";
import { GraficoComposicion } from "../GraficoComposicion";
import { FaltantesComposicion, ResumenComposicion, TablaComposicion } from "../TablaComposicion";
import { GraficoAditivos } from "../GraficoAditivos";

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

                <Stack gap="6">
                  <Tarjeta p="4">
                    <GraficoComposicion composicion={composicion} />
                  </Tarjeta>

                  {composicion.aditivos.length > 0 && (
                    <Tarjeta p="4">
                      <Heading as="h4" size="md" mb="1">Aditivos</Heading>
                      <Text fontSize="sm" color="fg.muted" mb="2">
                        Proporción entre los aditivos. El porcentaje sobre la formulación está en la tabla.
                      </Text>
                      <GraficoAditivos composicion={composicion} />
                    </Tarjeta>
                  )}
                </Stack>
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