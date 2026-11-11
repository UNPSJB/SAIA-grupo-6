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
  LuContainer,
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
  LuSettings,
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
   * Ícono de la entrada.
   *
   * Antes el `NavItem` solo pintaba el texto, así que con el sidebar colapsado
   * a una barra de íconos las opciones quedaban sin nada que mostrar. Va en el
   * dato y no hardcodeado en el render para que agregar una sección sea
   * siempre una línea.
   */
  icon: IconType;
}

export interface GrupoMenu {
  id: string;
  label: string;
  /** Descripción corta que se lee bajo el título del grupo. */
  ayuda: string;
  /** Ícono del grupo: con el sidebar colapsado es el separador de sección. */
  icon: IconType;
  entradas: EntradaMenu[];
}

/**
 * Secciones del sidebar, agrupadas por área de trabajo.
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
 * Los grupos arrancan cerrados y se abre solo el de la pantalla actual
 * (`Navbar`), así que siete grupos no alargan el menú.
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
      { to: "/clientes", label: "Clientes", rol: "administrar", icon: LuUsers },
      { to: "/transportistas", label: "Transportistas", rol: "administrar", icon: LuContainer },
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
  {
    id: "configuracion",
    label: "Configuración",
    ayuda: "Catálogos generales y vista pública",
    icon: LuSettings,
    entradas: [
      { to: "/sectores", label: "Sectores", rol: "administrar", icon: LuMapPin },
      { to: "/unidades-medida", label: "Unidades de medida", rol: "administrar", icon: LuRuler },
      { to: "/vista-publica", label: "Vista pública", rol: "administrar", icon: LuGlobe },
    ],
  },
];

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

export const TODAS_LAS_ENTRADAS: EntradaMenu[] = [
  ...MENU,
  ...GRUPOS.flatMap((g) => g.entradas),
];

export const ANCHO_EXPANDIDO_PX = 280;
export const ANCHO_COLAPSADO_PX = 64;

/** Ancho del sidebar plegado; el layout lo reserva siempre. */
export const ANCHO_COLAPSADO = `${ANCHO_COLAPSADO_PX}px`;

export function esVisibleEntrada(
  entrada: EntradaMenu,
  user: Parameters<typeof puedeOperar>[0]
): boolean {
  if (entrada.rol === "todos") return true;
  if (entrada.rol === "operar") return puedeOperar(user);
  return puedeAdministrar(user);
}
