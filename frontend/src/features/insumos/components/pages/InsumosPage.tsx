import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuScale } from "react-icons/lu";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { useLista } from "../../../../common/hooks/useLista";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  chipsDeFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
} from "../../../../components/ui/filtros";
import { Pagina } from "../../../../components/ui/plantillas";
import {
  avisarExito,
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  EtiquetaEstado,
  FilaClickeable,
  FilaEncabezado,
  Tarjeta,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import { useIngredientesActivos } from "../../../lotesInsumo/hooks/useStockInsumos";
import { useProveedores } from "../../../proveedores/hooks/useProveedores";
import { crearInsumo, darDeBajaInsumo, listarInsumos, modificarInsumo } from "../../services/insumoService";
import {
  ETIQUETA_ESTADO_HOMOLOGACION,
  TONO_ESTADO_HOMOLOGACION,
  type EstadoHomologacion,
  type Insumo,
} from "../../types/insumo";
import { InsumoDialog, type DatosInsumoDialog } from "../InsumoDialog";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";
import { DialogContent, DialogRoot, DialogTitle } from "../../../../components/ui/dialog";
import { PanelParametros } from "../../../nutricion/components/pages/ParametrosNutricionPage";

/** Filtro por estado: los de la homologación más "vencida" (aprobada pero sin vigencia). */
type FiltroEstado = "" | EstadoHomologacion | "vencida";

const OPCIONES_ESTADO: { valor: FiltroEstado; etiqueta: string }[] = [
  { valor: "pendiente", etiqueta: "Pendientes" },
  { valor: "aprobada", etiqueta: "Aprobados y vigentes" },
  { valor: "vencida", etiqueta: "Homologación vencida" },
  { valor: "requiere_revision", etiqueta: "Requieren revisión" },
  { valor: "rechazada", etiqueta: "Rechazados" },
];

function estadoDe(insumo: Insumo): FiltroEstado {
  return insumo.estado_homologacion === "aprobada" && insumo.homologacion_vencida
    ? "vencida"
    : insumo.estado_homologacion;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Todos los insumos: los productos concretos que se compran (una marca de un
 * ingrediente). Desde acá se crean, se homologan (rótulo comparado con el
 * ingrediente) y se dan de baja. Solo de un insumo aprobado y vigente se
 * reciben y consumen lotes.
 *
 * `?ingrediente=<id>&nuevo=1` abre el alta con el ingrediente elegido (lo usa
 * "Recibir lote" cuando la marca que llegó todavía no existe).
 */
export function InsumosPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ingredienteDeLaUrl = Number(params.get("ingrediente")) || null;

  const [buscar, setBuscar] = useEstadoNavegacion("InsumosPage.buscar", "");
  const [ingredienteId, setIngredienteId] = useEstadoNavegacion<number | null>("InsumosPage.ingredienteId", ingredienteDeLaUrl);
  const [estado, setEstado] = useEstadoNavegacion<FiltroEstado>("InsumosPage.estado", "");
  const [verBajas, setVerBajas] = useEstadoNavegacion("InsumosPage.verBajas", false);
  const [editando, setEditando] = useState<Insumo | "nuevo" | null>(() =>
    params.get("nuevo") ? "nuevo" : null,
  );
  const [aBaja, setABaja] = useState<Insumo | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [verReglas, setVerReglas] = useState(false);

  const { ingredientes } = useIngredientesActivos();
  const { proveedores } = useProveedores(false);

  const cargar = useCallback(() => listarInsumos({ incluirInactivos: verBajas }), [verBajas]);
  const { items: insumos, loading, error, recargar } = useLista<Insumo[]>({
    cargar,
    dependencias: [verBajas],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos.",
  });

  const visibles = useMemo(() => {
    const texto = normalizar(buscar.trim());
    return insumos
      // "Ver dados de baja": solo los dados de baja (como en el resto de los listados).
      .filter((i) => (verBajas ? !i.activo : i.activo))
      .filter((i) => !ingredienteId || i.ingrediente_id === ingredienteId)
      .filter((i) => !estado || estadoDe(i) === estado)
      .filter(
        (i) =>
          !texto ||
          normalizar(i.nombre).includes(texto) ||
          normalizar(i.ingrediente_nombre).includes(texto) ||
          i.proveedores.some((p) => normalizar(p.nombre).includes(texto)),
      )
      .sort(
        (a, b) =>
          a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, "es") || a.nombre.localeCompare(b.nombre, "es"),
      );
  }, [insumos, verBajas, ingredienteId, estado, buscar]);

  // Filtros aplicados, como chips entre la barra y la tabla.
  const chips = chipsDeFiltros([
    { clave: "busqueda", etiqueta: "Búsqueda", valor: buscar, recortar: true, onQuitar: () => setBuscar("") },
    {
      clave: "ingrediente",
      etiqueta: "Ingrediente",
      valor: ingredientes.find((i) => i.id === ingredienteId)?.nombre ?? "",
      onQuitar: () => setIngredienteId(null),
    },
    {
      clave: "estado",
      etiqueta: "Homologación",
      valor: OPCIONES_ESTADO.find((o) => o.valor === estado)?.etiqueta ?? "",
      onQuitar: () => setEstado(""),
    },
  ]);
  const limpiarFiltros = () => {
    setBuscar("");
    setIngredienteId(null);
    setEstado("");
  };

  const cerrarDialogo = () => {
    setEditando(null);
    // Que recargar la página no vuelva a abrir el alta.
    if (params.get("nuevo")) {
      params.delete("nuevo");
      setParams(params, { replace: true });
    }
  };

  const guardar = async (datos: DatosInsumoDialog) => {
    if (editando === "nuevo") {
      const { ingrediente_id, ...resto } = datos;
      const creado = await crearInsumo({ ...resto, ingrediente_id: ingrediente_id ?? ingredienteId ?? 0 });
      avisarExito(
        datos.sin_rotulo ? "Insumo creado. Ahora homologalo." : "Insumo creado. Ahora cargá su rótulo y homologalo.",
      );
      cerrarDialogo();
      navigate(`/insumos/${creado.id}/homologacion`);
      return;
    }
    if (editando) {
      await modificarInsumo(editando.id, datos);
      avisarExito("Insumo modificado correctamente.");
    }
    cerrarDialogo();
    await recargar();
  };

  const confirmarBaja = async () => {
    if (!aBaja) return;
    setProcesando(true);
    setErrorAccion(null);
    try {
      await darDeBajaInsumo(aBaja.id);
      avisarExito("Insumo dado de baja correctamente.");
      setABaja(null);
      await recargar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo dar de baja el insumo.");
      setABaja(null);
    } finally {
      setProcesando(false);
    }
  };

  const reactivar = async (insumo: Insumo) => {
    setErrorAccion(null);
    try {
      await modificarInsumo(insumo.id, { activo: true });
      avisarExito("Insumo reactivado.");
      await recargar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo reactivar el insumo.");
    }
  };

  const homologar = (insumo: Insumo) => navigate(`/insumos/${insumo.id}/homologacion`);

  return (
    <Pagina
      titulo="Insumos"
      descripcion="Lo que se compra: cada marca de un ingrediente, con sus proveedores y su homologación. Solo de un insumo aprobado y vigente se reciben y consumen lotes."
      acciones={
        <HStack gap="2" flexWrap="wrap">
          {/* Tolerancia y vigencia con que se homologa: valen para todas las sedes. */}
          <Button variant="outline" onClick={() => setVerReglas(true)}>
            <LuScale aria-hidden />
            Reglas de homologación
          </Button>
          <BotonAgregar onClick={() => setEditando("nuevo")}>Nuevo insumo</BotonAgregar>
        </HStack>
      }
    >
      <BarraFiltros
        busqueda={
          <CampoBusqueda valor={buscar} onCambio={setBuscar} placeholder="Marca, ingrediente o proveedor..." />
        }
        filtros={
          <>
            <FiltroSelect
              label="Ingrediente"
              valor={ingredienteId ? String(ingredienteId) : ""}
              onCambio={(v) => setIngredienteId(v ? Number(v) : null)}
              opciones={ingredientes.map((i) => ({ valor: String(i.id), etiqueta: i.nombre }))}
              todos="Todos los ingredientes"
            />
            <FiltroSelect
              label="Homologación"
              valor={estado}
              onCambio={(v) => setEstado(v as FiltroEstado)}
              opciones={OPCIONES_ESTADO.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              todos="Todos los estados"
            />
          </>
        }
        herramientas={
          <ToggleInactivos enBarra checked={verBajas} onChange={setVerBajas}>
            Ver dados de baja
          </ToggleInactivos>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarFiltros} />

      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}
      {loading && <EstadoCargando>Cargando insumos...</EstadoCargando>}

      {!loading && !error && visibles.length === 0 &&
        (chips.length > 0 ? (
          <EstadoVacioFiltrado onLimpiar={limpiarFiltros}>
            No hay insumos que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>
            {verBajas ? "No hay insumos dados de baja." : "Todavía no hay insumos cargados."}
          </EstadoVacio>
        ))}

      {!loading && !error && visibles.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="760px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Ingrediente e insumo</EncabezadoOscuro>
                <EncabezadoOscuro>Proveedores</EncabezadoOscuro>
                <EncabezadoOscuro center width="190px">Homologación</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {visibles.map((insumo) => (
                <FilaClickeable key={insumo.id} onAbrir={() => homologar(insumo)} opacity={insumo.activo ? 1 : 0.65}>
                  <Celda>
                    <DatoPrincipal
                      titulo={insumo.ingrediente_nombre}
                      secundario={
                        insumo.sin_rotulo ? `${insumo.nombre} · sin rótulo propio` : insumo.nombre
                      }
                    />
                  </Celda>
                  <Celda>
                    {insumo.proveedores.length ? (
                      <Text fontSize="sm" lineClamp={2}>
                        {insumo.proveedores.map((p) => p.nombre).join(", ")}
                      </Text>
                    ) : (
                      <Text as="span" fontSize="sm" color="fg.muted">
                        Sin proveedores
                      </Text>
                    )}
                  </Celda>
                  <Celda center>
                    <Stack gap="1" align="center">
                      {!insumo.activo ? (
                        <EtiquetaEstado tono="neutro">Dado de baja</EtiquetaEstado>
                      ) : insumo.homologacion_vencida ? (
                        <EtiquetaEstado tono="peligro">Vencida</EtiquetaEstado>
                      ) : (
                        <EtiquetaEstado tono={TONO_ESTADO_HOMOLOGACION[insumo.estado_homologacion]}>
                          {ETIQUETA_ESTADO_HOMOLOGACION[insumo.estado_homologacion]}
                        </EtiquetaEstado>
                      )}
                      {insumo.activo && insumo.homologacion_vigente_hasta && (
                        <Text fontSize="xs" color="fg.muted">
                          {insumo.homologacion_vencida ? "venció el" : "hasta el"}{" "}
                          {formatoFecha(insumo.homologacion_vigente_hasta)}
                        </Text>
                      )}
                    </Stack>
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      {insumo.activo ? (
                        <>
                          <BotonAccion
                            accion="nutricion"
                            label="Composición y homologación del insumo"
                            onClick={() => homologar(insumo)}
                          />
                          <BotonAccion accion="editar" label="Modificar" onClick={() => setEditando(insumo)} />
                          <BotonAccion accion="eliminar" label="Dar de baja" onClick={() => setABaja(insumo)} />
                        </>
                      ) : (
                        <BotonAccion accion="reactivar" label="Reactivar" onClick={() => reactivar(insumo)} />
                      )}
                    </HStack>
                  </Celda>
                </FilaClickeable>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}

      {editando && (
        <InsumoDialog
          insumo={editando === "nuevo" ? undefined : editando}
          ingredientes={ingredientes.map((i) => ({ id: i.id, nombre: i.nombre }))}
          ingredienteInicial={ingredienteId}
          proveedores={proveedores}
          onGuardar={guardar}
          onCancel={cerrarDialogo}
        />
      )}

      {verReglas && (
        <DialogRoot
          open
          placement="center"
          motionPreset="none"
          onOpenChange={(d) => {
            if (!d.open) setVerReglas(false);
          }}
        >
          <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="760px" maxW="calc(100vw - 32px)">
            <DialogTitle as="h3" mt={0} mb="4" fontSize="lg" fontWeight="bold" color="fg">
              Reglas de homologación
            </DialogTitle>
            <PanelParametros seccion="homologacion" onGuardado={() => setVerReglas(false)} />
          </DialogContent>
        </DialogRoot>
      )}

      <ConfirmDialog
        isOpen={aBaja !== null}
        titulo={`Dar de baja ${aBaja?.nombre ?? ""}`}
        mensaje="Ya no se van a poder recibir lotes de este insumo. Los lotes recibidos se conservan."
        textoConfirmar="Dar de baja"
        isLoading={procesando}
        onConfirm={confirmarBaja}
        onCancel={() => !procesando && setABaja(null)}
      />
    </Pagina>
  );
}
