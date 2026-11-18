import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Table } from "@chakra-ui/react";
import { Pagina } from "../../../../components/ui/plantillas";
import {
  BannerError,
  EstadoCargando,
  EstadoVacio,
  Celda,
  FilaEncabezado,
  EncabezadoOscuro,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";
import { BarraFiltros, CampoBusqueda } from "../../../../components/ui/filtros";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import { useLista } from "../../../../common/hooks/useLista";
import { listarProductos } from "../../../productos/services/productoService";
import { listarBorradoresPorProducto } from "../../services/rotuladoService";
import type { Producto } from "../../../productos/types/producto";
import type { BorradorRotuladoOut } from "../../types/rotulado";

interface ProductoConBorradores extends Producto {
  borradores: BorradorRotuladoOut[];
}

export function RotuladoPage() {
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
    return (
      <Pagina
        titulo="Rotulado de productos"
        descripcion="Listado de productos y sus borradores de rotulado."
      >
        <EstadoCargando>Cargando productos...</EstadoCargando>
      </Pagina>
    );
  }

  if (error || errorBorradores) {
    return (
      <Pagina
        titulo="Rotulado de productos"
        descripcion="Listado de productos y sus borradores de rotulado."
      >
        <BannerError>{error ?? errorBorradores}</BannerError>
      </Pagina>
    );
  }

  const chips = [
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => {
        setBusqueda("");
      },
    },
  ];

  return (
    <Pagina
      titulo="Rotulado de productos"
      descripcion="Completá los datos de rotulado de los productos según el Capítulo V del CAA."
      acciones={
        <>
          {productoSeleccionado && (
            <button
              type="button"
              onClick={cerrarSeleccion}
              style={{
                padding: "0.5rem 1rem",
                background: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "0.25rem",
                cursor: "pointer",
                marginRight: "0.5rem",
              }}
            >
              ← Volver al listado
            </button>
          )}
        </>
      }
    >
      {productoSeleccionado ? (
        <VistaProductoSeleccionado
          producto={productoSeleccionado}
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
  chips: { clave: string; etiqueta: string; valor: string; recortar: boolean; onQuitar: () => void }[];
  onSeleccionarProducto: (producto: ProductoConBorradores) => void;
  onCrearBorrador: (productoId: number) => void;
}) {
  const chipsRender = chips.map((c) => ({
    clave: c.clave,
    etiqueta: c.etiqueta,
    valor: c.valor,
    recortar: c.recortar,
    onQuitar: c.onQuitar,
  }));

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
      />
      {chipsRender.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          {chipsRender.map((chip) => (
            <span
              key={chip.clave}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "var(--chakra-colors-blue-subtle)",
                border: "1px solid var(--chakra-colors-blue-border)",
                borderRadius: "9999px",
                padding: "0.25rem 0.75rem",
                fontSize: "0.875rem",
                marginRight: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              {chip.etiqueta}: {chip.valor}
              <button
                type="button"
                onClick={chip.onQuitar}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                  fontSize: "1.25rem",
                  lineHeight: "1",
                  color: "var(--chakra-colors-fg-subtle)",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

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
    <Tarjeta>
      <Table.Root variant="outline" w="100%" minW="680px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro ancho="angosta">Unidad</EncabezadoOscuro>
            <EncabezadoOscuro ancho="angosta">Borradores</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {productos.map((producto) => (
            <Table.Row
              key={producto.id}
              borderBottomWidth="1px"
              borderColor="border.subtle"
              onClick={() => onSeleccionarProducto(producto)}
              style={{ cursor: "pointer" }}
              _hover={{ bg: "bg.subtle" }}
            >
              <Celda p="3">
                <TextoTruncado texto={producto.nombre} />
              </Celda>
              <Celda p="3">{producto.unidad_medida.simbolo}</Celda>
              <Celda p="3" center>
                <BadgeBorradores count={producto.borradores.length}>
                  {producto.borradores.length}
                </BadgeBorradores>
              </Celda>
              <Celda p="3" center>
                <HStackAcciones>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCrearBorrador(producto.id);
                    }}
                    style={{
                      padding: "0.375rem 0.75rem",
                      background: "#16a34a",
                      color: "white",
                      border: "none",
                      borderRadius: "0.25rem",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      marginRight: "0.25rem",
                    }}
                  >
                    Nuevo borrador
                  </button>
                  {producto.borradores.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeleccionarProducto(producto);
                      }}
                      style={{
                        padding: "0.375rem 0.75rem",
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Ver borradores
                    </button>
                  )}
                </HStackAcciones>
              </Celda>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}

function HStackAcciones({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.25rem", justifyContent: "center" }}>
      {children}
    </div>
  );
}

function BadgeBorradores({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "2rem",
        height: "1.5rem",
        padding: "0 0.5rem",
        background: count > 0 ? "var(--chakra-colors-green-muted)" : "var(--chakra-colors-bg-muted)",
        color: count > 0 ? "var(--chakra-colors-green-fg)" : "var(--chakra-colors-fg-muted)",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "medium",
      }}
    >
      {children}
    </span>
  );
}

function VistaProductoSeleccionado({
  producto,
  onCrearBorrador,
  onEditarBorrador,
}: {
  producto: ProductoConBorradores;
  onCrearBorrador: (productoId: number) => void;
  onEditarBorrador: (borradorId: number) => void;
}) {
  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
          {producto.nombre}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--chakra-colors-fg-muted)" }}>
          Unidad: {producto.unidad_medida.simbolo}
        </p>
      </div>

      {producto.borradores.length === 0 ? (
        <EstadoVacio>
          Este producto no tiene borradores de rotulado. Creá el primero.
        </EstadoVacio>
      ) : (
        <Tarjeta>
          <Table.Root variant="outline" w="100%" minW="680px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Borrador</EncabezadoOscuro>
                <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                <EncabezadoOscuro ancho="angosta">Actualizado</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {producto.borradores.map((b) => (
                <Table.Row
                  key={b.id}
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                >
                  <Celda p="3">
                    <TextoTruncado texto={`Borrador #${b.id}`} />
                  </Celda>
                  <Celda p="3">{b.estado}</Celda>
                  <Celda p="3">
                    {b.actualizado_en ?? "-"}
                  </Celda>
                  <Celda p="3" center>
                    <button
                      type="button"
                      onClick={() => onEditarBorrador(b.id)}
                      style={{
                        padding: "0.375rem 0.75rem",
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <button
          type="button"
          onClick={() => onCrearBorrador(producto.id)}
          style={{
            padding: "0.5rem 1rem",
            background: "#16a34a",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Crear nuevo borrador
        </button>
      </div>
    </>
  );
}
