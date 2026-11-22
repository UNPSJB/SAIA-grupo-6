import {
  Box,
  Heading,
  Input,
  InputGroup,
  Text,
  type BoxProps,
  type InputProps,
} from "@chakra-ui/react";
import { useContext, type ReactNode } from "react";
import type { IconType } from "react-icons/lib";
import { LuCalendar, LuSave } from "react-icons/lu";
import {
  BannerError,
  BotonCancelar,
  BotonGuardar,
  ContextoCampo,
  SIN_VALIDACION_NATIVA,
} from "./patrones";
import { ANCHO_PAGINA, EnlaceVolver, type DestinoVolver } from "./plantillas";

/**
 * Formularios de alta: el estándar visual de las pantallas de creación.
 *
 * `PaginaFormulario` + `TarjetaFormulario` resolvían el esqueleto, pero cada
 * alta acomodaba sus campos a mano: `HStack` con `maxW="220px"` acá,
 * `maxW="500px"` allá, campos cortados a media fila y botones pegados al
 * último input. Estas piezas fijan el layout para que todas las altas se
 * lean igual:
 *
 *   <PaginaAlta volver={...} icono={LuPackagePlus} titulo descripcion error>
 *     <FormularioAlta onSubmit={handleSubmit}>
 *       <SeccionFormulario titulo="Origen" ayuda="...">
 *         <GrillaFormulario>
 *           <FormField label="Ingrediente" required completo>...</FormField>
 *           <FormField label="Número de lote" required>...</FormField>
 *           <FormField label="Cantidad" required>
 *             <InputUnidad unidad="kg" ... />
 *           </FormField>
 *         </GrillaFormulario>
 *       </SeccionFormulario>
 *       <PieFormulario>
 *         <BotonCancelar>Cancelar</BotonCancelar>
 *         <BotonGuardar loading={guardando} loadingText="Guardando...">
 *           <LuSave /> Registrar
 *         </BotonGuardar>
 *       </PieFormulario>
 *     </FormularioAlta>
 *   </PaginaAlta>
 *
 * Reglas de la grilla:
 *   - Dos columnas en desktop, una en el celular. Todo control ocupa el 100%
 *     de su celda: nada de `maxW` en los inputs.
 *   - A ancho completo (`completo` en `FormField`): selectores principales,
 *     nombres largos, observaciones.
 *   - Emparejados: datos cortos relacionados (número + cantidad, ingreso +
 *     vencimiento, código + categoría).
 *   - Más de 5–6 campos: partir en `SeccionFormulario`s con título.
 *
 * Lo que no cambia: `FormField`, `FormInput`, `FormNativeSelect`, los botones
 * y la validación siguen siendo los de `patrones.tsx`. Estas piezas solo los
 * acomodan, y `FormularioAlta` les ajusta el aspecto (ver `ESTILO_CONTROLES`).
 */

/* ─────────────────────────────── Página ────────────────────────────────── */

interface PaginaAltaProps {
  /** "← Volver a [Módulo]": siempre, porque un alta se abre desde un listado. */
  volver: DestinoVolver;
  titulo: ReactNode;
  /** Una línea: qué se registra y para qué. */
  descripcion?: ReactNode;
  /** Ícono de la entidad, en el recuadro teal junto al título. */
  icono?: IconType;
  /** `formulario` (768px) para altas cortas y medianas; `extenso` (896px) si hay muchas secciones. */
  ancho?: "formulario" | "extenso";
  /** Error de la operación (respuesta de la API, validación al enviar). */
  error?: string | null;
  /**
   * Leyenda "* Campos obligatorios" arriba a la derecha. Se apaga solo si el
   * formulario no tiene ningún obligatorio.
   */
  leyendaObligatorios?: boolean;
  children: ReactNode;
}

/**
 * Esqueleto de una pantalla de alta: "← Volver", encabezado con ícono,
 * error y el formulario. Centrada y con ancho máximo, como toda pantalla que
 * se abre desde otra (ver la regla en `plantillas.tsx`).
 */
export function PaginaAlta({
  volver,
  titulo,
  descripcion,
  icono: Icono,
  ancho = "formulario",
  error,
  leyendaObligatorios = true,
  children,
}: PaginaAltaProps) {
  return (
    <Box p={{ base: "3", md: "5" }} w="100%" maxW={ANCHO_PAGINA[ancho]} mx="auto">
      <EnlaceVolver {...volver} />

      <Box
        as="header"
        display="flex"
        flexWrap="wrap"
        alignItems="flex-end"
        justifyContent="space-between"
        columnGap="6"
        rowGap="2"
        mb="5"
      >
        <Box display="flex" alignItems="center" gap="3" minW="0">
          {Icono ? (
            <Box
              aria-hidden
              flexShrink={0}
              boxSize="10"
              display="flex"
              alignItems="center"
              justifyContent="center"
              rounded="lg"
              bg="brand.subtle"
              color="brand.fg"
              borderWidth="1px"
              borderColor="brand.muted"
            >
              <Icono size={20} />
            </Box>
          ) : null}
          <Box minW="0">
            <Heading as="h2" fontSize="2xl" fontWeight="bold" lineHeight="1.25" color="fg">
              {titulo}
            </Heading>
            {descripcion ? (
              <Text mt="0.5" fontSize="sm" color="fg.muted">
                {descripcion}
              </Text>
            ) : null}
          </Box>
        </Box>
        {leyendaObligatorios ? (
          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" pb="0.5">
            <Box as="span" color="brand.fg" fontWeight="semibold" aria-hidden>
              *
            </Box>{" "}
            Campos obligatorios
          </Text>
        ) : null}
      </Box>

      {error ? <BannerError mb="5">{error}</BannerError> : null}
      {children}
    </Box>
  );
}

/* ───────────────────────────── Formulario ──────────────────────────────── */

/** Anillo de foco: el teal de la marca, translúcido para que no grite. */
const ANILLO_FOCO =
  "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-focus-ring) 35%, transparent)";
const ANILLO_ERROR =
  "0 0 0 3px color-mix(in srgb, var(--chakra-colors-border-error) 25%, transparent)";

/*
 * Aspecto de los controles dentro de un alta.
 *
 * La receta `input` del tema les da borde teal de 2px y 40px de alto. Acá,
 * con muchos campos juntos, ese borde volvía la tarjeta una grilla de
 * recuadros verdes: se pasa a borde neutro de 1px, que se vuelve teal al
 * pasar el mouse y al enfocar (con anillo), y a 44px de alto, cómodo para
 * tocar en el celular.
 *
 * Va acá con selectores y no en la receta a propósito: así las altas se
 * migran de a una y los formularios que todavía no usan `FormularioAlta`
 * no cambian. Cuando estén todas migradas, esto pasa a la receta del tema.
 */
const SELECTOR_CONTROLES =
  "& input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]), & select, & textarea";

const ESTILO_CONTROLES = {
  [SELECTOR_CONTROLES]: {
    borderWidth: "1px",
    borderColor: "border.emphasized",
    borderRadius: "lg",
    bg: "bg.panel",
    transitionProperty: "border-color, box-shadow, background-color",
    transitionDuration: "moderate",
    "&:hover:not(:disabled):not(:focus-visible)": { borderColor: "brand.400" },
    "&:focus-visible": { borderColor: "brand.500", boxShadow: ANILLO_FOCO },
    "&[aria-invalid=true]": { borderColor: "border.error" },
    "&[aria-invalid=true]:focus-visible": { boxShadow: ANILLO_ERROR },
    "&:disabled": { bg: "bg.muted", color: "fg.muted", opacity: 1, cursor: "not-allowed" },
  },
  "& input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]), & select": {
    height: "11",
  },
  "& textarea": { minH: "24" },
  /* Que el calendario nativo de las fechas siga el modo (si no, en oscuro
   * queda un ícono negro sobre fondo oscuro). */
  "& input[type=date]": { _dark: { colorScheme: "dark" } },
  /*
   * `InputFecha` ya muestra su calendario a la izquierda: el nativo de Chrome
   * (a la derecha) se vuelve invisible y se estira sobre ese ícono, así que
   * tocar el calendario abre el selector y el resto del campo se sigue
   * pudiendo editar por partes. Firefox no tiene este pseudo-elemento y deja
   * su ícono a la derecha, que también funciona.
   */
  "& input[data-input-fecha]": { position: "relative" },
  "& input[data-input-fecha]::-webkit-calendar-picker-indicator": {
    position: "absolute",
    insetInlineStart: "0",
    top: "0",
    width: "10",
    height: "100%",
    margin: "0",
    padding: "0",
    opacity: 0,
    cursor: "pointer",
  },
  /* Las secciones se separan con un filete de 1px, sin margen extra. */
  "& [data-seccion-formulario] + [data-seccion-formulario]": {
    borderTopWidth: "1px",
    borderColor: "border",
  },
};

/**
 * La tarjeta del formulario, que además es el `<form>`. Adentro van
 * `SeccionFormulario`s y, al final, `PieFormulario`.
 *
 * Mantiene la validación nativa del navegador como estaba en cada página:
 * los formularios que usan `useIntentoEnvio` le pasan `sinValidacionNativa`.
 */
export function FormularioAlta({
  children,
  sinValidacionNativa = false,
  ...rest
}: { children: ReactNode; sinValidacionNativa?: boolean } & BoxProps) {
  const contexto = useContext(ContextoCampo);
  return (
    <ContextoCampo.Provider value={{ ...contexto, enAlta: true }}>
      <Box
        as="form"
        {...(sinValidacionNativa ? SIN_VALIDACION_NATIVA : {})}
        bg="bg.panel"
        rounded="lg"
        borderWidth="1px"
        borderColor="border.subtle"
        boxShadow="panel"
        overflow="hidden"
        mb="8"
        css={ESTILO_CONTROLES}
        {...rest}
      >
        {children}
      </Box>
    </ContextoCampo.Provider>
  );
}

/**
 * Bloque temático del formulario ("Origen", "Datos del lote"...). El título
 * y la ayuda son opcionales: un alta corta usa una sola sección sin título,
 * que es la que le da el padding.
 */
export function SeccionFormulario({
  titulo,
  ayuda,
  children,
  ...rest
}: { titulo?: ReactNode; ayuda?: ReactNode; children: ReactNode } & Omit<BoxProps, "title">) {
  return (
    <Box
      as="section"
      data-seccion-formulario=""
      px={{ base: "4", md: "8" }}
      py={{ base: "5", md: "6" }}
      {...rest}
    >
      {titulo || ayuda ? (
        <Box mb="5">
          {titulo ? (
            <Heading as="h3" fontSize="md" fontWeight="semibold" color="fg">
              {titulo}
            </Heading>
          ) : null}
          {ayuda ? (
            <Text mt="1" fontSize="sm" color="fg.muted">
              {ayuda}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}

/**
 * Grilla de campos: dos columnas desde tablet, una en el celular. Los
 * `FormField` de adentro pierden su margen (lo pone el `gap`) y con
 * `completo` ocupan las dos columnas.
 */
export function GrillaFormulario({
  columnas = 2,
  children,
  ...rest
}: { columnas?: 1 | 2; children: ReactNode } & BoxProps) {
  const contexto = useContext(ContextoCampo);
  return (
    <ContextoCampo.Provider value={{ ...contexto, enGrilla: true }}>
      <Box
        display="grid"
        gridTemplateColumns={
          columnas === 2 ? { base: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } : "minmax(0, 1fr)"
        }
        columnGap="5"
        rowGap="5"
        {...rest}
      >
        {children}
      </Box>
    </ContextoCampo.Provider>
  );
}

/** Contenido que no es un campo (un aviso, una nota) a lo ancho de la grilla. */
export function CeldaCompleta({ children, ...rest }: { children: ReactNode } & BoxProps) {
  return (
    <Box gridColumn="1 / -1" minW="0" {...rest}>
      {children}
    </Box>
  );
}

/**
 * Pie de acciones: franja con filete arriba y fondo apenas distinto, para que
 * el final del formulario se note. Cancelar a la izquierda del primario, el
 * primario a la derecha. En el celular los botones van a lo ancho y el
 * primario queda arriba, al alcance del pulgar.
 */
export function PieFormulario({ children, ...rest }: { children: ReactNode } & BoxProps) {
  return (
    <Box
      display="flex"
      flexDirection={{ base: "column-reverse", sm: "row" }}
      justifyContent="flex-end"
      alignItems={{ base: "stretch", sm: "center" }}
      gap="3"
      px={{ base: "4", md: "8" }}
      py="4"
      bg="bg.subtle"
      borderTopWidth="1px"
      borderColor="border"
      {...rest}
    >
      {children}
    </Box>
  );
}

/**
 * El pie de casi todas las altas y ediciones: Cancelar y el primario con
 * ícono. Mientras se guarda, los dos quedan deshabilitados y el primario
 * muestra el spinner con "Guardando...". Para pies con más botones (o sin
 * Cancelar), armá el `PieFormulario` a mano con `BotonCancelar` y
 * `BotonGuardar`.
 */
export function AccionesAlta({
  etiqueta,
  guardando = false,
  onCancelar,
  icono: Icono = LuSave,
  deshabilitado = false,
  faltantes,
  mostrarFaltantes = false,
}: {
  /** Texto del primario: "Crear cliente", "Guardar cambios"... */
  etiqueta: ReactNode;
  guardando?: boolean;
  /** Sin `onCancelar` no se muestra Cancelar. */
  onCancelar?: () => void;
  icono?: IconType;
  /** Primario deshabilitado por una condición del formulario (no por guardar). */
  deshabilitado?: boolean;
  /**
   * Lo que falta completar (`faltantes(...).lista`) y si ya se intentó
   * guardar (`useIntentoEnvio().intentado`). Reemplaza a `AvisoFaltantes`:
   * el aviso queda pegado al pie, justo arriba del botón que se tocó.
   */
  faltantes?: string[];
  mostrarFaltantes?: boolean;
}) {
  const aviso = mostrarFaltantes && faltantes && faltantes.length > 0;
  return (
    <>
      {aviso ? (
        <Box px={{ base: "4", md: "8" }} pb="5">
          <BannerError mb="0">Para guardar falta completar: {faltantes.join(", ")}.</BannerError>
        </Box>
      ) : null}
      <PieFormulario>
        {onCancelar ? (
          <BotonCancelar onClick={onCancelar} disabled={guardando}>
            Cancelar
          </BotonCancelar>
        ) : null}
        <BotonGuardar loading={guardando} loadingText="Guardando..." disabled={deshabilitado}>
          <Icono aria-hidden />
          {etiqueta}
        </BotonGuardar>
      </PieFormulario>
    </>
  );
}

/* ────────────────────────────── Adornos ────────────────────────────────── */

/*
 * Inputs con un adorno fijo adentro del control. Son `Input` comunes (mismo
 * `value` / `onChange`, mismo `FormField`), envueltos en `InputGroup`.
 */

const ESTILO_ADORNO = { color: "fg.subtle", fontSize: "sm", pointerEvents: "none" } as const;

/** Cantidad con la unidad a la derecha ("kg", "L", "unid."). Sin unidad, input liso. */
export function InputUnidad({ unidad, ...props }: InputProps & { unidad?: ReactNode }) {
  return (
    <InputGroup
      w="100%"
      endElement={unidad ? <Text as="span" {...ESTILO_ADORNO}>{unidad}</Text> : undefined}
    >
      <Input {...props} />
    </InputGroup>
  );
}

/** Fecha con ícono de calendario a la izquierda. */
export function InputFecha(props: InputProps) {
  return (
    <InputGroup w="100%" startElement={<LuCalendar aria-hidden />} startElementProps={ESTILO_ADORNO}>
      <Input type="date" data-input-fecha="" {...props} />
    </InputGroup>
  );
}

/** Importe con "$" a la izquierda. */
export function InputMoneda(props: InputProps) {
  return (
    <InputGroup w="100%" startElement={<Text as="span" {...ESTILO_ADORNO}>$</Text>}>
      <Input type="number" inputMode="decimal" {...props} />
    </InputGroup>
  );
}
