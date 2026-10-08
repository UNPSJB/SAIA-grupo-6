"use client"

import { ChakraProvider } from "@chakra-ui/react"
import { system } from "../../theme"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

/*
 * `defaultTheme="light"` + `enableSystem={false}` a propósito.
 *
 * La app está diseñada para un solo tema claro: el fondo de página, la
 * superficie de las tarjetas y los colores de la paleta `brand` son valores
 * fijos, no tokens que se inviertan. Si `next-themes` respetara la preferencia
 * del sistema y aplicara la clase `.dark`, los tokens semánticos (`fg`,
 * `bg.panel`, `border`) sí se invertirían y quedarían texto blanco sobre
 * superficies claras, botones blancos con texto blanco y tablas negras. Por eso
 * el modo claro va forzado: es el único que el tema soporta hoy.
 *
 * Para agregar modo oscuro de verdad hay que definir los tokens con
 * condiciones `_light`/`_dark` (no valores fijos) y recién ahí quitar esto.
 */
export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider defaultTheme="light" enableSystem={false} {...props} />
    </ChakraProvider>
  )
}
