import { Flex, Heading, HStack, Text, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Tarjeta } from "../../../components/ui/patrones";


import { BotonDescargaGrafico, type RangoGrafico } from "../../exportacion";
import { useRangoDescarga } from "./rangoDescarga";

/**
 * Tamaño del título de la tarjeta.
 *
 * Las tarjetas de indicadores (cumplimiento, equipos) llevan un título chico
 * que acompaña al número; las de gráficos uno intermedio, y la lista de
 * alertas uno grande porque es el bloque principal del panel. Los bloques de
 * los paneles de categoría usan `lg`: tienen que destacarse sobre la bajada y
 * sobre las leyendas del gráfico. Son pasos de la escala tipográfica del tema,
 * no valores sueltos.
 */
type TamanoTitulo = "sm" | "md" | "lg" | "xl";

interface TarjetaPanelProps extends BoxProps {
  titulo: string;
  tamanoTitulo?: TamanoTitulo;
  /** Texto breve debajo del título. */
  descripcion?: ReactNode;
  /** Controles a la derecha del título. */
  acciones?: ReactNode;

  descargable?: boolean;
  rangoDescarga?: RangoGrafico | null;
  children: ReactNode;
}

/**
 * Tarjeta del panel con su título.
 *
 * El título va como `h3` y no como `h2` como el `PageHeader`: el de la
 * pantalla ya es un `h2` y en un lector de pantalla las tarjetas tienen
 * que quedar un nivel por debajo de la página, no al mismo nivel.
 *
 * `h="full"` + columna flex: las tarjetas de una misma fila se estiran a la
 * misma altura. Las que van apiladas en una columna lo pisan con `h="auto"`.
 */
export function TarjetaPanel({
  titulo,
  tamanoTitulo = "md",
  descripcion,
  acciones,
  descargable = false,
  rangoDescarga,
  children,
  ...rest
}: TarjetaPanelProps) {
  const chico = tamanoTitulo === "sm";
  const rangoDelPanel = useRangoDescarga();
  const rango = rangoDescarga === undefined ? rangoDelPanel : rangoDescarga;

  return (
    <Tarjeta
      // `relative`: las tablas `srOnly` de los gráficos son `position:
      // absolute`; sin un ancestro posicionado se ubican respecto de la
      // página y, en los bloques de abajo, la estiran más allá del alto de
      // la ventana (aparece un segundo scroll que corta el panel).
      position="relative"
      p={chico ? "5" : "6"}
      h="full"
      display="flex"
      flexDirection="column"
      {...rest}
    >
      <Flex
        data-no-exportar=""
        justify="space-between"
        align="center"
        gap="3"
        mb={chico ? "2" : "5"}
        flexWrap="wrap"
      >
        {/* Ancho mínimo del título: si no entra junto a las acciones (p. ej.
            el Desde/Hasta en la columna angosta), las acciones bajan a otro
            renglón en vez de partir el título en dos. */}
        {/* Bajada pegada al título (proximidad): se leen como una sola
            unidad, separada del contenido por el margen de abajo. */}
        <Flex direction="column" gap="1" flex="1" minW="0" flexBasis="220px">
          <Heading
            as="h3"
            fontSize={tamanoTitulo}
            fontWeight={tamanoTitulo === "sm" ? "medium" : "semibold"}
            color="fg"
          >
            {titulo}
          </Heading>
          {descripcion ? (
            <Text fontSize="xs" color="fg.muted" lineHeight="1.5">
              {descripcion}
            </Text>
          ) : null}
        </Flex>
        {acciones || descargable ? (
          <HStack gap="2">
            {acciones}
            {descargable ? <BotonDescargaGrafico titulo={titulo} rango={rango} /> : null}
          </HStack>
        ) : null}
      </Flex>
      {children}
    </Tarjeta>
  );
}