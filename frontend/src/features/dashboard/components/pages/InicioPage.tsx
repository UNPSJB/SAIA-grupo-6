import { useMemo, useState } from "react";
import { Box, Flex, Grid, Heading } from "@chakra-ui/react";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
  EstadoVacio,
  PageHeader,
} from "../../../../components/ui/patrones";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import { useDashboard } from "../../hooks/useDashboard";
import {
  alertasDelPanel,
  type AlertaPanel,
  calcularCumplimiento,
  calcularEquiposCalibrados,
  incidentesPorSemana,
  partesPorTipo,
} from "../../types/dashboard";
import { GraficoTorta } from "../GraficoTorta";
import { TarjetaAlertas } from "../TarjetaAlertas";
import { TarjetaCumplimiento } from "../TarjetaCumplimiento";
import { TarjetaEquiposCalibrados } from "../TarjetaEquiposCalibrados";
import { TarjetaIniciadosResueltos } from "../TarjetaIniciadosResueltos";

/** Cuántas filas se listan en "Requiere atención" (vencimientos e incidentes). */
const ALERTAS_VISIBLES = 5;

/**
 * Panel principal.
 *
 * Reúne lo que hay que mirar al abrir la app: el cumplimiento de los
 * checklists del día, el estado de calibración de los equipos, cómo se reparten
 * los incidentes, cómo evolucionan en el mes y las alertas más urgentes.
 *
 * TODO EL PANEL EN UNA PANTALLA, SIN SCROLL (en pantallas anchas).
 *
 * El `LayoutPrincipal` de `router.tsx` es una columna de alto `100vh` con
 * `overflowY="auto"`, así que esta página se mide contra el alto de la ventana y
 * no contra su contenido: la caja es `flex="1"` de esa columna y la grilla toma
 * todo el alto.
 *
 * Son dos columnas independientes, como en el panel de referencia:
 *
 *   izquierda (3/5)   [Cumplimiento] [Equipos calibrados]
 *                     [        Requiere atención        ]
 *   derecha   (2/5)   [   Incidentes por categoría   ]
 *                     [   Iniciados vs resueltos     ]
 *
 * Cada columna apila sus tarjetas y la última (`flex="1"`) se estira hasta el
 * pie, así las dos terminan a la misma altura aunque una tenga más contenido.
 * Antes era una sola grilla de 6 columnas con cada tarjeta ubicada por fila; con
 * una torta alta en la primera fila obligaba a las de indicadores a estirarse
 * para igualarla, y en la referencia los indicadores son chicos.
 *
 * Las tarjetas de incidentes, calibración y alertas solo se pintan para quien
 * puede administrar: sus endpoints son de administración y pedirlos como
 * operador es un 403. Es el mismo criterio con el que el menú lateral oculta
 * las secciones que no se pueden usar.
 */
export function InicioPage() {
  const {
    cumplimiento,
    incidentes,
    alertas,
    calibracion,
    verOperacion,
    verIncidentes,
    recargarAlertas,
  } = useDashboard();

  // Recambio de un elemento de limpieza desde la lista de alertas: qué fila se
  // está procesando y los avisos de resultado (se apagan solos).
  const [recambiando, setRecambiando] = useState<string | null>(null);
  const exito = useAvisoTemporal<string>(1500);
  const fallo = useAvisoTemporal<string>(5000);

  const resumen = useMemo(
    () => calcularCumplimiento(cumplimiento.datos.tareas),
    [cumplimiento.datos]
  );

  const partes = useMemo(() => partesPorTipo(incidentes.datos), [incidentes.datos]);

  const filasAlertas = useMemo(
    () => alertasDelPanel(alertas.datos, incidentes.datos, ALERTAS_VISIBLES),
    [alertas.datos, incidentes.datos]
  );

  const estadoCalibracion = useMemo(
    () =>
      calcularEquiposCalibrados(calibracion.datos.equipos, calibracion.datos.planes),
    [calibracion.datos]
  );

  const serie = useMemo(() => incidentesPorSemana(incidentes.datos), [incidentes.datos]);

  /**
   * Mismo flujo que "Registrar recambio" del centro de notificaciones: se
   * registra, se le avisa a la campana (que escucha este evento para
   * actualizar su contador) y se recargan las alertas, que ya no incluyen el
   * elemento recién cambiado.
   */
  const registrarRecambio = async (alerta: AlertaPanel) => {
    if (alerta.recambioId === null) return;

    setRecambiando(alerta.clave);
    try {
      await registrarRecambioElemento(alerta.recambioId);
      window.dispatchEvent(new Event("actualizar_notificaciones"));
      exito.avisar("Recambio registrado correctamente.");
      await recargarAlertas();
    } catch (e) {
      fallo.avisar(
        e instanceof Error ? e.message : "No se pudo registrar el recambio"
      );
    } finally {
      setRecambiando(null);
    }
  };

  // Usuario sin ningún permiso habilitado: no hay nada que pedir, así que se
  // dice en vez de mostrar tarjetas vacías.
  if (!verOperacion && !verIncidentes) {
    return (
      <Box flex="1" display="flex" flexDirection="column">
        <Box flexShrink={0}>
          <PageHeader title="Panel principal" mb="4" />
        </Box>
        <EstadoVacio>
          Tu usuario no tiene permisos habilitados para ver el panel. Comunicate
          con un administrador.
        </EstadoVacio>
      </Box>
    );
  }

  return (
    /*
      Sin `p="5"`: el `LayoutPrincipal` ya deja 15px de padding vertical en la
      columna de contenido. Repetirlo acá empujaba las tarjetas hacia abajo.
    */
    <Box flex="1" display="flex" flexDirection="column">
      {/*
        El panel ya no lleva encabezado visible (la referencia arranca
        directamente con las tarjetas), pero la página conserva su `h2`: las
        tarjetas son `h3` y sin un `h2` arriba el lector de pantalla las
        encuentra colgando de la nada.
      */}
      <Heading
        as="h2"
        position="absolute"
        w="1px"
        h="1px"
        m="-1px"
        p="0"
        overflow="hidden"
        clipPath="inset(50%)"
        whiteSpace="nowrap"
      >
        Panel principal
      </Heading>

      <DialogoExito isOpen={exito.valor !== null} mensaje={exito.valor ?? ""} />

      {fallo.valor && <BannerError mb="4">{fallo.valor}</BannerError>}

      <Grid
        templateColumns={{
          base: "1fr",
          xl: verIncidentes ? "minmax(0, 3fr) minmax(0, 2fr)" : "1fr",
        }}
        templateRows={{ xl: "1fr" }}
        gap="6"
        flex="1"
      >
        {/* Columna izquierda: indicadores arriba y alertas abajo. */}
        <Flex direction="column" gap="6" minW="0">
          {/*
            `auto-fit`: con dos tarjetas se reparten el ancho a mitades, y con
            una sola (el operador no ve la de equipos) ocupa todo.
          */}
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
            gap="6"
          >
            {verOperacion && (
              <TarjetaCumplimiento
                total={resumen.total}
                completadas={resumen.completadas}
                porcentaje={resumen.porcentaje}
                loading={cumplimiento.loading}
                error={cumplimiento.error}
              />
            )}

            {verIncidentes && (
              <TarjetaEquiposCalibrados
                estado={estadoCalibracion}
                loading={calibracion.loading}
                error={calibracion.error}
              />
            )}
          </Grid>

          {verIncidentes && (
            <TarjetaAlertas
              alertas={filasAlertas}
              loading={alertas.loading || incidentes.loading}
              error={alertas.error}
              onRecambio={registrarRecambio}
              recambiando={recambiando}
              flex="1"
              h="auto"
            />
          )}
        </Flex>

        {/* Columna derecha: la torta y la serie del mes. */}
        {verIncidentes && (
          <Flex direction="column" gap="6" minW="0">
            <GraficoTorta
              partes={partes}
              loading={incidentes.loading}
              error={incidentes.error}
              h="auto"
              flexShrink={0}
            />

            <TarjetaIniciadosResueltos
              datos={serie}
              loading={incidentes.loading}
              error={incidentes.error}
              flex="1"
              h="auto"
            />
          </Flex>
        )}
      </Grid>
    </Box>
  );
}
