import { Flex, Heading, HStack, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Tarjeta } from "../../../components/ui/patrones";

/**
 * Tamaño del título de la tarjeta.
 *
 * Las tarjetas de indicadores (cumplimiento, equipos) llevan un título chico
 * que acompaña al número; las de gráficos uno intermedio, y la lista de
 * alertas uno grande porque es el bloque principal del panel. Son los mismos
 * tres pasos de la escala tipográfica del tema, no valores sueltos.
 */
type TamanoTitulo = "sm" | "md" | "xl";

interface TarjetaPanelProps extends BoxProps {
  titulo: string;
  tamanoTitulo?: TamanoTitulo;
  /** Controles a la derecha del título. */
  acciones?: ReactNode;
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
  acciones,
  children,
  ...rest
}: TarjetaPanelProps) {
  const chico = tamanoTitulo === "sm";

  return (
    <Tarjeta
      p={chico ? "5" : "6"}
      h="full"
      display="flex"
      flexDirection="column"
      {...rest}
    >
      <Flex
        justify="space-between"
        align="center"
        gap="3"
        mb={chico ? "2" : "4"}
        flexWrap="wrap"
      >
        <Heading
          as="h3"
          fontSize={tamanoTitulo}
          fontWeight={tamanoTitulo === "sm" ? "medium" : "semibold"}
          color="fg"
        >
          {titulo}
        </Heading>
        {acciones ? <HStack gap="2">{acciones}</HStack> : null}
      </Flex>
      {children}
    </Tarjeta>
  );
}
