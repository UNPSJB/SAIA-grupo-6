import { Fragment, useMemo } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Breadcrumb, Text } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import { useAuth } from "../context/useAuth";
import {
  BASE_PANEL,
  CONFIGURACION,
  GRUPOS,
  RUTA_CONFIGURACION,
  rutaPanel,
  TODAS_LAS_ENTRADAS,
  esVisibleEntrada,
} from "./menuEntradas";

type Usuario = Parameters<typeof esVisibleEntrada>[1];

interface Miga {
  to: string;
  label: string;
  /** Es la página donde estás parado: no es un link. */
  actual: boolean;
  /** Se puede hacer clic (existe en el menú y el usuario tiene permiso). */
  enlace: boolean;
}

/** Segmentos de la URL que no son una sección del menú. */
const ETIQUETAS: Record<string, string> = {
  nuevo: "Nuevo",
  editar: "Editar",
  detalle: "Detalle",
  intervencion: "Intervención",
  reportar: "Reportar",
  historial: "Historial",
  notificaciones: "Notificaciones",
  configuracion: "Configuración",
  "sin-permisos": "Sin permisos",
  "nueva-version": "Nueva versión",
  "lotes-producto": "Lote de producto",
  "lotes-insumo": "Lote de insumo",
  escalar: "Escalar",
  composicion: "Composición",
  "informacion-nutricional": "Información nutricional",
  "rotulado-frontal": "Rotulado frontal",
  nutricion: "Datos nutricionales",
};

/**
 * Secciones cuya ruta `/<seccion>/:id` es una página de detalle. En las
 * pantallas que cuelgan de ese detalle (`/recetas/3/nueva-version`) el id se
 * muestra como la miga "Detalle", con enlace. En las demás (`/insumos/3/editar`)
 * no hay página `/insumos/3` y el id no se muestra.
 */
const SECCIONES_CON_DETALLE = new Set(["recetas", "lotes", "incidentes"]);

/**
 * Segmentos que, seguidos de un id, no se muestran: la composición vive en
 * `/recetas/3/versiones/7/composicion` pero la versión se elige dentro del
 * detalle de la receta, no hay pantalla "Versiones" a la que volver.
 */
const SEGMENTOS_OCULTOS_CON_ID = new Set(["versiones"]);

/** "planes-limpieza" -> "Planes limpieza" (último recurso). */
function legible(segmento: string): string {
  const texto = segmento.replace(/-/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Arma las migas a partir de la URL. Los nombres salen del propio menú
 * (`TODAS_LAS_ENTRADAS`), así que si se renombra una sección en el menú, el
 * breadcrumb se actualiza solo.
 */
function construirMigas(pathname: string, user: Usuario): Miga[] {
  const segmentos = pathname.split("/").filter(Boolean);
  const migas: Miga[] = [{ to: "/", label: "Inicio", actual: false, enlace: true }];

  // Sectores, unidades de medida y vista pública cuelgan de Configuración
  // aunque su URL no lo diga: se llega a ellas desde esa pantalla.
  if (CONFIGURACION.some((e) => e.to === `/${segmentos[0]}`)) {
    migas.push({ to: RUTA_CONFIGURACION, label: "Configuración", actual: false, enlace: true });
  }

  // Panel de una categoría (`/resumen/produccion`): una sola miga con su nombre.
  if (`/${segmentos[0]}` === BASE_PANEL) {
    const grupo = GRUPOS.find((g) => g.id === segmentos[1]);
    if (grupo) migas.push({ to: rutaPanel(grupo), label: grupo.label, actual: true, enlace: false });
    return migas;
  }

  // Las pantallas de una categoría cuelgan de su panel: "Inicio > Producción >
  // Recetas".
  const grupoDeLaRuta = GRUPOS.find((g) =>
    g.entradas.some((e) => pathname === e.to || pathname.startsWith(`${e.to}/`)),
  );
  if (grupoDeLaRuta) {
    migas.push({
      to: rutaPanel(grupoDeLaRuta),
      label: grupoDeLaRuta.label,
      actual: false,
      enlace: grupoDeLaRuta.entradas.some((e) => esVisibleEntrada(e, user)),
    });
  }

  let acumulada = "";
  segmentos.forEach((segmento, i) => {
    acumulada += `/${segmento}`;
    const esUltimo = i === segmentos.length - 1;

    const esId = (s: string | undefined) => s !== undefined && /^\d+$/.test(s);

    // Los ids no se muestran con su número (no sabemos el nombre del
    // registro): son la miga "Detalle". En `/incidentes/5` es la página
    // actual; en `/recetas/3/nueva-version`, un enlace al detalle de la receta.
    if (esId(segmento)) {
      if (segmentos[i - 1] === "detalle") return;
      if (esUltimo) {
        migas.push({ to: acumulada, label: "Detalle", actual: false, enlace: false });
      } else if (i === 1 && SECCIONES_CON_DETALLE.has(segmentos[0])) {
        const seccion = TODAS_LAS_ENTRADAS.find((e) => e.to === `/${segmentos[0]}`);
        migas.push({
          to: acumulada,
          label: "Detalle",
          actual: false,
          enlace: !seccion || esVisibleEntrada(seccion, user),
        });
      }
      return;
    }

    if (SEGMENTOS_OCULTOS_CON_ID.has(segmento) && esId(segmentos[i + 1]) && esId(segmentos[i - 1])) {
      return;
    }

    const entrada = TODAS_LAS_ENTRADAS.find((e) => e.to === acumulada);
    migas.push({
      to: acumulada,
      label: entrada?.label ?? ETIQUETAS[segmento] ?? legible(segmento),
      actual: false,
      // Solo es link si es una sección real del menú y la persona puede verla.
      enlace: !!entrada && esVisibleEntrada(entrada, user),
    });
  });

  // La última miga es la página actual: sin link.
  const ultima = migas[migas.length - 1];
  ultima.actual = true;
  ultima.enlace = false;

  return migas;
}

/** Ruta de navegación de la página actual. No recibe props: lee la URL. */
export function Breadcrumbs() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const migas = useMemo(
    () => (user ? construirMigas(pathname, user) : []),
    [pathname, user],
  );

  if (!user) return null;

  return (
    <Breadcrumb.Root size="sm" minW={0}>
      <Breadcrumb.List flexWrap="nowrap"> 
        {migas.map((miga, i) => (
          <Fragment key={miga.to}>
            {i > 0 && (
              <Breadcrumb.Separator>
                <LuChevronRight size={14} aria-hidden />
              </Breadcrumb.Separator>
            )}
            <Breadcrumb.Item>
              {miga.actual ? (
                <Breadcrumb.CurrentLink fontWeight="bold" color="brand.700">
                  {miga.label}
                </Breadcrumb.CurrentLink>
              ) : miga.enlace ? (
                <Breadcrumb.Link asChild>
                  <RouterLink to={miga.to}>{miga.label}</RouterLink>
                </Breadcrumb.Link>
              ) : (
                <Text as="span" color="fg.muted">
                  {miga.label}
                </Text>
              )}
            </Breadcrumb.Item>
          </Fragment>
        ))}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );
}
