import { useEffect, useMemo, useState } from "react";
import { Box, HStack, Skeleton, Stack, Text } from "@chakra-ui/react";
import { LuRefreshCw, LuSearchX } from "react-icons/lu";
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
  estadoGrupo,
  hayFiltrosActivos,
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
  const operadores = useMemo(() => operadoresDelDia(tareas), [tareas]);
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
      descripcion="Control, persistencia e historial auditable por fecha, para todos los equipos."
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
        hayUsuario={Boolean(usuarioActual)}
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
                onToggle={toggleTarea}
              />
            ))}
          </GrupoChecklist>
        ))}

      {coberturaRegistroId !== null && (
        <CoberturaDialog
          registroId={coberturaRegistroId}
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
