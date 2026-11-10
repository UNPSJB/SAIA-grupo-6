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
import { useTransportistaABM } from "../../hooks/useTransportistaABM";
import { useTransportistas } from "../../hooks/useTransportistas";
import type { OrdenTransportista } from "../../services/transportistaService";
import type { Transportista } from "../../types/transportista";
import { TransportistaTable } from "../TransportistaTable";
import { BotonesExportar } from "../../../../features/exportacion";

const PAGE_SIZE = 10;

export function TransportistasPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);

  const orden = useOrdenTabla<string, OrdenTransportista>(
    "razon_social_asc",
    "razon_social"
  );

  const {
    transportistas,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarTransportistas,
  } = useTransportistas(
    verInactivos,
    busquedaAplicada,
    orden.orden as OrdenTransportista
  );

  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useTransportistaABM();

  const [transportistaAEliminar, setTransportistaAEliminar] = useState<Transportista | null>(null);
  const [transportistaAReactivar, setTransportistaAReactivar] = useState<Transportista | null>(null);

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

  const handleEdit = (transportista: Transportista) =>
    navigate(`/transportistas/${transportista.id}/editar`);
  const handleVer = (transportista: Transportista) =>
    navigate(`/transportistas/${transportista.id}/detalle`);
  const handleDeleteRequest = (transportista: Transportista) =>
    setTransportistaAEliminar(transportista);
  const handleCloseDeleteDialog = () => {
    if (!procesando) setTransportistaAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!transportistaAEliminar) return;
    try {
      await borrar(transportistaAEliminar.id);
      setTransportistaAEliminar(null);
      await cargarTransportistas();
    } catch {
      setTransportistaAEliminar(null);
    }
  };

  const handleReactivarRequest = (transportista: Transportista) =>
    setTransportistaAReactivar(transportista);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setTransportistaAReactivar(null);
  };

  const handleConfirmReactivar = async () => {
    if (!transportistaAReactivar) return;
    try {
      await reactivar(transportistaAReactivar.id, {
        razon_social: transportistaAReactivar.razon_social,
        cuit: transportistaAReactivar.cuit,
        telefono: transportistaAReactivar.telefono,
        email: transportistaAReactivar.email ?? undefined,
        domicilio: transportistaAReactivar.domicilio ?? undefined,
        observaciones: transportistaAReactivar.observaciones ?? undefined,
      });
      setTransportistaAReactivar(null);
      await cargarTransportistas();
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
      titulo={verInactivos ? "Transportistas dados de baja" : "Gestión de transportistas"}
      descripcion="Alta, modificación y baja de los transportistas para saber quién lleva el producto."
      acciones={
        <BotonAgregar onClick={() => navigate("/transportistas/nuevo")}>Nuevo transportista</BotonAgregar>
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
            placeholder="Buscar por razón social, CUIT, teléfono, email o domicilio..."
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
              nombreTabla="transportistas"
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
          {hayFiltros && transportistas.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay transportistas que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <TransportistaTable
              transportistas={transportistas}
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
        isOpen={transportistaAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el transportista <strong>{transportistaAEliminar?.razon_social}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={transportistaAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el transportista ${transportistaAReactivar?.razon_social}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Pagina>
  );
}
