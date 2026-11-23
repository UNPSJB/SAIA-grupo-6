import {
  Box,
  Heading,
  Input,
  InputGroup,
  Text,
  type BoxProps,
  type InputProps,
} from "@chakra-ui/react";
import { createContext, useContext, type ReactNode } from "react";
import type { IconType } from "react-icons/lib";
import { LuCalendar, LuSave } from "react-icons/lu";
import {
  BannerError,
  BotonCancelar,
  BotonGuardar,
  ContextoCampo,
  SIN_VALIDACION_NATIVA,
} from "./patrones";
import { EnlaceVolver, PADDING_PAGINA, type DestinoVolver } from "./plantillas";

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

/**
 * Tipo de alta, para que `GrillaFormulario` elija sus columnas sin que cada
 * página lo repita: en un `extenso` (a todo el ancho) la grilla pasa a tres
 * columnas desde `xl`.
 */
const ContextoAnchoAlta = createContext<"formulario" | "extenso">("formulario");
/** Si el alta tiene panel lateral (el formulario queda más angosto). */
const ContextoLateralAlta = createContext(false);

interface PaginaAltaProps {
  /** "← Volver a [Módulo]": siempre, porque un alta se abre desde un listado. */
  volver: DestinoVolver;
  titulo: ReactNode;
  /** Una línea: qué se registra y para qué. */
  descripcion?: ReactNode;
  /** Ícono de la entidad, en el recuadro teal junto al título. */
  icono?: IconType;
  /**
   * Cuánto de la grilla de 12 columnas ocupa el formulario en escritorio:
   * sin `lateral`, siempre 12/12; con `lateral`, `formulario` 8/4 y
   * `extenso` 9/3. La página en sí siempre tiene el ancho de la app.
   */
  ancho?: "formulario" | "extenso";
  /**
   * Panel a la derecha del formulario desde `lg` (ayuda, resumen de lo que
   * se va a crear, avisos). En el celular va debajo. Sin lateral, el
   * formulario ocupa todo el ancho y reparte los campos en 3 columnas.
   */
  lateral?: ReactNode;
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
 * error y el formulario. Mismo ancho y padding que el resto de la app (ver
 * `plantillas.tsx`): "Volver" y el título quedan alineados con los listados;
 * lo que se acota es la columna del formulario.
 */
export function PaginaAlta({
  volver,
  titulo,
  descripcion,
  icono: Icono,
  ancho = "formulario",
  lateral,
  error,
  leyendaObligatorios = true,
  children,
}: PaginaAltaProps) {
  const columnas = COLUMNAS_ALTA[ancho][lateral ? "conLateral" : "solo"];
  return (
    <ContextoAnchoAlta.Provider value={ancho}>
    <ContextoLateralAlta.Provider value={Boolean(lateral)}>
    <Box p={PADDING_PAGINA} w="100%" minW="0">
      <EnlaceVolver {...volver} />

      <Box
        display="grid"
        gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "repeat(12, minmax(0, 1fr))" }}
        columnGap="6"
        alignItems="start"
      >
        {/* El encabezado va sobre la columna del formulario: la leyenda de
            obligatorios queda sobre el borde derecho de la tarjeta, y el
            lateral arranca a la altura de la tarjeta, no del título. */}
        <Box gridColumn={{ base: "1 / -1", lg: `1 / span ${columnas}` }} minW="0">
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
        </Box>
        <Box gridColumn={{ base: "1 / -1", lg: `1 / span ${columnas}` }} minW="0">
          {error ? <BannerError mb="5">{error}</BannerError> : null}
          {children}
        </Box>
        {lateral ? (
          <Box
            as="aside"
            gridColumn={{ base: "1 / -1", lg: `${columnas + 1} / -1` }}
            gridRow={{ lg: "2" }}
            minW="0"
            display="flex"
            flexDirection="column"
            gap="5"
            mb="8"
            position={{ lg: "sticky" }}
            top={{ lg: "6" }}
          >
            {lateral}
          </Box>
        ) : null}
      </Box>
    </Box>
    </ContextoLateralAlta.Provider>
    </ContextoAnchoAlta.Provider>
  );
}

/** Columnas (de 12) del formulario en escritorio, según el tipo de alta. */
const COLUMNAS_ALTA = {
  // Sin lateral, todo el ancho: antes era 8/12 y en un monitor ancho quedaba
  // vacío el tercio derecho. Los campos se reparten en 3 columnas desde `xl`
  // (ver GrillaFormulario), así no se estiran de más.
  formulario: { solo: 12, conLateral: 8 },
  extenso: { solo: 12, conLateral: 9 },
} as const;

/**
 * Tarjeta del panel lateral de un alta: ayuda, resumen, avisos. Mismo marco
 * que el formulario pero sin peso visual: título chico y texto atenuado.
 */
export function TarjetaLateral({
  titulo,
  children,
  ...rest
}: { titulo?: ReactNode; children: ReactNode } & Omit<BoxProps, "title">) {
  return (
    <Box
      bg="bg.panel"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow="panel"
      px="5"
      py="4"
      fontSize="sm"
      color="fg.muted"
      {...rest}
    >
      {titulo ? (
        <Heading as="h3" fontSize="sm" fontWeight="semibold" color="fg" mb="2">
          {titulo}
        </Heading>
      ) : null}
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
 * Grilla de campos: dos columnas desde tablet, una en el celular. Con
 * `columnas={3}`, tres desde `xl`; es lo que toma por defecto dentro de un
 * alta `extenso`, donde dos columnas a todo el ancho dejan inputs demasiado
 * largos. Los `FormField` de adentro pierden su margen (lo pone el `gap`) y
 * con `completo` ocupan toda la fila.
 */
export function GrillaFormulario({
  columnas: columnasPedidas,
  children,
  ...rest
}: { columnas?: 1 | 2 | 3; children: ReactNode } & BoxProps) {
  const contexto = useContext(ContextoCampo);
  const anchoAlta = useContext(ContextoAnchoAlta);
  const conLateral = useContext(ContextoLateralAlta);
  // A todo el ancho, 3 columnas desde `xl`; al lado de un lateral, 2.
  const columnas = columnasPedidas ?? (conLateral && anchoAlta === "formulario" ? 2 : 3);
  return (
    <ContextoCampo.Provider value={{ ...contexto, enGrilla: true }}>
      <Box
        display="grid"
        gridTemplateColumns={COLUMNAS_GRILLA[columnas]}
        columnGap="5"
        rowGap="5"
        {...rest}
      >
        {children}
      </Box>
    </ContextoCampo.Provider>
  );
}

const COLUMNAS_GRILLA = {
  1: "minmax(0, 1fr)",
  2: { base: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
  3: {
    base: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
    xl: "repeat(3, minmax(0, 1fr))",
  },
} as const;

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
