import { useMemo } from "react";
import type { Pagina } from "../../../../common/api/paginacion";
import { formatoFecha } from "../../../../common/utils/fechas";
import { listarAptitudes } from "../../../aptitud/services/aptitudService";
import type { Aptitud } from "../../../aptitud/types/aptitud";
import { listarPersonal } from "../../../personal/services/personalService";
import type { Persona } from "../../../personal/types/personal";
import { obtenerVencimientos } from "../../../vencimientos/services/vencimientoService";
import type { VencimientoConsolidado } from "../../../vencimientos/types/vencimiento";
import { useBloque } from "../../hooks/useBloque";
import {
  FILAS_LISTA,
  PAGINA_COMPLETA,
  contarPor,
  estadoPlazo,
} from "../../types/panelCategoria";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  GrillaIndicadores,
  Indicador,
  ListaPanel,
  VerTodos,
} from "../piezasPanel";

const cargarPersonal = () => listarPersonal(1, PAGINA_COMPLETA);
const cargarAptitudes = () => listarAptitudes();
const cargarVencimientos = () => obtenerVencimientos("PERSONAL");

const SIN_PERSONAL: Pagina<Persona> = {
  items: [],
  total: 0,
  page: 1,
  page_size: PAGINA_COMPLETA,
  total_paginas: 0,
};

/** Rol excluyente, con el mismo criterio que el filtro del listado de personal. */
function rolDe(persona: Persona): string {
  if (persona.es_super_admin) return "Super administradores";
  if (persona.puede_administrar) return "Administradores";
  if (persona.puede_operar) return "Operadores";
  return "Sin permisos";
}

/**
 * Panel de Personas: cuánta gente hay y con qué rol, y sobre todo si sus
 * aptitudes (carnet sanitario, cursos) están al día, que es lo que una
 * auditoría mira primero.
 */
export function PanelPersonas() {
  const personal = useBloque<Pagina<Persona>>(
    cargarPersonal,
    SIN_PERSONAL,
    "No se pudo cargar el personal",
  );
  const aptitudes = useBloque<Aptitud[]>(cargarAptitudes, [], "No se pudieron cargar las aptitudes");
  const vencimientos = useBloque<VencimientoConsolidado[]>(
    cargarVencimientos,
    [],
    "No se pudieron cargar los vencimientos del personal",
  );

  const porRol = useMemo(() => contarPor(personal.datos.items, rolDe), [personal.datos]);
  const conTemporal = personal.datos.items.filter((p) => p.debe_cambiar_password).length;

  const vencidos = vencimientos.datos.filter((v) => v.estado === "VENCIDO");
  const proximos = vencimientos.datos.filter((v) => v.estado === "PROXIMO");
  const atencion = useMemo(
    () =>
      vencimientos.datos
        .filter((v) => v.estado !== "VIGENTE")
        .sort((a, b) => a.dias_restantes - b.dias_restantes),
    [vencimientos.datos],
  );
  const personasConVencidos = new Set(vencidos.map((v) => v.sujeto_id)).size;

  // Qué aptitudes concentran los problemas (vencidas o por vencer).
  const porAptitud = useMemo(() => contarPor(atencion, (v) => v.detalle), [atencion]);

  return (
    <>
      <GrillaIndicadores>
        <Indicador
          titulo="Personal activo"
          valor={personal.datos.total}
          to="/personal"
          loading={personal.loading}
          error={personal.error}
        />
        <Indicador
          titulo="Aptitudes vencidas"
          valor={vencidos.length}
          detalle={
            vencidos.length > 0
              ? `De ${personasConVencidos} ${personasConVencidos === 1 ? "persona" : "personas"}`
              : "Ninguna vencida"
          }
          tono={vencidos.length > 0 ? "peligro" : undefined}
          to="/vencimientos"
          loading={vencimientos.loading}
          error={vencimientos.error}
        />
        <Indicador
          titulo="Aptitudes por vencer"
          valor={proximos.length}
          detalle="Dentro del plazo de alerta configurado"
          tono={proximos.length > 0 ? "alerta" : undefined}
          to="/vencimientos"
          loading={vencimientos.loading}
          error={vencimientos.error}
        />
        <Indicador
          titulo="Aptitudes definidas"
          valor={aptitudes.datos.filter((a) => a.activo).length}
          to="/aptitudes"
          loading={aptitudes.loading}
          error={aptitudes.error}
        />
        <Indicador
          titulo="Con contraseña temporal"
          valor={conTemporal}
          detalle={conTemporal > 0 ? "Todavía no la cambiaron" : "Todos la cambiaron"}
          tono={conTemporal > 0 ? "alerta" : undefined}
          loading={personal.loading}
          error={personal.error}
        />
      </GrillaIndicadores>

      <GrillaBloques>
        <Bloque
          titulo="Aptitudes vencidas o por vencer"
          descripcion="De lo más urgente a lo más lejano"
          loading={vencimientos.loading}
          error={vencimientos.error}
          vacio={atencion.length === 0 && "Todas las aptitudes del personal están al día."}
        >
          <ListaPanel
            filas={atencion.slice(0, FILAS_LISTA).map((v) => ({
              clave: v.id_vencimiento,
              titulo: v.sujeto,
              detalle: `${v.detalle} · ${formatoFecha(v.fecha_vencimiento)}`,
              estado: estadoPlazo(v.dias_restantes),
              to: `/personal/detalle/${v.sujeto_id}`,
            }))}
          />
          <VerTodos to="/vencimientos">Ver los vencimientos</VerTodos>
        </Bloque>

        <Bloque
          titulo="Personal por rol"
          descripcion="Personas activas según su rol en el sistema"
          loading={personal.loading}
          error={personal.error}
          vacio={porRol.length === 0 && "No hay personal cargado."}
        >
          <BarrasHorizontales datos={porRol} unidad="personas" />
        </Bloque>

        <Bloque
          titulo="Aptitudes con más pendientes"
          descripcion="Vencidas y por vencer, agrupadas por aptitud"
          loading={vencimientos.loading}
          error={vencimientos.error}
          vacio={porAptitud.length === 0 && "No hay aptitudes pendientes de renovar."}
        >
          <BarrasHorizontales datos={porAptitud.slice(0, 8)} unidad="vencimientos" />
        </Bloque>
      </GrillaBloques>
    </>
  );
}
