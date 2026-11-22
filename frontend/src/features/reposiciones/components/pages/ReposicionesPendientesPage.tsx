import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { Pagina } from "../../../../components/ui/plantillas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonCancelar,
  EstadoCargando,
  EstadoVacio,
  PieTabla,
} from "../../../../components/ui/patrones";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { ReposicionesTable } from "../ReposicionesTable";
import { ModalReponerStock } from "../ModalReponerStock";
import { obtenerReposicionesPendientes } from "../../services/reposicionService";
import type { Reposicion } from "../../types/reposicion";

const PAGE_SIZE = 10;

export function ReposicionesPendientesPage() {
  const [reposiciones, setReposiciones] = useState<Reposicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [reposicionSeleccionada, setReposicionSeleccionada] =
    useState<Reposicion | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReposiciones(await obtenerReposicionesPendientes());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las reposiciones pendientes"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return reposiciones;
    return reposiciones.filter(
      (r) =>
        (r.cliente?.nombre ?? "").toLowerCase().includes(texto) ||
        (r.producto?.nombre ?? "").toLowerCase().includes(texto)
    );
  }, [reposiciones, busqueda]);

  const { paginados, page, setPage } = usePaginas(
    filtradas,
    PAGE_SIZE,
    busqueda
  );

  const hayFiltros = busqueda.trim() !== "";
  const limpiarTodo = () => setBusqueda("");

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda.trim(),
      onQuitar: () => setBusqueda(""),
    },
  ]);

  return (
    <Pagina
      titulo="Reposiciones Pendientes"
      descripcion="Mercadería adeudada a clientes por cancelaciones o rechazos"
    >
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar cliente o producto..."
          />
        }
        herramientas={
          <BotonCancelar onClick={() => void cargar()} disabled={loading}>
            <LuRefreshCw aria-hidden />
            Actualizar
          </BotonCancelar>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && (
        <EstadoCargando pagina>Cargando reposiciones pendientes...</EstadoCargando>
      )}

      {!loading && !error && filtradas.length === 0 &&
        (hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay reposiciones que coincidan con la búsqueda.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>No hay reposiciones pendientes</EstadoVacio>
        ))}

      {!loading && !error && filtradas.length > 0 && (
        <Box bg="white" shadow="sm" borderRadius="md">
          <ReposicionesTable
            reposiciones={paginados}
            onReponer={(repo) => setReposicionSeleccionada(repo)}
            pie={
              <PieTabla
                count={filtradas.length}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                unidad={filtradas.length === 1 ? "reposición" : "reposiciones"}
              />
            }
          />
        </Box>
      )}

      <ModalReponerStock
        reposicion={reposicionSeleccionada}
        isOpen={Boolean(reposicionSeleccionada)}
        onClose={() => setReposicionSeleccionada(null)}
        onSuccess={() => void cargar()}
      />
    </Pagina>
  );
}
