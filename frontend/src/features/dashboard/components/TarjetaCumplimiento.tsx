import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Stack,
  Text,
  type BoxProps,
} from "@chakra-ui/react";
import { hoyISO } from "../../../common/utils/fechas";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import { GraficoCumplimiento } from "../../checklist/components/GraficoCumplimiento";
import type { PeriodoLimpieza } from "../hooks/useDashboard";
import { AnilloProgreso } from "./AnilloProgreso";
import { TarjetaPanel } from "./TarjetaPanel";

interface TarjetaCumplimientoProps {
  total: number;
  completadas: number;
  porcentaje: number;
  loading: boolean;
  error: string | null;
  /**
   * Si viene, la tarjeta suma el selector Hoy | Período con el gráfico de
   * líneas. Sin esta prop (un operador) se comporta como siempre: solo el día
   * de hoy.
   */
  periodo?: PeriodoLimpieza;
}

type Vista = "hoy" | "periodo";

/**
 * Estado del día según el porcentaje.
 *
 * Una sola tabla decide el color del anillo, el del badge y la frase, para que
 * no puedan contradecirse (un anillo rojo con un "Buen avance"). El color
 * codifica el estado y no decora: verde al día, teal en marcha, ámbar por
 * debajo de la mitad, rojo cuando la carga ya no se levanta.
 */
function estadoDelDia(total: number, porcentaje: number) {
  if (total === 0) {
    return { color: "var(--chakra-colors-brand-500)", paleta: "gray", texto: "Sin tareas" };
  }
  if (porcentaje >= 100) {
    return { color: "var(--chakra-colors-green-500)", paleta: "green", texto: "Todo al día" };
  }
  if (porcentaje >= 50) {
    return { color: "var(--chakra-colors-brand-500)", paleta: "brand", texto: "Buen avance" };
  }
  if (porcentaje >= 25) {
    return { color: "var(--chakra-colors-orange-500)", paleta: "orange", texto: "Con demora" };
  }

  return { color: "var(--chakra-colors-red-500)", paleta: "red", texto: "Muy atrasado" };
}

/** Selector Hoy | Período. Cada botón avisa su estado con `aria-pressed`. */
function SelectorVista({
  vista,
  onChange,
}: {
  vista: Vista;
  onChange: (vista: Vista) => void;
}) {
  const opciones: { valor: Vista; texto: string }[] = [
    { valor: "hoy", texto: "Hoy" },
    { valor: "periodo", texto: "Período" },
  ];

  return (
    <HStack gap="1">
      {opciones.map((opcion) => (
        <Button
          key={opcion.valor}
          size="xs"
          colorPalette="brand"
          variant={vista === opcion.valor ? "solid" : "outline"}
          aria-pressed={vista === opcion.valor}
          onClick={() => onChange(opcion.valor)}
        >
          {opcion.texto}
        </Button>
      ))}
    </HStack>
  );
}

/**
 * Indicador de cumplimiento.
 *
 * Vista "Hoy": a la izquierda, el porcentaje grande con el estado del día y el
 * desglose (hechas y pendientes); a la derecha, el anillo con el conteo en el
 * centro. Con `total === 0` no se muestra "0%" sino "—": un plan sin tareas
 * para la fecha no es un día con cero cumplimiento.
 *
 * Vista "Período" (solo administradores): evolución diaria del porcentaje de
 * cumplimiento en el rango de fechas que se elija.
 */
export function TarjetaCumplimiento({
  total,
  completadas,
  porcentaje,
  loading,
  error,
  periodo,
  ...rest
}: TarjetaCumplimientoProps & BoxProps) {
  const [vista, setVista] = useState<Vista>("hoy");

  const estado = estadoDelDia(total, porcentaje);
  const pendientes = total - completadas;

  // Resumen del período: se suman las tareas, no se promedian los porcentajes.
  const cumplidasPeriodo = periodo?.datos.reduce((suma, p) => suma + p.cumplidas, 0) ?? 0;
  const totalPeriodo = periodo?.datos.reduce((suma, p) => suma + p.total, 0) ?? 0;

  return (
    <TarjetaPanel
      titulo="Cumplimiento de Checklist"
      tamanoTitulo="sm"
      acciones={periodo ? <SelectorVista vista={vista} onChange={setVista} /> : undefined}
      {...rest}
    >
      {/* ---------------------------- Vista: Hoy ---------------------------- */}
      {vista === "hoy" && loading && <EstadoCargando />}

      {vista === "hoy" && !loading && error && <MensajeError>{error}</MensajeError>}

      {vista === "hoy" && !loading && !error && (
        <Flex align="center" gap="4" flex="1" my="auto">
          <Box minW="0">
            {/*
              `4xl` es el token del framework, no un `fontSize="56px"`: la
              escala tipográfica del tema corta en `2xl` y este es el único
              lugar de la app que necesita un número más grande (declarado como
              excepción en `theme/index.ts`).
            */}
            <Text as="p" fontSize="4xl" fontWeight="bold" lineHeight="1" color="brand.fg">
              {total === 0 ? "—" : `${porcentaje}%`}
            </Text>

            <Badge
              mt="2"
              colorPalette={estado.paleta}
              variant="subtle"
              px="2"
              py="0.5"
              borderRadius="full"
              fontSize="xs"
            >
              {estado.texto}
            </Badge>

            <Text mt="2" fontSize="xs" color="fg.muted">
              {total === 0 ? (
                "No hay tareas programadas para hoy."
              ) : (
                <HStack as="span" gap="3" display="inline-flex">
                  <span>Hoy · {completadas} hechas</span>
                  <span>{pendientes} pendientes</span>
                </HStack>
              )}
            </Text>
          </Box>

          <Box w="100px" h="100px" flexShrink={0} ml="auto">
            <AnilloProgreso porcentaje={porcentaje} color={estado.color}>
              {total > 0 && (
                <>
                  <Text fontSize="lg" fontWeight="bold" lineHeight="1" color="fg">
                    {completadas}/{total}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    tareas
                  </Text>
                </>
              )}
            </AnilloProgreso>
          </Box>
        </Flex>
      )}

      {/* -------------------------- Vista: Período -------------------------- */}
      {vista === "periodo" && periodo && (
        <Stack gap="2" flex="1">
          <HStack gap="2">
            <Input
              type="date"
              size="xs"
              aria-label="Desde"
              value={periodo.desde}
              max={periodo.hasta || hoyISO()}
              onChange={(e) => periodo.cambiarRango(e.target.value, periodo.hasta)}
            />
            <Text as="span" fontSize="xs" color="fg.muted">
              a
            </Text>
            <Input
              type="date"
              size="xs"
              aria-label="Hasta"
              value={periodo.hasta}
              min={periodo.desde}
              max={hoyISO()}
              onChange={(e) => periodo.cambiarRango(periodo.desde, e.target.value)}
            />
          </HStack>

          {periodo.loading && <EstadoCargando />}

          {!periodo.loading && periodo.error && <MensajeError>{periodo.error}</MensajeError>}

          {/* Sin tareas no se muestra "0%": un período sin checklists no es un
              período sin cumplimiento. */}
          {!periodo.loading && !periodo.error && totalPeriodo === 0 && (
            <Text fontSize="sm" color="fg.muted" my="auto">
              No hay tareas registradas en este período.
            </Text>
          )}

          {!periodo.loading && !periodo.error && totalPeriodo > 0 && (
            <>
              <Text fontSize="xs" color="fg.subtle">
                <b>{Math.round((cumplidasPeriodo / totalPeriodo) * 100)}%</b> de las tareas
                cumplidas en el período
              </Text>
              <GraficoCumplimiento datos={periodo.datos} alto={150} />
            </>
          )}
        </Stack>
      )}
    </TarjetaPanel>
  );
}