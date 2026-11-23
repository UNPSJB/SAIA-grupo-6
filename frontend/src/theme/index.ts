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

/* Escala para modo oscuro: fondos teal casi negros, texto en teals claros.
 * 500 queda igual que en claro (spinners, bordes de acento). */
export const brandDark = {
  50: "#0F1B1D",
  100: "#152427",
  200: "#1C3135",
  300: "#2B5157",
  400: "#4F8E96",
  500: "#468189",
  600: "#468189",
  700: "#90BEBB",
  800: "#BBDFDC",
  900: "#DCEEEC",
} as const;

const escala = (valores: Record<number, string>) =>
  Object.fromEntries(Object.entries(valores).map(([k, value]) => [k, { value }]));

/**
 * Fondo de la franja de las migas de pan y de la pestaña seleccionada de la
 * barra, que se funden en una sola pieza: tiene que ser EXACTAMENTE el mismo
 * color sólido en los dos (sin transparencias, que sobre el teal darían dos
 * tonos distintos). Es el token `bg.panel`: blanco en claro y el teal casi
 * negro de las tarjetas en oscuro.
 */
export const FONDO_PESTANA = "bg.panel";

/**
 * Degradado del teal de la marca para el fondo del Inicio (barra superior
 * incluida): oscuro a la izquierda, donde va el texto (logo, saludo), y más
 * claro hacia la derecha, con un brillo suave arriba a la derecha.
 */
export const DEGRADADO_MARCA = `radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.18), transparent 45%), linear-gradient(100deg, ${brand[900]} 0%, ${brand[700]} 35%, ${brand[500]} 70%, ${brand[400]} 100%)`;

/** Fondo de las cabeceras de tabla: el degradado de la barra sobre su teal. */
const FONDO_CABECERA_TABLA = `${DEGRADADO_MARCA}, ${brand[700]}`;

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        /* Escalas fijas. Usá `brandLight.N` cuando el color NO debe invertirse
         * (ej: fondo teal con texto blanco encima). `brand.N` (abajo, en
         * semanticTokens) sí cambia con el modo. */
        brandLight: escala(brand),
        brandDark: escala(brandDark),
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
       *
       * EXCEPCION: `3xl` (30px, declarado abajo) para las cifras clave de los
       * paneles (Inicio y `/resumen/*`), que se leen a distancia, y `4xl`
       * (36px) para el título de los banners de área. Ya no se usa `5xl`.
       * Si manana hace falta otro tamanho, se declara aca
       * con su unico uso.
       */
      fontSizes: {
        xs: { value: "0.75rem" },
        sm: { value: "0.875rem" },
        md: { value: "1rem" },
        lg: { value: "1.125rem" },
        xl: { value: "1.25rem" },
        "2xl": { value: "1.5rem" },
        /*
         * 30px: SOLO para las cifras clave de los paneles (`MetricasBloque`,
         * el centro de las donas y las tarjetas del Inicio), que se leen a
         * distancia en planta o laboratorio. Declarado acá, con su único
         * uso, como pide la regla de la escala de arriba. También el título
         * de los banners de cada área (`BannerPanel`) en el celular.
         */
        "3xl": { value: "1.875rem" },
        /* 36px: SOLO el título de los banners de cada área (`BannerPanel`),
         * desde tablet. */
        "4xl": { value: "2.25rem" },
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
          ...Object.fromEntries(
            Object.keys(brand).map((k) => [
              k,
              {
                value: {
                  _light: `{colors.brandLight.${k}}`,
                  _dark: `{colors.brandDark.${k}}`,
                },
              },
            ])
          ),
          /* Barra superior: teal con texto blanco, en ambos modos. */
          bar: {
            value: { _light: "{colors.brandLight.700}", _dark: "{colors.brandLight.900}" },
          },
          solid: { value: "{colors.brandLight.600}" },
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

        /* Lo mismo con el teal de Chakra (`colorPalette="teal"`, p. ej. el
         * filtro "Todas" del checklist): blanco sobre teal.600 daba 3.7:1. */
        teal: {
          solid: { value: "{colors.teal.700}" },
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
        fg: { value: { _light: "{colors.gray.900}", _dark: "{colors.gray.50}" } },
        "fg.muted": { value: { _light: "{colors.gray.600}", _dark: "{colors.gray.300}" } },
        "fg.subtle": { value: { _light: "{colors.gray.500}", _dark: "{colors.gray.400}" } },

        /* Superficies. En claro: página teal muy suave y tarjetas blancas.
         * En oscuro: página casi negra y tarjetas un escalón más claras. */
        bg: { value: { _light: "{colors.white}", _dark: "{colors.brandDark.50}" } },
        "bg.panel": { value: { _light: "{colors.white}", _dark: "{colors.brandDark.100}" } },
        "bg.subtle": { value: { _light: "{colors.gray.50}", _dark: "{colors.brandDark.200}" } },
        "bg.muted": { value: { _light: "{colors.gray.100}", _dark: "{colors.brandDark.200}" } },

        /* Tablas (`COLOR_TABLA` en patrones.tsx). En claro, los grises pizarra
         * del rediseño; en oscuro, los mismos escalones que bg/fg. */
        tabla: {
          fondoEncabezado: { value: { _light: "#F1F5F9", _dark: "{colors.brandDark.200}" } },
          textoEncabezado: { value: { _light: "#475569", _dark: "{colors.gray.300}" } },
          bordeEncabezado: { value: { _light: "#E2E8F0", _dark: "{colors.brandDark.300}" } },
          bordeFila: { value: { _light: "#EEF2F6", _dark: "{colors.brandDark.200}" } },
          hoverFila: { value: { _light: "#F0FDFA", _dark: "{colors.brandDark.200}" } },
          textoPrincipal: { value: { _light: "#1E293B", _dark: "{colors.gray.50}" } },
          textoSecundario: { value: { _light: "#64748B", _dark: "{colors.gray.400}" } },
          accion: { value: { _light: "#0F766E", _dark: "{colors.brandDark.700}" } },
          accionHover: { value: { _light: "#115E59", _dark: "{colors.brandDark.800}" } },
          bordeBoton: { value: { _light: "#CBD5E1", _dark: "{colors.brandDark.300}" } },
          bordeBotonHover: { value: { _light: "#5EEAD4", _dark: "{colors.brandDark.400}" } },
        },

        /* Avisos suaves de los paneles: ámbar (atención) y rojo (problema). */
        aviso: {
          ambarFondo: { value: { _light: "#FBF1DC", _dark: "#2B2312" } },
          ambarBorde: { value: { _light: "#ECD3A0", _dark: "#5C4824" } },
          ambarTexto: { value: { _light: "#8A5A12", _dark: "#F0C878" } },
          rojoFondo: { value: { _light: "#FBEAE6", _dark: "#2E1714" } },
          rojoBorde: { value: { _light: "#EFC3B9", _dark: "#6B2E26" } },
          rojoTexto: { value: { _light: "#9B2C1F", _dark: "#F2A89A" } },
        },

        /* Fondo claro del Inicio, debajo del degradado de la marca. */
        inicio: {
          fondo: { value: { _light: "#EEF3F3", _dark: "{colors.brandDark.50}" } },
        },

        /* Un tema por área de los paneles (`features/dashboard/types/temasArea.ts`). */
        area: {
          produccion: {
            fondo0: { value: { _light: "#FBF5EA", _dark: "#272116" } },
            fondo1: { value: { _light: "#F6E8CC", _dark: "#352D1D" } },
            fondo2: { value: { _light: "#F3E6DC", _dark: "#2E221A" } },
            borde: { value: { _light: "#EAD9B8", _dark: "#584B32" } },
            acento: { value: { _light: "#A24E33", _dark: "#D99F8C" } },
            titulo: { value: { _light: "#3A2A1F", _dark: "#F3ECE8" } },
            bajada: { value: { _light: "#6B4A32", _dark: "#D7C4B7" } },
            arco3: { value: { _light: "#E4CF9E", _dark: "#6A5B39" } },
          },
          inventario: {
            fondo0: { value: { _light: "#FCF8EC", _dark: "#272316" } },
            fondo1: { value: { _light: "#F5E9C2", _dark: "#352F1D" } },
            fondo2: { value: { _light: "#F1ECD9", _dark: "#2E2A1A" } },
            borde: { value: { _light: "#E8DBB0", _dark: "#584F32" } },
            acento: { value: { _light: "#8A6410", _dark: "#D9C18C" } },
            titulo: { value: { _light: "#3B2E12", _dark: "#F4F0E6" } },
            bajada: { value: { _light: "#6A5526", _dark: "#D7CDB7" } },
            arco3: { value: { _light: "#EFE0B0", _dark: "#6A5E39" } },
          },
          limpieza: {
            fondo0: { value: { _light: "#F0F9F8", _dark: "#162725" } },
            fondo1: { value: { _light: "#D9EFEC", _dark: "#1D3532" } },
            fondo2: { value: { _light: "#E6F2F6", _dark: "#1A292E" } },
            borde: { value: { _light: "#C3E2DE", _dark: "#325853" } },
            acento: { value: { _light: "#1F6F69", _dark: "#8CD9D3" } },
            titulo: { value: { _light: "#163F3C", _dark: "#E6F4F3" } },
            bajada: { value: { _light: "#2F5D5A", _dark: "#B7D7D5" } },
            arco3: { value: { _light: "#CDEAE6", _dark: "#396A63" } },
          },
          equipos: {
            fondo0: { value: { _light: "#F2F6FB", _dark: "#161E27" } },
            fondo1: { value: { _light: "#DDE7F3", _dark: "#1D2835" } },
            fondo2: { value: { _light: "#EAEDF5", _dark: "#1A1F2E" } },
            borde: { value: { _light: "#CBD8EA", _dark: "#324258" } },
            acento: { value: { _light: "#2F5888", _dark: "#8DB0D8" } },
            titulo: { value: { _light: "#1D2D43", _dark: "#E6ECF4" } },
            bajada: { value: { _light: "#3D5270", _dark: "#B7C4D7" } },
            arco3: { value: { _light: "#D6E1F0", _dark: "#394E6A" } },
          },
          calidad: {
            fondo0: { value: { _light: "#F3F7EE", _dark: "#202716" } },
            fondo1: { value: { _light: "#E0EBD5", _dark: "#29351D" } },
            fondo2: { value: { _light: "#EEF1E3", _dark: "#292E1A" } },
            borde: { value: { _light: "#CFDCC2", _dark: "#455732" } },
            acento: { value: { _light: "#4A6639", _dark: "#ADC89D" } },
            titulo: { value: { _light: "#25321D", _dark: "#ECF2E8" } },
            bajada: { value: { _light: "#4A5B3D", _dark: "#C5D2BC" } },
            arco3: { value: { _light: "#DDE8CF", _dark: "#556A39" } },
          },
          personas: {
            fondo0: { value: { _light: "#FAF2F5", _dark: "#27161C" } },
            fondo1: { value: { _light: "#EFDDE5", _dark: "#351D27" } },
            fondo2: { value: { _light: "#F1EBF4", _dark: "#271A2E" } },
            borde: { value: { _light: "#E3CBD6", _dark: "#583243" } },
            acento: { value: { _light: "#843E5D", _dark: "#CE97AF" } },
            titulo: { value: { _light: "#3A1F2C", _dark: "#F3E8ED" } },
            bajada: { value: { _light: "#674453", _dark: "#D2BBC5" } },
            arco3: { value: { _light: "#F0DBE4", _dark: "#6A394E" } },
          },
          // Comparativa entre establecimientos: teal de la marca y pizarra.
          empresa: {
            fondo0: { value: { _light: "#EEF6F5", _dark: "#142120" } },
            fondo1: { value: { _light: "#D9ECEA", _dark: "#1A2E2C" } },
            fondo2: { value: { _light: "#E5EDF3", _dark: "#172330" } },
            borde: { value: { _light: "#C3DCD9", _dark: "#2F524D" } },
            acento: { value: { _light: "#1D6A64", _dark: "#8FD0C8" } },
            titulo: { value: { _light: "#132D2B", _dark: "#E6F2F0" } },
            bajada: { value: { _light: "#3B5A57", _dark: "#B7CFCB" } },
            arco3: { value: { _light: "#D3E9E6", _dark: "#2E5752" } },
          },
        },
      },
    },
    /**
     * Variante `card` para Box: reemplaza los objetos `estiloTarjeta`,
     * `estiloInput` y demás fondos de tarjeta repetidos en features.
     * Uso: `<Box variant="card">`.
     */
    recipes: {
      /*
       * Badges más legibles. El tamaño por defecto de Chakra (`sm`) usa texto
       * de 12px y 20px de alto: en las tablas, "Ingrediente", "Aditivo" o el
       * tipo de vencimiento quedaban muy chicos. Se agranda el `sm` (el que
       * usan todos los `<Badge>` sin `size`) a texto de 14px, sin tocar `xs`.
       */
      badge: defineRecipe({
        variants: {
          size: {
            sm: { textStyle: "sm", px: "2", minH: "6" },
          },
        },
      }),

      card: defineRecipe({
        base: {
          bg: "bg.panel",
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
          color: "fg",
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
              bg: "bg.panel",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "brand.300",
              paddingX: "3",
              _hover: { borderColor: "brand.400" },
              _placeholder: { color: "fg.subtle" },
              _focusVisible: {
                borderColor: "brand.500",
                boxShadow: "0 0 0 3px var(--chakra-colors-brand-300)",
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
          color: "fg",
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
              bg: "bg.panel",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "brand.300",
              padding: "3",
              _hover: { borderColor: "brand.400" },
              _placeholder: { color: "fg.subtle" },
              _focusVisible: {
                borderColor: "brand.500",
                boxShadow: "0 0 0 3px var(--chakra-colors-brand-300)",
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
        slots: ["root", "header", "row", "cell", "columnHeader", "caption", "footer"],
        base: {
          /*
           * Cabecera de TODAS las tablas: el mismo degradado teal de la barra
           * superior (`DEGRADADO_MARCA`), con texto blanco. Va en el <thead> y
           * no en cada celda para que se vea como una sola franja continua;
           * filas y celdas de la cabecera quedan transparentes. Es teal en los
           * dos modos, igual que la barra.
           */
          header: {
            background: FONDO_CABECERA_TABLA,
            "& tr, & tr:hover": { background: "transparent" },
            /* Fijo arriba al desplazarse en las tablas cuyo contenedor scrollea
             * en vertical (`Tarjeta desplazable`); en el resto no tiene efecto.
             * Va en el <thead> porque es el que lleva el fondo. */
            position: "sticky",
            top: "0",
            zIndex: "1",
          },
          columnHeader: {
            background: "transparent",
            color: "white",
            fontSize: "sm",
            borderColor: "brandLight.800",
          },
          root: {
            borderCollapse: "separate",
            borderSpacing: "0",
            borderRadius: "lg",
            overflow: "hidden",
            /*
             * `fixed` y no el `auto` del navegador.
             *
             * Con `auto` el reparto de anchos lo decide el contenido: una fila
             * con un nombre más largo ensancha su columna y desplaza los
             * encabezados de todas las demás. Medido, la columna "Acciones"
             * iba de 137px (incidentes) a 377px (equipos) en la misma app.
             *
             * Con `fixed`, el ancho sale del `width` de la celda del
             * encabezado, y las columnas sin `width` se reparten lo que sobra.
             * Los anchos por tipo de columna viven en `patrones.tsx`
             * (`ANCHO_COLUMNA`).
             */
            tableLayout: "fixed",
          },
          /*
           * Hover de fila uniforme: lo hereda TODA tabla de la app sin que
           * cada componente tenga que pasar `_hover`. Aguamarina muy suave
           * (`#F0FDFA`) con transición corta: guía la vista a lo largo de la
           * fila en monitores anchos sin competir con el color de los estados.
           */
          row: {
            transition: "background-color 0.15s ease",
            _hover: { bg: "tabla.hoverFila" },
          },
        },
        /* Las variantes de Chakra (`outline`, `line`) le ponen un fondo gris al
         * <thead> que pisaría el de `base`: se repite acá. */
        variants: {
          variant: {
            outline: { header: { background: FONDO_CABECERA_TABLA } },
            line: { header: { background: FONDO_CABECERA_TABLA } },
          },
        },
      },
      /*
       * Tooltips oscuros.
       *
       * Fondo casi negro (`gray.900`) con texto blanco: el contraste fuerte
       * despega el tooltip del fondo claro de la app y se lee de inmediato.
       *
       * La flecha no tiene color propio: toma el de `--tooltip-bg`, así que
       * hay que pisar esa variable además del fondo del contenido.
       */
      tooltip: {
        slots: ["trigger", "arrow", "arrowTip", "positioner", "content"],
        base: {
          content: {
            "--tooltip-bg": "colors.gray.900",
            color: "white",
            borderWidth: "0",
            boxShadow: "md",
            fontWeight: "medium",
            px: "3",
            py: "1.5",
          },
          arrowTip: {
            borderColor: "gray.900",
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
