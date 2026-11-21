import { Flex, Text } from "@chakra-ui/react";
import { LuShieldCheck } from "react-icons/lu";

interface LogoSaiaProps {
  /** Tamaño del ícono en px. */
  size?: number;
  /** Solo el escudo, sin el texto "SAIA" . */
  soloIcono?: boolean;
  /**
   * En el celular muestra solo el escudo: en la barra superior, el texto se
   * comía el lugar de las pestañas y la activa quedaba en "St…".
   */
  compactoEnCelular?: boolean;
}

/**
 * Logo de la app: escudo + "SAIA". Hereda el color del contexto (`color`).
 *
 * Es el único lugar donde vive el escudo de la barra superior. Si más adelante
 * hay un logo propio (SVG/PNG), se cambia acá adentro.
 */
export function LogoSaia({ size = 28, soloIcono = false, compactoEnCelular = false }: LogoSaiaProps) {
  return (
    <Flex as="span" display="inline-flex" align="center" gap="2">
      <LuShieldCheck size={size} aria-hidden style={{ flexShrink: 0 }} />
      {!soloIcono && (
        <Text
          as="span"
          fontSize="xl"
          fontWeight="bold"
          letterSpacing="wider"
          lineHeight="1"
          display={compactoEnCelular ? { base: "none", sm: "inline" } : undefined}
        >
          SAIA
        </Text>
      )}
    </Flex>
  );
}
