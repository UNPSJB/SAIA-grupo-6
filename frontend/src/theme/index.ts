import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineRecipe,
  type SystemStyleObject,
} from "@chakra-ui/react";

/* ── Paleta de marca ──────────────────────────────────────────────────
 * Receta interpolada a partir de los valores que el proyecto ya usaba:
 * TEAL #468189, TEAL_CLARO #90BEBB y TEAL_OSCURO #37666d. Los escalones
 * intermedios completan la escala para que `_hover`, `_active` y las
 * variantes de cada componente Chakra tengan con qué trabajar.
 *
 * El namespace es `brand` a propósito: con esto `colorPalette="brand"`
 * funciona en todos los componentes de Chakra sin configurar nada más.
 * ──────────────────────────────────────────────────────────────────── */
export const brand = {
  50: "#EEF6F5",
  100: "#DCEEEC",
  200: "#BBDFDC",
  300: "#90BEBB",
  400: "#63989B",
  500: "#468189",
  600: "#3D737A",
  700: "#37666D",
  800: "#2E565C",
  900: "#26454B",
} as const;

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: Object.fromEntries(
          Object.entries(brand).map(([step, value]) => [step, { value }])
        ),
      },
      shadows: {
        /** Superficie de tabla: `boxShadow="0 2px 6px rgba(0,0,0,0.05)"`. */
        panel: { value: "0 2px 6px rgba(0, 0, 0, 0.05)" },
        /** Formulario o tarjeta elevada: `0 4px 6px rgba(0,0,0,0.05)`. */
        card: { value: "0 4px 6px rgba(0, 0, 0, 0.05)" },
        /** Diálogo sobre overlay. */
        dialog: { value: "0 4px 15px rgba(0, 0, 0, 0.2)" },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "{colors.white}" },
          fg: { value: "{colors.brand.500}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.50}" },
          emphasized: { value: "{colors.brand.700}" },
          focusRing: { value: "{colors.brand.400}" },
        },
      },
    },
    /**
     * Variante `card` para Box: reemplaza los objetos `estiloTarjeta`,
     * `estiloInput` y demás fondos de tarjeta repetidos en features.
     * Uso: `<Box variant="card">`.
     */
    recipes: {
      card: defineRecipe({
        base: {
          bg: "white",
          p: "6",
          rounded: "l2",
          boxShadow: "sm",
        },
        variants: {
          elevated: {
            true: { boxShadow: "lg" },
            false: {},
          },
        },
        defaultVariants: { elevated: false },
      }),

      /**
       * Campo de formulario. Reemplaza a `estiloInput`, `estiloInputAncho`
       * y `estiloInputCompacto` de `common/theme/tokens.ts`, que estaban
       * declarados tres veces con el mismo aspecto.
       *
       * Va como recipe y no como snippet a propósito: en Chakra v3 todo
       * `<Input>` de la app consume esta receta, así que el look del
       * formulario queda garantizado sin que cada componente pase props.
       * El ancho (500px / ancho completo / compacto) sigue siendo prop del
       * call site, porque es una decisión de layout y no de estilo.
       *
       * No se declara `sizes`: en Chakra 3.37 los tamaños son una variante más
       * (`size="sm"`), no una clave `sizes` — declararla rompe el tipo.
       * Se mergean con las del default, así que `<Input size="sm" />` sigue
       * funcionando.
       */
      input: defineRecipe<{ variant: { outline: SystemStyleObject } }>({
        base: {
          width: "100%",
          minWidth: "0",
          color: "gray.800",
          fontFamily: "body",
          borderRadius: "lg",
          outline: "none",
          transitionProperty: "border-color",
          transitionDuration: "fast",
        },
        /*
         * El borde teal y el fondo blanco van en `variants.outline`, NO en
         * `base`. Chakra ya define `outline` (que es el `defaultVariants.variant`)
         * con `bg: transparent`, `borderWidth: 1px` y `borderColor: border`,
         * y las variantes se resuelven DESPUÉS de `base`: dejarlo solo en `base`
         * hacía que la variante lo pise y todos los `<Input>` salieran con el
         * borde gris de 1px y fondo transparente del default de Chakra.
         *
         * Se sobreescribe la variante en vez de cambiar `defaultVariants` para
         * no romper el `variant="subtle"` / `variant="flushed"` que ya trae
         * Chakra.
         */
        variants: {
          variant: {
            outline: {
              bg: "white",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "brand.300",
              paddingX: "3",
              _hover: { borderColor: "brand.400" },
              _placeholder: { color: "gray.400" },
              _focusVisible: {
                borderColor: "brand.500",
                boxShadow: "0 0 0 3px var(--chakra-colors-brand-100)",
              },
              _invalid: {
                borderColor: "red.500",
                _focusVisible: {
                  borderColor: "red.500",
                  boxShadow: "0 0 0 3px var(--chakra-colors-red-100)",
                },
              },
              _disabled: { opacity: 0.6, cursor: "not-allowed" },
            },
          },
        },
      }),

      /** Mismo tratamiento que `input` para `<Textarea>`. */
      textarea: defineRecipe<{ variant: { outline: SystemStyleObject } }>({
        base: {
          width: "100%",
          color: "gray.800",
          fontFamily: "body",
          borderRadius: "lg",
          outline: "none",
          transitionProperty: "border-color",
          transitionDuration: "fast",
        },
        /** Mismo criterio que `input`: el chrome va en la variante `outline`. */
        variants: {
          variant: {
            outline: {
              bg: "white",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "brand.300",
              padding: "3",
              _hover: { borderColor: "brand.400" },
              _placeholder: { color: "gray.400" },
              _focusVisible: {
                borderColor: "brand.500",
                boxShadow: "0 0 0 3px var(--chakra-colors-brand-100)",
              },
              _invalid: { borderColor: "red.500" },
              _disabled: { opacity: 0.6, cursor: "not-allowed" },
            },
          },
        },
      }),
    },
  },
  globalCss: {
    "html, body": {
      backgroundColor: "{colors.brand.50}",
    },
    /** Inputs nativos que todavía no migraron a <Input> de Chakra. */
    "input, textarea, select": {
      _focus: { outline: "none", boxShadow: "none" },
    },
  },
});

/** Sistema de la aplicación: default de Chakra + paleta brand. */
export const system = createSystem(defaultConfig, config);
