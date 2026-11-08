import { useCallback, useMemo, useState } from "react";
import { Badge, Box, HStack, Table, Tabs, Text } from "@chakra-ui/react";
import { useLista } from "../../../../common/hooks/useLista";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import {
  BarraFiltros,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  FormInput,
  LabelFiltro,
  PageHeader,
  Paginacion,
  Tarjeta,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import {
  crearAditivo,
  crearClase,
  darDeBajaAditivo,
  darDeBajaClase,
  listarAditivos,
  listarClases,
  modificarAditivo,
  modificarClase,
} from "../../services/aditivoService";
import type { Aditivo, ClaseFuncional } from "../../types/aditivo";
import { AditivoDialog } from "../AditivoDialog";
import { ClaseFuncionalDialog } from "../ClaseFuncionalDialog";

const PAGE_SIZE = 10;

function useClases(incluirInactivas: boolean) {
  const cargar = useCallback(() => listarClases(incluirInactivas), [incluirInactivas]);
  const { items, loading, error, recargar } = useLista<ClaseFuncional[]>({
    cargar,
    dependencias: [incluirInactivas],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las clases funcionales",
  });
  return { clases: items, loading, error, recargar };
}

function TabAditivos() {
  const [verBajas, setVerBajas] = useState(false);
  const [claseId, setClaseId] = useState("");
  const [buscar, setBuscar] = useState("");
  const [editando, setEditando] = useState<Aditivo | "nuevo" | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(() => listarAditivos(verBajas), [verBajas]);
  const { items: aditivos, loading, error, recargar } = useLista<Aditivo[]>({
    cargar,
    dependencias: [verBajas],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los aditivos",
  });
  const { clases } = useClases(false);

  const filtrados = useMemo(() => {
    const texto = buscar.trim().toLowerCase();
    return aditivos.filter(
      (a) =>
        (!claseId || String(a.clase_funcional.id) === claseId) &&
        (!texto ||
          a.nombre.toLowerCase().includes(texto) ||
          (a.numero_ins ?? "").toLowerCase().includes(texto)),
    );
  }, [aditivos, claseId, buscar]);
  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${claseId}|${buscar}|${verBajas}`,
  );

  const limpiar = () => {
    setClaseId("");
    setBuscar("");
  };
  const chips = chipsDeFiltros([
    {
      clave: "clase",
      etiqueta: "Clase",
      valor: clases.find((c) => String(c.id) === claseId)?.nombre ?? "",
      onQuitar: () => setClaseId(""),
    },
    { clave: "buscar", etiqueta: "Búsqueda", valor: buscar.trim(), onQuitar: () => setBuscar("") },
  ]);

  const accion = async (fn: () => Promise<unknown>) => {
    setErrorAccion(null);
    try {
      await fn();
      await recargar();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo completar la acción.");
    }
  };

  return (
    <>
      <HStack justify="space-between" mb="2" flexWrap="wrap" gap="3">
        <Text fontSize="sm" color="fg.muted" maxW="640px">
          Cada aditivo se identifica por su clase funcional, su nombre completo y su número INS. Los
          insumos de tipo aditivo se eligen de esta lista.
        </Text>
        <BotonAgregar onClick={() => setEditando("nuevo")}>Nuevo aditivo</BotonAgregar>
      </HStack>

      <BarraFiltros
        filtros={
          <>
            <FiltroSelect
              label="Clase funcional"
              valor={claseId}
              onCambio={setClaseId}
              opciones={clases.map((c) => ({ valor: String(c.id), etiqueta: c.nombre }))}
              todos="Todas las clases"
            />
            <Box minW="220px">
              <LabelFiltro>Buscar</LabelFiltro>
              <FormInput
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Nombre o INS"
                aria-label="Buscar aditivo"
              />
            </Box>
          </>
        }
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiar} />
      <ToggleInactivos checked={verBajas} onChange={setVerBajas}>
        Ver dados de baja
      </ToggleInactivos>

      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}
      {loading && <EstadoCargando>Cargando aditivos...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 &&
        (claseId || buscar ? (
          <EstadoVacioFiltrado onLimpiar={limpiar}>
            No hay aditivos que coincidan con los filtros.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>Todavía no hay aditivos en la lista de referencia.</EstadoVacio>
        ))}

      {!loading && !error && filtrados.length > 0 && (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" w="100%" minW="720px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro ancho="amplia">Clase funcional</EncabezadoOscuro>
                  <EncabezadoOscuro>Nombre completo</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">INS</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {paginados.map((a) => (
                  <Table.Row key={a.id} opacity={a.activo ? 1 : 0.65}>
                    <Celda>{a.clase_funcional.nombre}</Celda>
                    <Celda>{a.nombre}</Celda>
                    <Celda>
                      {a.numero_ins ? (
                        <Text fontFamily="mono" fontSize="sm">
                          {a.numero_ins}
                        </Text>
                      ) : (
                        <Text fontSize="sm" color="fg.subtle">
                          No aplica
                        </Text>
                      )}
                    </Celda>
                    <Celda center>
                      <HStack justify="center" gap="2">
                        {a.activo ? (
                          <>
                            <BotonAccion accion="editar" label="Modificar" onClick={() => setEditando(a)} />
                            <BotonAccion
                              accion="eliminar"
                              label="Dar de baja"
                              onClick={() => accion(() => darDeBajaAditivo(a.id))}
                            />
                          </>
                        ) : (
                          <BotonAccion
                            accion="reactivar"
                            label="Reactivar"
                            onClick={() => accion(() => modificarAditivo(a.id, { activo: true }))}
                          />
                        )}
                      </HStack>
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>
          {hayVariasPaginas && (
            <Paginacion count={filtrados.length} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
          )}
        </>
      )}

      {editando && (
        <AditivoDialog
          aditivo={editando === "nuevo" ? undefined : editando}
          clases={clases}
          onCancel={() => setEditando(null)}
          onGuardar={async (datos) => {
            if (editando === "nuevo") await crearAditivo(datos);
            else await modificarAditivo(editando.id, datos);
            setEditando(null);
            await recargar();
          }}
        />
      )}
    </>
  );
}

function TabClases() {
  const [verBajas, setVerBajas] = useState(false);
  const [editando, setEditando] = useState<ClaseFuncional | "nueva" | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const { clases, loading, error, recargar } = useClases(verBajas);

  const accion = async (fn: () => Promise<unknown>) => {
    setErrorAccion(null);
    try {
      await fn();
      await recargar();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo completar la acción.");
    }
  };

  return (
    <>
      <HStack justify="space-between" mb="2" flexWrap="wrap" gap="3">
        <Text fontSize="sm" color="fg.muted" maxW="640px">
          Funciones tecnológicas de los aditivos. En las marcadas como "solo por su función" el número
          INS es opcional.
        </Text>
        <BotonAgregar onClick={() => setEditando("nueva")}>Nueva clase</BotonAgregar>
      </HStack>
      <ToggleInactivos checked={verBajas} onChange={setVerBajas}>
        Ver dadas de baja
      </ToggleInactivos>

      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}
      {loading && <EstadoCargando>Cargando clases...</EstadoCargando>}

      {!loading && !error && clases.length === 0 && <EstadoVacio>No hay clases funcionales.</EstadoVacio>}

      {!loading && !error && clases.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="560px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Clase funcional</EncabezadoOscuro>
                <EncabezadoOscuro ancho="amplia">Número INS</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {clases.map((c) => (
                <Table.Row key={c.id} opacity={c.activo ? 1 : 0.65}>
                  <Celda>{c.nombre}</Celda>
                  <Celda>
                    <Badge colorPalette={c.ins_opcional ? "gray" : "blue"} variant="subtle">
                      {c.ins_opcional ? "Opcional (solo por su función)" : "Obligatorio"}
                    </Badge>
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      {c.activo ? (
                        <>
                          <BotonAccion accion="editar" label="Modificar" onClick={() => setEditando(c)} />
                          <BotonAccion
                            accion="eliminar"
                            label="Dar de baja"
                            onClick={() => accion(() => darDeBajaClase(c.id))}
                          />
                        </>
                      ) : (
                        <BotonAccion
                          accion="reactivar"
                          label="Reactivar"
                          onClick={() => accion(() => modificarClase(c.id, { activo: true }))}
                        />
                      )}
                    </HStack>
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}

      {editando && (
        <ClaseFuncionalDialog
          clase={editando === "nueva" ? undefined : editando}
          onCancel={() => setEditando(null)}
          onGuardar={async (datos) => {
            if (editando === "nueva") await crearClase(datos);
            else await modificarClase(editando.id, datos);
            setEditando(null);
            await recargar();
          }}
        />
      )}
    </>
  );
}

export function AditivosPage() {
  return (
    <Box p="5">
      <PageHeader
        title="Aditivos"
        description="Lista de referencia de aditivos alimentarios. Se actualiza desde acá, sin reprogramar."
      />
      <Tabs.Root defaultValue="aditivos" variant="line" colorPalette="brand" lazyMount>
        <Tabs.List overflowX="auto" overflowY="hidden" mb="6">
          <Tabs.Trigger value="aditivos" flexShrink={0}>
            Aditivos
          </Tabs.Trigger>
          <Tabs.Trigger value="clases" flexShrink={0}>
            Clases funcionales
          </Tabs.Trigger>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content value="aditivos" p="0">
          <TabAditivos />
        </Tabs.Content>
        <Tabs.Content value="clases" p="0">
          <TabClases />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}
