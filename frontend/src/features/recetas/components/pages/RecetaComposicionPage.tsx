import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SimpleGrid, Stack, Text, Heading } from "@chakra-ui/react";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { BannerError, EstadoCargando, Tarjeta } from "../../../../components/ui/patrones";
import { obtenerComposicion } from "../../services/recetaService";
import { GraficoComposicion } from "../GraficoComposicion";
import { FaltantesComposicion, ResumenComposicion, TablaComposicion } from "../TablaComposicion";
import { GraficoAditivos } from "../GraficoAditivos";

export function RecetaComposicionPage() {
  const navigate = useNavigate();
  const { id: recetaParam, versionId } = useParams<{ id?: string; versionId: string }>();
  const id = Number(versionId);

  const { registro: composicion, loading, error } = useRegistro({
    cargar: obtenerComposicion,
    id: Number.isFinite(id) ? id : null,
    etiqueta: "la composición",
  });

  // Llegó por la URL vieja (o con otra receta): se pasa a la que cuelga de la receta.
  useEffect(() => {
    if (composicion && String(composicion.receta_id) !== recetaParam) {
      navigate(
        `/recetas/${composicion.receta_id}/versiones/${composicion.version_id}/composicion`,
        { replace: true },
      );
    }
  }, [composicion, recetaParam, navigate]);

  return (
    // Ancho completo y no el de detalle (1024px): tablas y gráficos van lado a
    // lado y en 1024px las tablas quedaban cortadas.
    <PaginaDetalle
      ancho="completo"
      volver={
        composicion
          ? // Vuelve a la misma versión, no a la vigente.
            { a: `/recetas/${composicion.receta_id}?version=${composicion.version_id}`, etiqueta: "Receta" }
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
              {/* Las tablas tienen 4 columnas: se llevan más espacio que los
                  gráficos. Lado a lado recién desde `xl` (1280px): en 1024px la
                  tabla quedaba en ~520px y los encabezados se partían. */}
              <SimpleGrid
                templateColumns={{ base: "minmax(0, 1fr)", xl: "minmax(0, 3fr) minmax(0, 2fr)" }}
                gap="6"
                alignItems="start"
              >
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