import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HStack, Table } from "@chakra-ui/react";
import { BotonExportar } from "../../../exportacion";
import { Pagina, PestanasPagina } from "../../../../components/ui/plantillas";
import { PanelBase, PanelParametros } from "../../../nutricion/components/pages/ParametrosNutricionPage";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { useAuth } from "../../../../common/context/useAuth";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  CantidadConUnidad,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaClickeable,
  FilaEncabezado,
  PieTabla,
  PildoraNeutra,
  TarjetaTabla,
} from "../../../../components/ui/patrones";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import { useRecetas } from "../../hooks/useRecetas";

const PAGE_SIZE = 10;

/** Minúsculas y sin tildes, para buscar "azucar" y encontrar "Azúcar". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}


/** Pestaña "Recetas": el listado de recetas. */
function TabRecetas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const { recetas, loading, error } = useRecetas();
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return texto ? recetas.filter((r) => normalizar(r.producto_nombre).includes(texto)) : recetas;
  }, [recetas, busqueda]);
  const { paginados, page, setPage } = usePaginas(visibles, PAGE_SIZE, busqueda);
  const chips = chipsDeFiltros([
    { clave: "busqueda", etiqueta: "Búsqueda", valor: busqueda, recortar: true, onQuitar: () => setBusqueda("") },
  ]);

  return (
    <>
      <BarraFiltros
        busqueda={<CampoBusqueda valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por producto..." />}
        herramientas={
          esAdmin ? (
            <>
              {/* Dentro de una pestaña, el alta va en la barra. */}
              <BotonAgregar onClick={() => navigate("/recetas/nueva")}>Nueva receta</BotonAgregar>
              <BotonExportar
                nombreTabla="recetas"
                vista="recetas"
                filtros={{ buscar: busqueda.trim() || undefined }}
              />
            </>
          ) : undefined
        }
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={() => setBusqueda("")} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando pagina>Cargando recetas...</EstadoCargando>}
      {!loading && !error && recetas.length > 0 && visibles.length === 0 && (
        <EstadoVacioFiltrado onLimpiar={() => setBusqueda("")}>
          No hay recetas que coincidan con la búsqueda.
        </EstadoVacioFiltrado>
      )}

      {!loading && !error && recetas.length === 0 && (
        <EstadoVacio>
          {esAdmin
            ? "Todavía no hay recetas. Creá un producto y armá su receta."
            : "Todavía no hay recetas cargadas."}
        </EstadoVacio>
      )}

      {!loading && !error && visibles.length > 0 && (
        <TarjetaTabla
          pie={
            <PieTabla
              count={visibles.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              unidad={visibles.length === 1 ? "receta" : "recetas"}
            />
          }
        >
          {/*
            Cuatro columnas cortas con ancho propio y la de acciones justa
            para sus dos botones: el producto se queda con el resto y no queda
            un hueco vacío antes de las acciones.
          */}
          <Table.Root variant="outline" w="100%" minW="720px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Producto</EncabezadoOscuro>
                <EncabezadoOscuro center width="15%">Versión vigente</EncabezadoOscuro>
                <EncabezadoOscuro numero width="17%">Rendimiento</EncabezadoOscuro>
                <EncabezadoOscuro width="15%">Vigente desde</EncabezadoOscuro>
                <EncabezadoOscuro center width="13%">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {paginados.map((receta) => (
                <FilaClickeable onAbrir={() => navigate(`/recetas/${receta.id}`)} key={receta.id}>
                  <Celda>
                    <DatoPrincipal titulo={receta.producto_nombre} />
                  </Celda>
                  <Celda center>
                    {receta.version_vigente ? (
                      <PildoraNeutra mono>v{receta.version_vigente.numero}</PildoraNeutra>
                    ) : (
                      "-"
                    )}
                  </Celda>
                  <Celda numero>
                    {receta.version_vigente ? (
                      <CantidadConUnidad
                        valor={receta.version_vigente.rendimiento}
                        unidad={receta.version_vigente.unidad_medida.simbolo}
                      />
                    ) : (
                      "-"
                    )}
                  </Celda>
                  <Celda whiteSpace="nowrap">{formatoFecha(receta.version_vigente?.creado_en)}</Celda>
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
        </TarjetaTabla>
      )}
    </>
  );
}

/**
 * Recetas, con los parámetros de la tabla nutricional como sub-opciones: antes
 * "Parámetros nutricionales" era una entrada aparte del menú de Producción,
 * aunque solo sirve para calcular la tabla a partir de la receta. Las
 * pestañas extra son de administración; quien opera ve solo el listado.
 * `/nutricion` redirige acá.
 */
export function RecetasPage() {
  const esAdmin = puedeAdministrar(useAuth().user);
  return (
    <Pagina
      titulo="Recetas"
      descripcion={
        esAdmin
          ? "Cada producto tiene una receta. Al modificarla se crea una versión nueva y las anteriores quedan de solo lectura."
          : "Consultá la versión vigente antes de elaborar y escalala a la cantidad que vas a producir."
      }
    >
      {esAdmin ? (
        <PestanasPagina
          pestanas={[
            { valor: "recetas", etiqueta: "Recetas", contenido: <TabRecetas /> },
            { valor: "parametros", etiqueta: "Parámetros nutricionales", contenido: <PanelParametros /> },
            { valor: "base", etiqueta: "Base de composición", contenido: <PanelBase /> },
          ]}
        />
      ) : (
        <TabRecetas />
      )}
    </Pagina>
  );
}
