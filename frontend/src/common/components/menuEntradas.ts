import { puedeAdministrar, puedeOperar } from "../api/permissions";
import {
  LuBadgeCheck,
  LuFileSearch,
  LuMapPin,
  LuBrush,
  LuCalendarClock,
  LuChartPie,
  LuClipboardCheck,
  LuClipboardList,
  LuDatabase,
  LuFileText,
  LuFlaskConical,
  LuFolderSearch,
  LuHistory,
  LuDownload,
  LuHouse,
  LuListChecks,
  LuMicroscope,
  LuPackage,
  LuRuler,
  LuSparkles,
  LuTriangleAlert,
  LuTruck,
  LuUsers,
  LuWrench,
  LuGlobe,
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
 * Secciones del sidebar.
 *
 * Antes eran 17 enlaces en una sola lista plana. Con el panel completo no
 * entraban todos sin zoom out y, peor, no había forma de hacer scroll: los
 * últimos (Gestión de Incidentes, Documentos) quedaban inalcanzables en
 * pantallas de notebook.
 *
 * La división es por naturaleza del dato, no por módulo:
 *
 *   - Datos maestros: el catálogo que se carga una vez y cambia poco
 *     (equipos, personal, unidades, insumos, aptitudes, documentos).
 *   - Operaciones: lo que se consulta todos los días (checklists,
 *     incidentes, planes, calibraciones, historial, consumo).
 */
export const GRUPOS: GrupoMenu[] = [
  {
    id: "maestros",
    label: "Datos maestros",
    ayuda: "Catálogos y configuración",
    icon: LuDatabase,
    entradas: [
      { to: "/equipos", label: "Equipos", rol: "administrar", icon: LuMicroscope },
      { to: "/personal", label: "Personal", rol: "administrar", icon: LuUsers },
      {
        to: "/unidades-medida",
        label: "Unidades de Medida",
        rol: "administrar",
        icon: LuRuler,
      },
      { to: "/insumos", label: "Insumos", rol: "administrar", icon: LuPackage },
      {
        to: "/insumos-quimicos",
        label: "Insumos Químicos",
        rol: "administrar",
        icon: LuFlaskConical,
      },
      { to: "/proveedores", label: "Proveedores", rol: "administrar", icon: LuTruck },
      {
        to: "/elementos-limpieza",
        label: "Elementos de Limpieza",
        rol: "administrar",
        icon: LuBrush,
      },
      { to: "/aptitudes", label: "Aptitudes", rol: "administrar", icon: LuBadgeCheck },
      { to: "/sectores", label: "Sectores", rol: "administrar", icon: LuMapPin },
      { to: "/auditoria", label: "Auditoría", rol: "administrar", icon: LuFileSearch },
      
      { to: "/documentos", label: "Documentos", rol: "administrar", icon: LuFileText },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    ayuda: "Trabajo diario",
    icon: LuClipboardCheck,
    entradas: [
      { to: "/checklist", label: "Checklist Diario", rol: "operar", icon: LuListChecks },
      {
        to: "/incidentes/reportar",
        label: "Reportar Incidente",
        rol: "operar",
        icon: LuTriangleAlert,
      },
      {
        to: "/incidentes",
        label: "Gestión de Incidentes",
        rol: "administrar",
        icon: LuClipboardList,
      },
      {
        to: "/planes-limpieza",
        label: "Planes de Limpieza",
        rol: "administrar",
        icon: LuSparkles,
      },
      {
        to: "/planes-calibracion-mantenimiento",
        label: "Calibración/Mantenimiento",
        rol: "administrar",
        icon: LuWrench,
      },
      {
        to: "/checklist/historial",
        label: "Historial de Checklists",
        rol: "administrar",
        icon: LuHistory,
      },
      {
        to: "/vencimientos",
        label: "Vencimientos",
        rol: "administrar",
        icon: LuCalendarClock,
      },
      {
        to: "/gestion-stock",
        label: "Gestión de Stock",
        rol: "administrar",
        icon: LuChartPie,
      },
      {
        to: "/consulta-documentos",
        label: "Consultar Documentos",
        rol: "operar",
        icon: LuFolderSearch,
      },
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
  { to: "/vista-publica", label: "Vista pública", rol: "administrar", icon: LuGlobe },
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
