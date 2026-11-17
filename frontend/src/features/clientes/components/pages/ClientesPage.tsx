import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@chakra-ui/react";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BotonAgregar,
  BannerError,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";
import { useClienteABM } from "../../hooks/useClienteABM";
import { useClientes } from "../../hooks/useClientes";
import type { OrdenCliente } from "../../services/clienteService";
import type { Cliente } from "../../types/cliente";
import { ClienteTable } from "../ClienteTable";
import { BotonesExportar } from "../../../../features/exportacion";

const PAGE_SIZE = 10;

export function ClientesPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);

  // Orden por defecto: nombre ascendente, con el header de Nombre activo.
  const orden = useOrdenTabla<string, OrdenCliente>("nombre_asc", "nombre");

  const { clientes, total, page, setPage, hayVariasPaginas, loading, error, cargarClientes } = useClientes(
    verInactivos,
    busquedaAplicada,
    orden.orden as OrdenCliente
  );

  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useClienteABM();

  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null);
  const [clienteAReactivar, setClienteAReactivar] = useState<Cliente | null>(null);

  const limpiarTodo = () => {
    setBusqueda("");
    setPage(1);
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "";

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => {
        setBusqueda("");
        setPage(1);
      },
    },
    {
      clave: "orden",
      etiqueta: "Orden",
      valor:
        orden.columna !== null
          ? `${orden.columna} ${orden.direccion === "asc" ? "↑" : "↓"}`
          : "",
      visible: !orden.esPorDefecto && orden.columna !== null,
      onQuitar: orden.reiniciar,
    },
  ]);

  const handleEdit = (cliente: Cliente) => navigate(`/clientes/${cliente.id}/editar`);
  const handleVer = (cliente: Cliente) => navigate(`/clientes/${cliente.id}/detalle`);
  const handleDeleteRequest = (cliente: Cliente) => setClienteAEliminar(cliente);
  const handleCloseDeleteDialog = () => {
    if (!procesando) setClienteAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!clienteAEliminar) return;
    try {
      await borrar(clienteAEliminar.id);
      setClienteAEliminar(null);
      await cargarClientes();
    } catch {
      setClienteAEliminar(null);
    }
  };

  const handleReactivarRequest = (cliente: Cliente) => setClienteAReactivar(cliente);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setClienteAReactivar(null);
  };

  const handleConfirmReactivar = async () => {
    if (!clienteAReactivar) return;
    try {
      await reactivar(clienteAReactivar.id, {
        nombre: clienteAReactivar.nombre,
        documento: clienteAReactivar.documento,
        telefono: clienteAReactivar.telefono,
        email: clienteAReactivar.email ?? undefined,
        domicilio: clienteAReactivar.domicilio ?? undefined,
      });
      setClienteAReactivar(null);
      await cargarClientes();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const ordenTabla = {
    columna: orden.columna,
    direccion: orden.direccion,
    orden: orden.orden,
    esPorDefecto: orden.esPorDefecto,
    ordenar: orden.ordenar,
    reiniciar: orden.reiniciar,
  };

  return (
    <Pagina
      titulo={verInactivos ? "Clientes dados de baja" : "Gestión de clientes"}
      descripcion="Alta, modificación y baja de los clientes para asociarles salidas de producto."
      acciones={
        <BotonAgregar onClick={() => navigate("/clientes/nuevo")}>Nuevo cliente</BotonAgregar>
      }
    >
      {errorEliminar && <BannerError>{errorEliminar}</BannerError>}
      {error && <BannerError>{error}</BannerError>}

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={(valor) => {
              setBusqueda(valor);
              setPage(1);
            }}
            placeholder="Buscar por nombre, documento, domicilio o teléfono..."
          />
        }
        herramientas={
          <>
            <ToggleInactivos
              enBarra
              checked={verInactivos}
              onChange={(checked: boolean) => {
                setVerInactivos(checked);
                setPage(1);
              }}
              children="Ver dados de baja"
            />
            <BotonesExportar
              nombreTabla="clientes"
              filtros={{
                activo: String(!verInactivos),
                buscar: busquedaAplicada,
              }}
            />
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          {hayFiltros && clientes.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay clientes que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <ClienteTable
              clientes={clientes}
              orden={ordenTabla}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onReactivar={handleReactivarRequest}
              onVer={handleVer}
            />
          )}

          {hayVariasPaginas && (
            <Paginacion
              count={total}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={clienteAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el cliente <strong>{clienteAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={clienteAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el cliente ${clienteAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Pagina>
  );
}
