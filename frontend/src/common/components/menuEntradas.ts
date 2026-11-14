import { puedeAdministrar, puedeOperar } from "../api/permissions";
import {
  LuApple,
  LuArchive,
  LuBadgeCheck,
  LuBeaker,
  LuBoxes,
  LuBrush,
  LuCalendarClock,
  LuChartPie,
  LuChefHat,
  LuClipboardList,
  LuCog,
  LuContact,
  LuCookingPot,
  LuFactory,
  LuFileSearch,
  LuFileText,
  LuFlaskConical,
  LuFolderSearch,
  LuGlobe,
  LuHistory,
  LuHouse,
  LuListChecks,
  LuMapPin,
  LuMicroscope,
  LuPackage,
  LuRuler,
  LuShieldCheck,
  LuSparkles,
  LuSprayCan,
  LuTriangleAlert,
  LuTruck,
  LuUsers,
  LuWarehouse,
  LuWrench,
} from "react-icons/lu";
import type { IconType } from "react-icons/lib";

/**
 * Cada entrada del menú. La visibilidad por rol se declara acá, en el
 * dato: el mismo elemento es la fuente de verdad del render y puede servir
 * de base para tests de cobertura de rutas. Antes había 15 <Link> copiados
 * a mano: agregar una sección implicaba tocar el render del Navbar y el
 * router por separado, y se desincronizaban.
 */
export type RolMenu = "todos" | "operar" | "administrar";

export interface EntradaMenu {
  to: string;
  label: string;
  rol: RolMenu;
  /**
   * Ícono de la entrada. Va en el dato y no hardcodeado en el render para que
   * agregar una sección sea siempre una línea.
   */
  icon: IconType;
  /** Explicación corta, para las entradas que se muestran como tarjeta. */
  ayuda?: string;
}

export interface GrupoMenu {
  id: string;
  label: string;
  /** Descripción corta que se lee bajo el título del grupo. */
  ayuda: string;
  /** Ícono de la categoría en la barra de navegación. */
  icon: IconType;
  entradas: EntradaMenu[];
}

/**
 * Categorías de la barra de navegación, agrupadas por área de trabajo.
 *
 * Antes eran dos grupos ("Datos maestros" con 13 entradas y "Operaciones" con
 * 14), divididos por naturaleza del dato. Para encontrar algo había que saber
 * si era un catálogo o una operación: los planes de limpieza estaban en
 * Operaciones y los elementos de limpieza en Datos maestros, y el stock
 * aparecía en tres lugares con nombres parecidos ("Stock de Insumos",
 * "Gestión de Stock", "Insumos Químicos").
 *
 * Ahora cada grupo es un área, y dentro de cada una van primero las entradas
 * del día a día y después los catálogos. Los dos stocks quedan cada uno en su
 * área y con nombre propio: "Stock de insumos" (materia prima, Inventario) y
 * "Stock de químicos" (productos de limpieza, Limpieza).
 *
 * Tampoco hay entrada "Trazabilidad": la trazabilidad hacia atrás está en la
 * ficha de cada lote, y la hacia adelante se abre desde Stock de insumos →
 * Lotes recibidos. Las dos listas buscan por número de lote.
 *
 * Las acciones no son entradas: "Registrar lote" es el botón "Nuevo lote" del
 * listado de lotes. "Reportar incidente" sí queda, porque para quien opera es
 * la pantalla de sus reportes, no solo el formulario.
 *
 * La barra (`Navbar`) muestra primero solo las categorías; al abrir una, la
 * reemplaza por sus opciones.
 */
export const GRUPOS: GrupoMenu[] = [
  {
    id: "produccion",
    label: "Producción",
    ayuda: "Lotes, recetas y productos",
    icon: LuChefHat,
    entradas: [
      { to: "/lotes", label: "Lotes de producción", rol: "operar", icon: LuFactory },
      // E9: la receta vigente se consulta como el checklist diario.
      { to: "/recetas", label: "Recetas", rol: "operar", icon: LuCookingPot },
      { to: "/productos", label: "Productos", rol: "administrar", icon: LuBoxes },
      // E11: redondeo, valores diarios y base de composición de la tabla nutricional.
      { to: "/nutricion", label: "Parámetros nutricionales", rol: "administrar", icon: LuApple },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    ayuda: "Materia prima y proveedores",
    icon: LuArchive,
    entradas: [
      { to: "/stock-insumos", label: "Stock de insumos", rol: "administrar", icon: LuWarehouse },
      { to: "/insumos", label: "Insumos", rol: "administrar", icon: LuPackage },
      { to: "/aditivos", label: "Aditivos", rol: "administrar", icon: LuBeaker },
      { to: "/proveedores", label: "Proveedores", rol: "administrar", icon: LuTruck },
    ],
  },
  {
    id: "limpieza",
    label: "Limpieza",
    ayuda: "Checklist, planes y químicos",
    icon: LuSprayCan,
    entradas: [
      { to: "/checklist", label: "Checklist diario", rol: "operar", icon: LuListChecks },
      {
        to: "/checklist/historial",
        label: "Historial de checklists",
        rol: "administrar",
        icon: LuHistory,
      },
      { to: "/planes-limpieza", label: "Planes de limpieza", rol: "administrar", icon: LuSparkles },
      { to: "/gestion-stock", label: "Stock de químicos", rol: "administrar", icon: LuChartPie },
      {
        to: "/insumos-quimicos",
        label: "Insumos químicos",
        rol: "administrar",
        icon: LuFlaskConical,
      },
      {
        to: "/elementos-limpieza",
        label: "Elementos de limpieza",
        rol: "administrar",
        icon: LuBrush,
      },
    ],
  },
  {
    id: "equipos",
    label: "Equipos",
    ayuda: "Equipos y su mantenimiento",
    icon: LuCog,
    entradas: [
      { to: "/equipos", label: "Equipos", rol: "administrar", icon: LuMicroscope },
      {
        to: "/planes-calibracion-mantenimiento",
        label: "Calibración y mantenimiento",
        rol: "administrar",
        icon: LuWrench,
      },
    ],
  },
  {
    id: "calidad",
    label: "Calidad",
    ayuda: "Incidentes, documentos y vencimientos",
    icon: LuShieldCheck,
    entradas: [
      {
        to: "/incidentes/reportar",
        label: "Reportar incidente",
        rol: "operar",
        icon: LuTriangleAlert,
      },
      {
        to: "/incidentes",
        label: "Gestión de incidentes",
        rol: "administrar",
        icon: LuClipboardList,
      },
      { to: "/vencimientos", label: "Vencimientos", rol: "administrar", icon: LuCalendarClock },
      {
        to: "/consulta-documentos",
        label: "Consultar documentos",
        rol: "operar",
        icon: LuFolderSearch,
      },
      { to: "/documentos", label: "Documentos", rol: "administrar", icon: LuFileText },
      { to: "/auditoria", label: "Auditoría", rol: "administrar", icon: LuFileSearch },
    ],
  },
  {
    id: "personas",
    label: "Personas",
    ayuda: "Personal y aptitudes",
    icon: LuContact,
    entradas: [
      { to: "/personal", label: "Personal", rol: "administrar", icon: LuUsers },
      { to: "/aptitudes", label: "Aptitudes", rol: "administrar", icon: LuBadgeCheck },
    ],
  },
];

/**
 * Panel de una categoría: la pantalla con sus indicadores, que se abre al
 * elegirla en la barra (`PanelCategoriaPage`).
 */
export const BASE_PANEL = "/resumen";

export function rutaPanel(grupo: Pick<GrupoMenu, "id">): string {
  return `${BASE_PANEL}/${grupo.id}`;
}

/** Enlaces sueltos, fuera de cualquier grupo. */
export const MENU: EntradaMenu[] = [
  /*
   * Va primero en la lista —entre el botón de plegar y "Inicio"— para que
   * quede fijo arriba del todo: es la entrada más personal de la barra y no
   * debería scrollearse nunca.
   */
  // { to: "/mi-perfil", label: "Mi perfil", rol: "todos", icon: LuUserRound },
  { to: "/", label: "Inicio", rol: "todos", icon: LuHouse },
];

/** Pantalla de configuración: se abre desde el menú de usuario (el avatar). */
export const RUTA_CONFIGURACION = "/configuracion";

/**
 * Catálogos generales y ajustes. No van en la barra de navegación: se usan
 * poco, así que están todos juntos en la pantalla de Configuración
 * (`ConfiguracionPage`), que los muestra como tarjetas. Siguen apareciendo en
 * el buscador y en las migas de pan.
 */
export const CONFIGURACION: EntradaMenu[] = [
  {
    to: "/sectores",
    label: "Sectores",
    rol: "administrar",
    icon: LuMapPin,
    ayuda: "Áreas de la planta donde se ubican los equipos y se asignan las tareas.",
  },
  {
    to: "/unidades-medida",
    label: "Unidades de medida",
    rol: "administrar",
    icon: LuRuler,
    ayuda: "Unidades con las que se miden insumos, recetas y productos.",
  },
  {
    to: "/vista-publica",
    label: "Vista pública",
    rol: "administrar",
    icon: LuGlobe,
    ayuda: "Qué información se muestra en la página pública de la empresa.",
  },
];

export const TODAS_LAS_ENTRADAS: EntradaMenu[] = [
  ...MENU,
  ...GRUPOS.flatMap((g) => g.entradas),
  ...CONFIGURACION,
];

export function esVisibleEntrada(
  entrada: EntradaMenu,
  user: Parameters<typeof puedeOperar>[0]
): boolean {
  if (entrada.rol === "todos") return true;
  if (entrada.rol === "operar") return puedeOperar(user);
  return puedeAdministrar(user);
}
