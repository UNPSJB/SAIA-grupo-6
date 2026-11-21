import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Heading, HStack, Table, Text } from "@chakra-ui/react";
import { LuArrowLeft, LuPlus } from "react-icons/lu";
import { BotonExportar } from "../../../exportacion";
import { Pagina, PestanasPagina } from "../../../../components/ui/plantillas";
import { TabReglasRotuladoFrontal } from "../../../rotuladoFrontal/components/pages/ReglasRotuladoFrontalPage";
import {
  BannerError,
  BotonAccion,
  BotonFila,
  BotonVolver,
  COLOR_TABLA,
  EstadoCargando,
  EstadoVacio,
  Celda,
  DatoPrincipal,
  FilaClickeable,
  FilaEncabezado,
  EncabezadoOscuro,
  PieTabla,
  PildoraNeutra,
  Tarjeta,
  TarjetaTabla,
} from "../../../../components/ui/patrones";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  chipsDeFiltros,
  type ChipFiltro,
} from "../../../../components/ui/filtros";
import { formatoFechaHora } from "../../../../common/utils/fechas";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import { useLista } from "../../../../common/hooks/useLista";
import { listarProductos } from "../../../productos/services/productoService";
import { listarBorradoresPorProducto } from "../../services/rotuladoService";
import type { Producto } from "../../../productos/types/producto";
import type { BorradorRotuladoOut } from "../../types/rotulado";

interface ProductoConBorradores extends Producto {
  borradores: BorradorRotuladoOut[];
}

/** Pestaña "Rotulado de productos": productos y sus borradores. */
function TabRotulado() {
  const navigate = useNavigate();
  const [errorBorradores, setErrorBorradores] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [productosConBorradores, setProductosConBorradores] = useState<
    ProductoConBorradores[]
  >([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<
    ProductoConBorradores | null
  >(null);

  const cargarProductos = useCallback(
    (): Promise<Producto[]> => listarProductos(false, busquedaAplicada),
    [busquedaAplicada],
  );

  const { items: productos, loading, error } = useLista<Producto[]>({
    cargar: cargarProductos,
    dependencias: [busquedaAplicada],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los productos",
  });

  useEffect(() => {
    let vigente = true;
    async function cargarBorradores() {
      if (productos.length === 0) {
        setProductosConBorradores([]);
        return;
      }
      const resultados = await Promise.all(
        productos.map(async (p) => {
          const borradores = await listarBorradoresPorProducto(p.id);
          return { ...p, borradores };
        }),
      );
      if (vigente) { setProductosConBorradores(resultados); setErrorBorradores(null); }
    }
    void cargarBorradores().catch((err: unknown) => {
      if (vigente) setErrorBorradores(err instanceof Error ? err.message : "Error al consultar borradores");
    });
    return () => { vigente = false; };
  }, [productos]);

  const abrirEdicion = (borradorId: number) => {
    navigate(`/rotulado/borradores/${borradorId}`);
  };

  const crearNuevo = (productoId: number) => {
    navigate(`/rotulado/nuevo/${productoId}`);
  };

  const seleccionarProducto = (producto: ProductoConBorradores) => {
    setProductoSeleccionado(producto);
  };

  const cerrarSeleccion = () => {
    setProductoSeleccionado(null);
  };

  if (loading) {
    return <EstadoCargando pagina>Cargando productos...</EstadoCargando>;
  }

  if (error || errorBorradores) {
    return <BannerError>{error ?? errorBorradores}</BannerError>;
  }

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => {
        setBusqueda("");
      },
    },
  ]);

  return (
    <>
      {productoSeleccionado ? (
        <VistaProductoSeleccionado
          producto={productoSeleccionado}
          onVolver={cerrarSeleccion}
          onCrearBorrador={crearNuevo}
          onEditarBorrador={abrirEdicion}
        />
      ) : (
        <VistaListadoProductos
          productos={productosConBorradores}
          busqueda={busqueda}
          onCambioBusqueda={setBusqueda}
          chips={chips}
          onSeleccionarProducto={seleccionarProducto}
          onCrearBorrador={crearNuevo}
        />
      )}
    </>
  );
}

/**
 * Rotulado de productos, con las reglas de rotulado frontal como sub-opción:
 * antes eran una entrada aparte del menú de Producción. `/rotulado-frontal`
 * redirige a la pestaña.
 */
export function RotuladoPage() {
  return (
    <Pagina
      titulo="Rotulado de productos"
      descripcion="Completá los datos de rotulado de los productos según el Capítulo V del CAA."
    >
      <PestanasPagina
        pestanas={[
          { valor: "productos", etiqueta: "Rotulado de productos", contenido: <TabRotulado /> },
          { valor: "reglas", etiqueta: "Reglas de rotulado frontal", contenido: <TabReglasRotuladoFrontal /> },
        ]}
      />
    </Pagina>
  );
}

function VistaListadoProductos({
  productos,
  busqueda,
  onCambioBusqueda,
  chips,
  onSeleccionarProducto,
  onCrearBorrador,
}: {
  productos: ProductoConBorradores[];
  busqueda: string;
  onCambioBusqueda: (valor: string) => void;
  chips: ChipFiltro[];
  onSeleccionarProducto: (producto: ProductoConBorradores) => void;
  onCrearBorrador: (productoId: number) => void;
}) {
  return (
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={onCambioBusqueda}
            placeholder="Buscar producto por nombre..."
          />
        }
        herramientas={
          <BotonExportar
            nombreTabla="rotulado"
            vista="rotulado"
            filtros={{ buscar: busqueda.trim() || undefined }}
          />
        }
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={() => onCambioBusqueda("")} />

      {productos.length === 0 && (
        <EstadoVacio>
          No hay productos registrados. Creá uno para comenzar.
        </EstadoVacio>
      )}

      {productos.length > 0 && (
        <TablaProductosRotulado
          productos={productos}
          onSeleccionarProducto={onSeleccionarProducto}
          onCrearBorrador={onCrearBorrador}
        />
      )}
    </>
  );
}

/**
 * Productos con sus borradores. Pocas columnas: las cortas (unidad,
 * borradores) llevan ancho propio y la de acciones mide lo justo para sus dos
 * botones, así no queda un hueco entre el nombre y las acciones.
 */
function TablaProductosRotulado({
  productos,
  onSeleccionarProducto,
  onCrearBorrador,
}: {
  productos: ProductoConBorradores[];
  onSeleccionarProducto: (producto: ProductoConBorradores) => void;
  onCrearBorrador: (productoId: number) => void;
}) {
  return (
    <TarjetaTabla
      pie={
        <PieTabla
          count={productos.length}
          unidad={productos.length === 1 ? "producto" : "productos"}
        />
      }
    >
      <Table.Root variant="outline" w="100%" minW="680px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro center width="12%">Unidad</EncabezadoOscuro>
            <EncabezadoOscuro center width="13%">Borradores</EncabezadoOscuro>
            <EncabezadoOscuro width="14%">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {productos.map((producto) => (
            <FilaClickeable
              key={producto.id}
              onAbrir={() => onSeleccionarProducto(producto)}
            >
              <Celda>
                <DatoPrincipal titulo={producto.nombre} />
              </Celda>
              <Celda center>
                <PildoraNeutra>{producto.unidad_medida.simbolo}</PildoraNeutra>
              </Celda>
              <Celda center>
                <BadgeBorradores count={producto.borradores.length} />
              </Celda>
              <Celda>
                {/* Alineadas a la izquierda: "Nuevo borrador" queda siempre en
                    el mismo lugar, haya o no "Ver borradores" al lado. */}
                <HStack gap="2">
                  <BotonAccion
                    accion="agregar"
                    label={`Nuevo borrador de ${producto.nombre}`}
                    tooltip="Nuevo borrador"
                    onClick={() => onCrearBorrador(producto.id)}
                  />
                  {producto.borradores.length > 0 && (
                    <BotonAccion
                      accion="ver"
                      label={`Ver borradores de ${producto.nombre}`}
                      tooltip="Ver borradores"
                      onClick={() => onSeleccionarProducto(producto)}
                    />
                  )}
                </HStack>
              </Celda>
            </FilaClickeable>
          ))}
        </Table.Body>
      </Table.Root>
    </TarjetaTabla>
  );
}

function BadgeBorradores({ count }: { count: number }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      minW="8"
      h="6"
      px="2"
      rounded="full"
      fontSize="xs"
      fontWeight="semibold"
      fontVariantNumeric="tabular-nums"
      bg={count > 0 ? "green.subtle" : COLOR_TABLA.fondoEncabezado}
      color={count > 0 ? "green.fg" : COLOR_TABLA.textoEncabezado}
      borderWidth="1px"
      borderColor={count > 0 ? "green.muted" : COLOR_TABLA.bordeEncabezado}
      aria-label={`${count} borrador${count === 1 ? "" : "es"}`}
    >
      {count}
    </Box>
  );
}

function VistaProductoSeleccionado({
  producto,
  onVolver,
  onCrearBorrador,
  onEditarBorrador,
}: {
  producto: ProductoConBorradores;
  onVolver: () => void;
  onCrearBorrador: (productoId: number) => void;
  onEditarBorrador: (borradorId: number) => void;
}) {
  return (
    <>
      {/* Lo primero de la pestaña es una tarjeta, igual que la barra de
          filtros del listado: la lengüeta de la pestaña se apoya sobre ella.
          "Volver" va acá dentro porque el encabezado de la página es común a
          las dos pestañas. */}
      <Tarjeta p="4" mb="4">
        <HStack justify="space-between" align="center" gap="4" flexWrap="wrap">
          <HStack gap="4" align="center" flexWrap="wrap" minW="0">
            <BotonVolver onClick={onVolver}>
              <LuArrowLeft aria-hidden />
              Volver al listado
            </BotonVolver>
            <Box minW="0">
              <Heading as="h3" size="lg" fontWeight="semibold" color={COLOR_TABLA.textoPrincipal} mb="1">
                {producto.nombre}
              </Heading>
              <HStack gap="2">
                <Text fontSize="sm" color={COLOR_TABLA.textoSecundario}>Unidad</Text>
                <PildoraNeutra>{producto.unidad_medida.simbolo}</PildoraNeutra>
              </HStack>
            </Box>
          </HStack>
          <BotonFila variante="primario" onClick={() => onCrearBorrador(producto.id)}>
            <LuPlus aria-hidden />
            Crear nuevo borrador
          </BotonFila>
        </HStack>
      </Tarjeta>

      {producto.borradores.length === 0 ? (
        <EstadoVacio>
          Este producto no tiene borradores de rotulado. Creá el primero.
        </EstadoVacio>
      ) : (
        <TarjetaTabla
          pie={
            <PieTabla
              count={producto.borradores.length}
              unidad={producto.borradores.length === 1 ? "borrador" : "borradores"}
            />
          }
        >
          <Table.Root variant="outline" w="100%" minW="680px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Borrador</EncabezadoOscuro>
                <EncabezadoOscuro center width="18%">Estado</EncabezadoOscuro>
                <EncabezadoOscuro width="22%">Actualizado</EncabezadoOscuro>
                <EncabezadoOscuro center width="16%">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {producto.borradores.map((b) => (
                <FilaClickeable key={b.id} onAbrir={() => onEditarBorrador(b.id)}>
                  <Celda>
                    <DatoPrincipal titulo={`Borrador #${b.id}`} />
                  </Celda>
                  <Celda center>
                    <PildoraNeutra>{b.estado.replaceAll("_", " ")}</PildoraNeutra>
                  </Celda>
                  <Celda whiteSpace="nowrap">
                    {b.actualizado_en ? formatoFechaHora(b.actualizado_en) : "-"}
                  </Celda>
                  <Celda center>
                    <BotonAccion
                      accion="editar"
                      label={`Editar borrador #${b.id}`}
                      tooltip="Editar"
                      onClick={() => onEditarBorrador(b.id)}
                    />
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
