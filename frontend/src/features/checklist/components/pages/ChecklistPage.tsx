import { useEffect, useMemo, useState } from "react";
import { Box, HStack, Skeleton, Stack, Text } from "@chakra-ui/react";
import { LuRefreshCw, LuSearchX } from "react-icons/lu";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../../common/context/useAuth";
import { BannerError, BotonCancelar, EstadoVacio, Tarjeta } from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";
import { listarOpcionesElementosLimpieza } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import type { ElementoLimpiezaOpcion } from "../../../elementoLimpieza/types/elementoLimpieza";
import { listarOpcionesInsumosQuimicos } from "../../../insumoQuimico/services/insumoQuimicoService";
import type { InsumoQuimicoOpcion } from "../../../insumoQuimico/types/insumoQuimico";
import { useChecklist } from "../../hooks/useChecklist";
import { CabeceraChecklist } from "../diario/CabeceraChecklist";
import { CoberturaDialog } from "../diario/DialogosTarea";
import { GrupoChecklist } from "../diario/GrupoChecklist";
import { TarjetaTarea } from "../diario/TarjetaTarea";
import {
  FILTROS_INICIALES,
  agruparPorPlan,
  cumpleFiltros,
  esMiTarea,
  estadoGrupo,
  hayFiltrosActivos,
  idTareaChecklist,
  operadoresDelDia,
  type FiltrosChecklist,
} from "../diario/modelo";

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checklist diario de limpieza.
 *
 * Arriba, una sola tarjeta con la fecha, el avance del día y los filtros
 * rápidos (buscar, operador, etapa, estado, "Solo mis tareas"). Debajo, un
 * acordeón por plan/equipo con su estado y avance a la vista, y adentro cada
 * tarea como tarjeta. Los filtros trabajan sobre las tareas ya cargadas: no
 * cambian la consulta ni la lógica de marcado (`useChecklist`).
 *
 * Las piezas viven en `../diario/`: `modelo` (agrupar, estados, filtros),
 * `CabeceraChecklist`, `GrupoChecklist`, `TarjetaTarea` y `DialogosTarea`.
 */
export function ChecklistPage() {
  const hoyISO = fechaLocalISO(new Date());
  const { user: usuarioActual } = useAuth();
  const esAdmin = usuarioActual?.puede_administrar || usuarioActual?.es_super_admin || false;

  const [selectedFecha, setSelectedFecha] = useState<string>(hoyISO);
  const [insumosQuimicos, setInsumosQuimicos] = useState<InsumoQuimicoOpcion[]>([]);
  const [elementosLimpieza, setElementosLimpieza] = useState<ElementoLimpiezaOpcion[]>([]);

  const { tareas, loading, error, actualizandoId, toggleTarea, recargar } = useChecklist(selectedFecha);

  const [coberturaRegistroId, setCoberturaRegistroId] = useState<number | null>(null);
  const [filtros, setFiltros] = useState<FiltrosChecklist>(FILTROS_INICIALES);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());

  // `?registro=<id>`: se llega a una tarea puntual (desde el inicio).
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const registroDestino = Number(searchParams.get("registro")) || null;
  const [resaltadoId, setResaltadoId] = useState<number | null>(null);

  useEffect(() => {
    // Endpoints de "opciones": los únicos de estos catálogos accesibles para
    // un operario sin permisos de administración.
    const cargarOpciones = async () => {
      try {
        const [datosQuimicos, datosElementos] = await Promise.all([
          listarOpcionesInsumosQuimicos().catch(() => []),
          listarOpcionesElementosLimpieza().catch(() => []),
        ]);
        setInsumosQuimicos(datosQuimicos);
        setElementosLimpieza(datosElementos);
      } catch (err) {
        console.error("Error al cargar opciones auxiliares:", err);
      }
    };
    cargarOpciones();
  }, []);

  const grupos = useMemo(() => agruparPorPlan(tareas), [tareas]);
  const tareaCobertura = tareas.find((t) => t.registro_id === coberturaRegistroId) ?? null;

  /**
   * Con las tareas ya cargadas, abre el grupo de la tarea pedida y la marca
   * (una sola vez por destino: al marcar o recargar no vuelve a saltar). Se
   * ajusta el estado durante el render, no en un efecto.
   */
  const [destinoAtendido, setDestinoAtendido] = useState<number | null>(null);
  if (registroDestino !== null && registroDestino !== destinoAtendido && !loading && tareas.length > 0) {
    setDestinoAtendido(registroDestino);
    const grupo = grupos.find((g) => g.tareas.some((t) => t.registro_id === registroDestino));
    if (grupo) {
      setFiltros(FILTROS_INICIALES);
      setGruposExpandidos((previos) => new Set(previos).add(grupo.key));
      setResaltadoId(registroDestino);
    }
  }

  /** Lleva la tarea a la vista; al rato le quita la marca y limpia la URL. */
  useEffect(() => {
    if (resaltadoId === null) return;
    const marco = requestAnimationFrame(() =>
      document
        .getElementById(idTareaChecklist(resaltadoId))
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    const fin = window.setTimeout(() => {
      setResaltadoId(null);
      navigate(pathname, { replace: true });
    }, 2500);
    return () => {
      cancelAnimationFrame(marco);
      window.clearTimeout(fin);
    };
  }, [resaltadoId, navigate, pathname]);

  const operadores = useMemo(() => operadoresDelDia(tareas), [tareas]);
  // El backend ya le recorta la lista a quien solo opera (sus tareas, las que
  // cubre y las sin asignar): filtrar por operador o por "mis tareas" sería
  // filtrar por lo mismo. Quien administra ve todas.
  const tieneTareasPropias = useMemo(
    () => tareas.some((t) => esMiTarea(t, usuarioActual)),
    [tareas, usuarioActual],
  );
  const hayFiltros = hayFiltrosActivos(filtros);

  /** Cada grupo con sus tareas filtradas; los que quedan vacíos no se muestran. */
  const gruposVisibles = useMemo(
    () =>
      grupos
        .map((grupo) => ({
          grupo,
          tareas: grupo.tareas.filter((t) => cumpleFiltros(t, grupo, filtros, usuarioActual)),
        }))
        .filter((g) => g.tareas.length > 0),
    [grupos, filtros, usuarioActual],
  );

  const totalTareas = tareas.length;
  const tareasCompletadas = tareas.filter((t) => t.completado).length;
  const tareasVisibles = gruposVisibles.reduce((n, g) => n + g.tareas.length, 0);
  const todoAbierto = gruposVisibles.length > 0 && gruposVisibles.every((g) => gruposExpandidos.has(g.grupo.key));

  const toggleGrupo = (key: string) => {
    setGruposExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(key)) nuevo.delete(key);
      else nuevo.add(key);
      return nuevo;
    });
  };

  const alternarTodo = () =>
    setGruposExpandidos(todoAbierto ? new Set() : new Set(gruposVisibles.map((g) => g.grupo.key)));

  /**
   * Al filtrar se abren los grupos que quedan: quien busca "sus tareas" quiere
   * verlas, no una lista de acordeones cerrados que hay que abrir uno por uno.
   */
  const cambiarFiltros = (cambio: Partial<FiltrosChecklist>) => {
    // Se parte del estado más reciente: dos cambios seguidos no se pisan.
    setFiltros((previos) => {
      const nuevos = { ...previos, ...cambio };
      if (hayFiltrosActivos(nuevos)) {
        const claves = grupos
          .filter((grupo) => grupo.tareas.some((t) => cumpleFiltros(t, grupo, nuevos, usuarioActual)))
          .map((grupo) => grupo.key);
        setGruposExpandidos(new Set(claves));
      }
      return nuevos;
    });
  };

  return (
    <Pagina
      titulo="Checklist diario de limpieza"
      descripcion={
        esAdmin
          ? "Control, persistencia e historial auditable por fecha, para todos los equipos."
          : "Tus tareas de limpieza del día, las que cubrís como suplente y las que no tienen responsable."
      }
      acciones={
        <BotonCancelar onClick={recargar}>
          <LuRefreshCw aria-hidden />
          Actualizar
        </BotonCancelar>
      }
    >
      <CabeceraChecklist
        fecha={selectedFecha}
        onFecha={setSelectedFecha}
        hechas={tareasCompletadas}
        total={totalTareas}
        visibles={tareasVisibles}
        filtros={filtros}
        onFiltros={cambiarFiltros}
        operadores={operadores}
        hayFiltros={hayFiltros}
        mostrarFiltroOperador={esAdmin}
        mostrarMisTareas={esAdmin && tieneTareasPropias}
        todoAbierto={todoAbierto}
        onAlternarTodo={alternarTodo}
        mostrarFiltros={!loading && totalTareas > 0}
      />

      {error && <BannerError>{error}</BannerError>}

      {loading && <EsqueletoChecklist />}

      {!loading && grupos.length === 0 && !error && (
        <EstadoVacio>No hay tareas de limpieza programadas para la fecha seleccionada.</EstadoVacio>
      )}

      {!loading && grupos.length > 0 && gruposVisibles.length === 0 && (
        <Tarjeta p="8" textAlign="center">
          <Stack align="center" gap="2" color="fg.muted">
            <LuSearchX size={28} aria-hidden />
            <Text color="fg" fontWeight="medium">
              Ninguna tarea coincide con los filtros.
            </Text>
            <Text fontSize="sm">Probá con otro operador, etapa o estado, o limpiá los filtros.</Text>
          </Stack>
        </Tarjeta>
      )}

      {!loading &&
        gruposVisibles.map(({ grupo, tareas: tareasGrupo }) => (
          <GrupoChecklist
            key={grupo.key}
            grupo={grupo}
            estado={estadoGrupo(grupo, selectedFecha, fechaLocalISO(new Date()))}
            abierto={gruposExpandidos.has(grupo.key)}
            onAlternar={() => toggleGrupo(grupo.key)}
            visibles={tareasGrupo.length}
            // Para un operador, sus propias iniciales en cada grupo no dicen nada.
            ocultarUsuarioId={esAdmin ? undefined : usuarioActual?.id}
          >
            {tareasGrupo.map((t) => (
              <TarjetaTarea
                key={t.registro_id > 0 ? `r-${t.registro_id}` : `p-${t.id}`}
                tarea={t}
                isLoading={actualizandoId === t.id}
                insumosQuimicos={insumosQuimicos}
                elementosLimpieza={elementosLimpieza}
                usuarioActual={usuarioActual}
                puedeAsignarCobertura={esAdmin}
                onAsignarCobertura={setCoberturaRegistroId}
                resaltada={t.registro_id > 0 && t.registro_id === resaltadoId}
                onToggle={toggleTarea}
              />
            ))}
          </GrupoChecklist>
        ))}

      {tareaCobertura && (
        <CoberturaDialog
          tarea={tareaCobertura}
          onClose={() => setCoberturaRegistroId(null)}
          onGuardado={recargar}
        />
      )}
    </Pagina>
  );
}

/** Esqueleto mientras cargan las tareas: la forma de los acordeones, no un texto suelto. */
function EsqueletoChecklist() {
  return (
    <Stack gap="3" aria-busy="true" aria-label="Cargando tareas">
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} bg="bg.panel" borderWidth="1px" borderColor="border.subtle" rounded="xl" p="4" ps="6">
          <HStack justify="space-between" gap="4">
            <Stack gap="2" flex="1">
              <Skeleton h="4" w={`${45 - i * 5}%`} />
              <Skeleton h="3" w="25%" />
            </Stack>
            <HStack gap="3">
              <Skeleton boxSize="8" rounded="full" />
              <Skeleton h="2" w="20" rounded="full" />
              <Skeleton h="6" w="24" rounded="full" />
            </HStack>
          </HStack>
        </Box>
      ))}
    </Stack>
  );
}
