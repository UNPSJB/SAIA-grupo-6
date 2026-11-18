"use client"

import { ChakraProvider } from "@chakra-ui/react"
import { system } from "../../theme"
import { Toaster } from "./toaster"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

/*
 * Modo claro / oscuro.
 *
 * `defaultTheme="system"` + `enableSystem`: la primera vez se usa la
 * preferencia del sistema operativo; después manda lo que se elija con el
 * botón de la barra superior (`ColorModeButton`), que `next-themes` guarda en
 * localStorage. Los colores de la app son tokens con condición `_light`/`_dark`
 * (ver `src/theme/index.ts`): `brand.N`, `fg*`, `bg*`. Para un color que NO
 * debe invertirse (fondo teal con texto blanco) usá `brandLight.N` o `white`.
 */
export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider defaultTheme="system" enableSystem {...props} />
      {/* Avisos breves (éxito al guardar): fuera del router para que sigan
          visibles al navegar a otra pantalla. */}
      <Toaster />
    </ChakraProvider>
  )
}
