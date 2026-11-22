import { useCallback } from "react";
import { Stack, Text } from "@chakra-ui/react";
import { useLista } from "../../../common/hooks/useLista";
import { SeccionDetalle } from "../../../components/ui/plantillas";
import { BannerError, EstadoCargando } from "../../../components/ui/patrones";
import { obtenerAlergenosDeProducto } from "../services/alergenoService";
import type { AlergenoDeProducto, AlergenosDeProducto } from "../types/alergeno";

function Lista({ titulo, items }: { titulo: string; items: AlergenoDeProducto[] }) {
  if (items.length === 0) return null;
  return (
    <Stack gap="1">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
        {titulo}
      </Text>
      {items.map((a) => (
        <Text key={a.alergeno_id} fontSize="sm">
          {a.nombre}{" "}
          <Text as="span" color="fg.muted" fontSize="xs">
            ({a.ingredientes.join(", ")})
          </Text>
        </Text>
      ))}
    </Stack>
  );
}

/** Alérgenos del producto, calculados desde los ingredientes de su receta vigente. */
export function AlergenosDelProducto({ productoId }: { productoId: number }) {
  const cargar = useCallback(() => obtenerAlergenosDeProducto(productoId), [productoId]);
  const { items, loading, error } = useLista<AlergenosDeProducto | null>({
    cargar,
    dependencias: [productoId],
    valorInicial: null,
    mensajeError: "No se pudieron cargar los alérgenos.",
  });

  return (
    <SeccionDetalle titulo="Alérgenos" mb="0">
      {loading && <EstadoCargando>Cargando alérgenos...</EstadoCargando>}
      {error && <BannerError mb="0">{error}</BannerError>}
      {!loading && !error && items && (
        <Stack gap="4">
          {items.leyenda ? (
            <Text fontSize="sm" fontWeight="medium">{items.leyenda}</Text>
          ) : (
            <Text fontSize="sm" color="fg.muted">
              Ningún ingrediente de la receta tiene alérgenos cargados.
            </Text>
          )}
          <Lista titulo="Contiene" items={items.contiene} />
          <Lista titulo="Puede contener" items={items.puede_contener} />
          <Text fontSize="xs" color="fg.subtle">
            Sale de los alérgenos de cada ingrediente (ficha del ingrediente).
          </Text>
        </Stack>
      )}
    </SeccionDetalle>
  );
}
