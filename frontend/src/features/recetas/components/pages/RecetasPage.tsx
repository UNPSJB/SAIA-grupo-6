import { useNavigate } from "react-router-dom";
import { HStack, Table } from "@chakra-ui/react";
import { Pagina } from "../../../../components/ui/plantillas";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { useAuth } from "../../../../common/context/useAuth";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaClickeable,
  FilaEncabezado,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";
import { useRecetas } from "../../hooks/useRecetas";

export function RecetasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const { recetas, loading, error } = useRecetas();

  return (
    <Pagina
      titulo="Recetas"
      descripcion={
          esAdmin
            ? "Cada producto tiene una receta. Al modificarla se crea una versión nueva y las anteriores quedan de solo lectura."
            : "Consultá la versión vigente antes de elaborar y escalala a la cantidad que vas a producir."
        }
      acciones={
        esAdmin ? (
          <BotonAgregar onClick={() => navigate("/recetas/nueva")}>Nueva receta</BotonAgregar>
        ) : undefined
      }
    >
      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando recetas...</EstadoCargando>}

      {!loading && !error && recetas.length === 0 && (
        <EstadoVacio>
          {esAdmin
            ? "Todavía no hay recetas. Creá un producto y armá su receta."
            : "Todavía no hay recetas cargadas."}
        </EstadoVacio>
      )}

      {!loading && !error && recetas.length > 0 && (
        <Tarjeta desplazable>
          <Table.Root variant="outline" w="100%" minW="720px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Producto</EncabezadoOscuro>
                <EncabezadoOscuro ancho="angosta">Versión vigente</EncabezadoOscuro>
                <EncabezadoOscuro numero ancho="amplia">Rendimiento</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Vigente desde</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {recetas.map((receta) => (
                <FilaClickeable onAbrir={() => navigate(`/recetas/${receta.id}`)} key={receta.id}>
                  <Celda>
                    <TextoTruncado texto={receta.producto_nombre} />
                  </Celda>
                  <Celda>{receta.version_vigente ? `v${receta.version_vigente.numero}` : "-"}</Celda>
                  <Celda numero>
                    {receta.version_vigente
                      ? cantidadConUnidad(
                          receta.version_vigente.rendimiento,
                          receta.version_vigente.unidad_medida.simbolo,
                        )
                      : "-"}
                  </Celda>
                  <Celda>{formatoFecha(receta.version_vigente?.creado_en)}</Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      <BotonAccion
                        accion="ver"
                        label="Ver receta vigente"
                        onClick={() => navigate(`/recetas/${receta.id}`)}
                      />
                      {receta.version_vigente && (
                        <BotonAccion
                          accion="escalar"
                          label="Escalar e iniciar lote"
                          onClick={() => navigate(`/lotes/nuevo?receta=${receta.id}`)}
                        />
                      )}
                    </HStack>
                  </Celda>
                </FilaClickeable>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}
    </Pagina>
  );
}
