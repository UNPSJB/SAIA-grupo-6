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

      // Una sola familia en toda la app: Inter variable, auto-hospedada via
      // @fontsource-variable/inter (importada en main.tsx). No depende de
      // Google Fonts, asi que la app anda sin internet.
      fonts: {
        heading: {
          value:
            "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
        body: {
          value:
            "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
        mono: {
          value: "ui-monospace, SFMono-Regular, Menlo, monospace",
        },
      },

      /*
       * ESCALA TIPOGRAFICA: 5 tamanos, nada mas.
       *
       * Antes convivian 18 valores distintos (11px, 12px, 13px, 14px, 15px,
       * 16px, 17px, 18px, 20px, 22px, 24px, 26px, 50px...) y nada impedia
       * sumar otro. Estos son los unicos permitidos:
       *
       *   2xl  24px  titulo de pagina
       *   lg   18px  subtitulo / titulo de seccion
       *   md   16px  cuerpo
       *   sm   14px  cuerpo chico, labels, datos de tabla
       *   xs   12px  metadatos y ayudas
       *
       * `fontSize="13px"` es `sm`; `fontSize="22px"` es `2xl`.
       */
      fontSizes: {
        xs: { value: "0.75rem" },
        sm: { value: "0.875rem" },
        md: { value: "1rem" },
        lg: { value: "1.125rem" },
        xl: { value: "1.25rem" },
        "2xl": { value: "1.5rem" },
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
    /*
     * Contraste de los colores de marca y de los neutros de texto.
     *
     * Los valores por defecto de Chakra están calibrados para texto *grande*.
     * Medido en el navegador con el label de 14px de las tablas:
     *
     *   brand.500 (#468189) + blanco   4.41:1  <- falla AA (pide 4.5:1)
     *   orange.600            + blanco  3.56:1  <- falla
     *   fg.muted  (gray.400) s/ blanco  2.93:1  <- falla
     *   fg.subtle (gray.300) s/ blanco  2.46:1  <- falla
     *
     * O sea: los botones teales, los títulos de formulario y los textos de
     * ayuda se leían desvanecidos. Se baja un escalón el fondo de los botones
     * sólidos y se oscurecen los grises de texto. El teal sigue siendo el
     * mismo color, solo dos tonos más profundo: eso es lo que hace falta para
     * que el texto de arriba se lea.
     */
    semanticTokens: {
      colors: {
        /* Teal: acción principal. `solid` es el fondo de los botones. */
        brand: {
          solid: { value: "{colors.brand.600}" },
          contrast: { value: "{colors.white}" },
          fg: { value: "{colors.brand.700}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.50}" },
          emphasized: { value: "{colors.brand.700}" },
          focusRing: { value: "{colors.brand.400}" },
        },

        /* Naranja = editar. El 600 no le daba contraste al blanco. */
        orange: {
          solid: { value: "{colors.orange.700}" },
          contrast: { value: "{colors.white}" },
        },

        /*
         * Escala de texto neutra. Tres niveles, todos por encima de 4.5:1
         * sobre superficie blanca:
         *
         *   fg         gray.900  texto principal
         *   fg.muted   gray.600  labels, subtítulos, texto secundario
         *   fg.subtle  gray.500  ayudas y metadatos
         *
         * Antes `fg.muted` era gray.400 y `fg.subtle` gray.300: a 12-14px no
         * llegaban a 4.5:1.
         */
        fg: { value: "{colors.gray.900}" },
        "fg.muted": { value: "{colors.gray.600}" },
        "fg.subtle": { value: "{colors.gray.500}" },
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

    /*
     * Tablas con esquinas redondeadas.
     *
     * `borderCollapse: collapse` es lo que las dejaba con esquinas rectas:
     * el radio del contenedor no recorta las celdas del encabezado. Se cambia a
     * `separate` (que sí respeta `overflow: hidden`) y se deja el espaciado en
     * 0 para que no se abra un hueco entre celdas. El borde exterior pasa a
     * dibujarlo la `Tarjeta` que envuelve a la tabla.
     */
    slotRecipes: {
      table: {
        slots: ["root", "row", "cell", "columnHeader", "caption", "footer"],
        base: {
          root: {
            borderCollapse: "separate",
            borderSpacing: "0",
            borderRadius: "lg",
            overflow: "hidden",
          },
        },
      },
    },
  },
  globalCss: {
    "html, body": {
      backgroundColor: "{colors.brand.50}",
      color: "fg",
      fontFamily: "body",
    },
    "*::selection": {
      bg: "brand.muted",
      color: "brand.fg",
    },
  },
});

/** Sistema de la aplicación: default de Chakra + paleta brand. */
export const system = createSystem(defaultConfig, config);
