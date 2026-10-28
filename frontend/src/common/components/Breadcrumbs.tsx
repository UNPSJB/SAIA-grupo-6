import { Fragment, useMemo } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Breadcrumb, Text } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import { useAuth } from "../context/useAuth";
import { TODAS_LAS_ENTRADAS, esVisibleEntrada } from "./Navbar";

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
  "sin-permisos": "Sin permisos",
};

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
export function construirMigas(pathname: string, user: Usuario): Miga[] {
  const segmentos = pathname.split("/").filter(Boolean);
  const migas: Miga[] = [{ to: "/", label: "Inicio", actual: false, enlace: true }];

  let acumulada = "";
  segmentos.forEach((segmento, i) => {
    acumulada += `/${segmento}`;
    const esUltimo = i === segmentos.length - 1;

    // Los ids no se muestran (no sabemos el nombre del registro), salvo en
    // páginas tipo `/incidentes/5`, donde el id es lo único que sigue.
    if (/^\d+$/.test(segmento)) {
      if (esUltimo && segmentos[i - 1] !== "detalle") {
        migas.push({ to: acumulada, label: "Detalle", actual: false, enlace: false });
      }
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
      <Breadcrumb.List>
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