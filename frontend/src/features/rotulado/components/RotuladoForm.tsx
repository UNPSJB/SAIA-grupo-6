import { AvisoDeclaracionesPendientes, DeclaracionesSection, type EstadoConservacion } from "./DeclaracionesSection";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Badge, Box, Button, Grid, Heading, HStack, SimpleGrid, Stack, Text, Textarea, chakra, type TextProps } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { LuArrowLeft, LuArrowRight, LuCheck } from "react-icons/lu";
import {
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  faltantes,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  SIN_VALIDACION_NATIVA,
  TarjetaFormulario,
  TituloFormulario,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import { usePistaScroll } from "../../../common/hooks/usePistaScroll";
import { IndicadorCompletitud } from "./IndicadorCompletitud";
import { CampoOrigen } from "./CampoOrigen";
import { ResumenNutricional } from "./ResumenNutricional";
import type { BorradorRotuladoOut } from "../types/rotulado";
import { OrdenListaIngredientes } from "../../recetas/components/OrdenListaIngredientes";
import { previewAutocompletado } from "../services/rotuladoService";
import { evaluarNutricion } from "../utils/nutricionRotulo";
import { armarTextoRotulo, declaracionEfectiva, type ResumenDeclaracion } from "../utils/textoRotulo";
import { evaluarRotulado } from "../../rotuladoFrontal/services/rotuladoFrontalService";

/*
 * Editor del borrador en seis secciones, de a una por vez: menú lateral con
 * el estado de cada una y el progreso global, y un encabezado fijo con las
 * acciones. Todas las secciones quedan montadas (las ocultas con
 * `display: none`) para no perder lo escrito ni el estado de las
 * declaraciones al cambiar de sección.
 */
export type SeccionId = "producto" | "origen" | "lote" | "nutricion" | "alergenos" | "conservacion";

const SECCIONES: { id: SeccionId; titulo: string }[] = [
  { id: "producto", titulo: "Producto e ingredientes" },
  { id: "origen", titulo: "Origen y establecimiento" },
  { id: "lote", titulo: "Lote y fechas" },
  { id: "nutricion", titulo: "Información nutricional" },
  { id: "alergenos", titulo: "Alérgenos y gluten" },
  { id: "conservacion", titulo: "Conservación" },
];

// Campo de la completitud (o id del control) → sección donde se completa.
const SECCION_DE_CAMPO: Record<string, SeccionId> = {
  denominacion: "producto", ingredientes: "producto", contenido: "producto",
  denominacion_venta: "producto", lista_ingredientes: "producto", contenido_neto: "producto",
  rnpa: "origen", razonSocial: "origen", domicilio: "origen", rnpa_rppa: "origen", razon_social: "origen",
  importador_razon_social: "origen", importador_domicilio: "origen",
  duracion: "lote", fecha_duracion: "lote", lote_producto: "lote", identificacion_lote: "lote",
  fecha_produccion: "lote", fecha_cierre: "lote", instrucciones_uso: "lote",
  datos_nutricionales_json: "nutricion", rotulado_frontal: "nutricion",
  declaraciones: "alergenos",
};

// Clave de la completitud → id del control a enfocar.
const ID_DE_CAMPO: Record<string, string> = {
  denominacion: "denominacion_venta", ingredientes: "lista_ingredientes", contenido: "contenido_neto",
  rnpa: "rnpa_rppa", razonSocial: "razon_social", duracion: "fecha_duracion",
};

/*
 * Etiquetas y textos de ayuda de los campos, solo dentro del editor: los
 * componentes compartidos (`FormField`) no cambian en el resto de la app.
 */
const ESTILO_CAMPOS = {
  "& [data-scope=field][data-part=label]": { color: "fg", lineHeight: "1.4" },
  "& [data-scope=field][data-part=helper-text]": {
    marginTop: "0", fontSize: "13px", lineHeight: "1.45", color: "fg.muted",
  },
  "& :is(input:not([type=checkbox]), select)": { minHeight: "40px" },
  "& textarea": { paddingInline: "3", paddingBlock: "2.5", lineHeight: "1.5" },
  "& input[type=checkbox]": { width: "16px", height: "16px", flexShrink: 0 },
};

/** Texto de ayuda suelto, con el mismo aspecto que el de los campos. */
function Ayuda(props: TextProps) {
  return <Text fontSize="13px" lineHeight="1.45" color="fg.muted" {...props} />;
}

function seccionDelFragmento(): SeccionId {
  const id = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return SECCION_DE_CAMPO[id] ?? "producto";
}

/** Lo que el rótulo usa de cada lote del producto. */
export interface LoteDelRotulo {
  id: number;
  numero_lote: string;
  version_receta_id: number | null;
  version_numero?: number | null;
  fecha_inicio?: string | null;
  fecha_cierre?: string | null;
  fecha_vencimiento?: string | null;
}

/** "2026-11-09T08:30:00" o "2026-11-09" → "2026-11-09" (valor de un input date). */
function soloFecha(valor: string | null | undefined): string {
  return valor ? valor.slice(0, 10) : "";
}

interface RotuladoFormProps {
  borrador: BorradorRotuladoOut | null;
  esCreacion: boolean;
  productoNombre?: string;
  onGuardar: (datos: Partial<BorradorRotuladoOut>) => Promise<void>;
  onAutocompletar: (
    versionId: number | null,
    loteId: number | null,
    forzar?: boolean,
  ) => Promise<void>;
  onRecalcularNutricion?: () => Promise<void>;
  lotes: LoteDelRotulo[];
  isLoading: boolean;
  hayFaltantes: boolean;
  onCancel?: () => void;
  onOrigenChange?: () => void;
  /** Acciones secundarias del encabezado (previsualizar, rotulado frontal). */
  accionesExtra?: ReactNode;
  onVolver?: () => void;
  /**
   * Sección activa guardada por la página: el formulario se vuelve a montar
   * cuando se recarga el borrador (al regenerar declaraciones, por ejemplo) y
   * así no vuelve a la primera.
   */
  seccionInicial?: SeccionId;
  onSeccionChange?: (seccion: SeccionId) => void;
}

export function RotuladoForm({
  borrador,
  esCreacion,
  productoNombre,
  onGuardar,
  onAutocompletar,
  onRecalcularNutricion,
  lotes,
  isLoading,
  hayFaltantes,
  onCancel,
  onOrigenChange,
  accionesExtra,
  onVolver,
  seccionInicial,
  onSeccionChange,
}: RotuladoFormProps) {
  const valoresIniciales: Partial<BorradorRotuladoOut> = !borrador
    ? {
        denominacion_venta: "",
        lista_ingredientes: "",
        contenido_neto: "",
        rnpa_rppa: "",
        razon_social: "",
        domicilio: "",
        identificacion_lote: "",
        fecha_produccion: "",
        fecha_cierre: "",
        fecha_duracion: "",
        instrucciones_uso: "",
        es_importado: false,
        importador_razon_social: "",
        importador_domicilio: "",
        estado: "borrador",
        datos_nutricionales_json: null,
        sellos_disponibles: false,
      }
    : {
        denominacion_venta: borrador?.denominacion_venta ?? "",
        lista_ingredientes: borrador?.lista_ingredientes ?? "",
        contenido_neto: borrador?.contenido_neto ?? "",
        rnpa_rppa: borrador?.rnpa_rppa ?? "",
        razon_social: borrador?.razon_social ?? "",
        domicilio: borrador?.domicilio ?? "",
        identificacion_lote: borrador?.identificacion_lote ?? "",
        fecha_produccion: borrador?.fecha_produccion ?? "",
        fecha_cierre: borrador?.fecha_cierre ?? "",
        fecha_duracion: borrador?.fecha_duracion ?? "",
        instrucciones_uso: borrador?.instrucciones_uso ?? "",
        es_importado: borrador?.es_importado ?? false,
        importador_razon_social: borrador?.importador_razon_social ?? "",
        importador_domicilio: borrador?.importador_domicilio ?? "",
        estado: borrador?.estado ?? "borrador",
        datos_nutricionales_json: borrador?.datos_nutricionales_json ?? null,
        sellos_disponibles: borrador?.sellos_disponibles ?? false,
      };

  const [formularioSucio, setFormularioSucio] = useState(false);
  const [declaracionesSucias, setDeclaracionesSucias] = useState(false);
  const [declaracionesPendientes, setDeclaracionesPendientes] = useState(true);
  const [avisoDeclaraciones, setAvisoDeclaraciones] = useState(false);
  //const [declaracion, setDeclaracion] = useState<ResumenDeclaracion | null>(null);
  const [declaracionGuardada, setDeclaracion] = useState<ResumenDeclaracion | null>(null);
  const declaracion = declaracionEfectiva(declaracionGuardada, borrador?.declaraciones);
  const [values, setValues] = useState<Partial<BorradorRotuladoOut>>(valoresIniciales);

  const [loteSeleccionado, setLoteSeleccionado] = useState<number | null>(
    esCreacion ? null : borrador?.lote_producto_id ?? null,
  );

  const { intentado, puedeEnviar } = useIntentoEnvio();

  const [seccion, setSeccionLocal] = useState<SeccionId>(() => seccionInicial ?? seccionDelFragmento());
  const setSeccion = useCallback((destino: SeccionId) => {
    setSeccionLocal(destino);
    onSeccionChange?.(destino);
  }, [onSeccionChange]);
  const [conservacion, setConservacion] = useState<EstadoConservacion>("vacia");
  const contenidoRef = useRef<HTMLDivElement>(null);
  const irASeccion = useCallback((destino: SeccionId, campoId?: string) => {
    setSeccion(destino);
    // Después de mostrar la sección: llevar la vista a su comienzo o al campo.
    requestAnimationFrame(() => {
      const campo = campoId ? document.getElementById(campoId) : null;
      if (campo) {
        campo.scrollIntoView?.({ block: "center" });
        const control = campo.matches("input, select, textarea") ? campo : campo.querySelector<HTMLElement>("input, select, textarea");
        control?.focus({ preventScroll: true });
      } else {
        contenidoRef.current?.scrollIntoView?.({ block: "start" });
      }
    });
  }, [setSeccion]);
  // En pantallas chicas los pasos van en una fila que se desplaza: el activo
  // queda siempre a la vista (antes la fila se quedaba en el primero).
  const listaPasosRef = useRef<HTMLElement | null>(null);
  const { ref: refPista, mascara: mascaraPasos } = usePistaScroll();
  const refPasos = useCallback((el: HTMLElement | null) => {
    listaPasosRef.current = el;
    refPista(el);
  }, [refPista]);
  useEffect(() => {
    const lista = listaPasosRef.current;
    const activo = lista?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!lista || !activo || lista.scrollWidth <= lista.clientWidth) return;
    lista.scrollLeft = activo.offsetLeft - lista.offsetLeft - (lista.clientWidth - activo.offsetWidth) / 2;
  }, [seccion]);
  // Un enlace con #campo (desde la previsualización) abre su sección.
  useEffect(() => {
    const alCambiar = () => setSeccion(seccionDelFragmento());
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, [setSeccion]);

  // Rotulado frontal (octógonos): no se carga acá, sale de la evaluación del
  // producto y su versión de receta. Mientras esté "sin definir" el rótulo no
  // está completo (y el lote no se puede reservar).
  const productoId = borrador?.producto_id ?? null;
  const versionFrontal =
    lotes.find((l) => l.id === loteSeleccionado)?.version_receta_id ?? borrador?.version_receta_id ?? null;
  const [frontal, setFrontal] = useState<{ estado: string; motivo: string | null } | null>(null);
  useEffect(() => {
    if (!productoId) return;
    let vigente = true;
    evaluarRotulado(productoId, versionFrontal ?? undefined, true)
      .then((e) => {
        if (!vigente) return;
        const decidido: Record<string, string> = {
          aplica: "Lleva sellos",
          no_aplica: "No lleva sellos",
          no_aplica_canal_industrial: "No aplica: canal industrial",
          exceptuado: "Exceptuado",
        };
        if (e.estado === "modulo_inactivo") setFrontal({ estado: "no_aplicable", motivo: "Módulo de octógonos desactivado" });
        else if (decidido[e.estado]) setFrontal({ estado: "completo", motivo: decidido[e.estado] });
        else setFrontal({ estado: "pendiente", motivo: e.faltantes?.join("; ") || e.mensaje });
      })
      .catch((err: Error) => vigente && setFrontal({ estado: "pendiente", motivo: err.message }));
    return () => {
      vigente = false;
    };
  }, [productoId, versionFrontal]);

  const reglasFaltantes: Record<string, [boolean, string]> = {
    denominacion: [!values.denominacion_venta?.trim(), "denominación de venta"],
    ingredientes: [!values.lista_ingredientes?.trim(), "lista de ingredientes"],
    contenido: [!values.contenido_neto?.trim(), "contenido neto"],
    rnpa: [!values.rnpa_rppa?.trim(), "registro del producto (RNPA/RPPA)"],
    razonSocial: [!values.razon_social?.trim(), "razón social del establecimiento"],
    domicilio: [!values.domicilio?.trim(), "domicilio del establecimiento"],
    duracion: [!values.fecha_duracion, "fecha de duración"],
  };

  const faltan = faltantes(reglasFaltantes);
  const campos: { nombre: string; etiqueta: string; estado: string; motivo?: string | null }[] =
    Object.entries(reglasFaltantes).map(([nombre, [pendiente, etiqueta]]) => ({
      nombre, etiqueta, estado: pendiente ? "pendiente" : "completo",
    }));
  for (const [nombre, etiqueta] of [["importador_razon_social", "Raz\u00f3n social del importador"], ["importador_domicilio", "Domicilio del importador"]] as const) {
    campos.push({ nombre, etiqueta, estado: !values.es_importado ? "no_aplicable" : values[nombre]?.trim() ? "completo" : "pendiente" });
  }
  campos.push({ nombre: "lote_producto", etiqueta: "Lote de producción", estado: loteSeleccionado ? "completo" : "pendiente" });
  campos.push({ nombre: "identificacion_lote", etiqueta: "Identificaci\u00f3n del lote", estado: !loteSeleccionado ? "no_aplicable" : values.identificacion_lote?.trim() ? "completo" : "pendiente" });
  for (const [nombre, etiqueta] of [["fecha_produccion", "Fecha de producci\u00f3n"], ["fecha_cierre", "Fecha de cierre"]] as const) {
    campos.push({ nombre, etiqueta, estado: !loteSeleccionado ? "no_aplicable" : values[nombre] ? "completo" : "pendiente" });
  }
  campos.push({ nombre: "instrucciones_uso", etiqueta: "Instrucciones de uso", estado: values.instrucciones_uso?.trim() ? "completo" : "pendiente" });
  const nutricion = evaluarNutricion(values.datos_nutricionales_json, versionFrontal);
  campos.push({ nombre: "datos_nutricionales_json", etiqueta: "Informaci\u00f3n nutricional", ...nutricion });

  campos.push({ nombre: "declaraciones", etiqueta: "Declaraciones", estado: declaracionesPendientes ? "pendiente" : "completo" });
  if (frontal) {
    campos.push({ nombre: "rotulado_frontal", etiqueta: "Rotulado frontal (octógonos)", estado: frontal.estado, motivo: frontal.motivo });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (declaracionesSucias) { setAvisoDeclaraciones(true); return; }
    if (!puedeEnviar(faltan.lista)) {
      // Llevar a la primera sección con un obligatorio vacío.
      const primero = Object.entries(reglasFaltantes).find(([, [pendiente]]) => pendiente)?.[0];
      if (primero) irASeccion(SECCION_DE_CAMPO[primero], ID_DE_CAMPO[primero] ?? primero);
      return;
    }
    const versionOrigen = lotes.find(l => l.id === loteSeleccionado)?.version_receta_id ?? borrador?.version_receta_id ?? null;
    await onGuardar({ ...values, version_receta_id: versionOrigen, lote_producto_id: loteSeleccionado, fecha_produccion: values.fecha_produccion || null, fecha_cierre: values.fecha_cierre || null, fecha_duracion: values.fecha_duracion || null });
  };

  // Elegir el lote trae sus datos: identificación y fechas son de esa tanda.
  // La fecha de duración solo si el lote tiene vencimiento calculado.
  const [loteAplicado, setLoteAplicado] = useState<string | null>(null);
  const elegirLote = (id: number | null) => {
    setLoteSeleccionado(id);
    const lote = lotes.find((l) => l.id === id);
    if (!lote) {
      setLoteAplicado(null);
      return;
    }
    setValues((prev) => ({
      ...prev,
      identificacion_lote: lote.numero_lote,
      fecha_produccion: soloFecha(lote.fecha_inicio) || prev.fecha_produccion,
      fecha_cierre: soloFecha(lote.fecha_cierre),
      fecha_duracion: soloFecha(lote.fecha_vencimiento) || prev.fecha_duracion,
    }));
    setLoteAplicado(lote.numero_lote);
  };

  const handleAutocompletar = async (forzar: boolean) => {
    if (formularioSucio || declaracionesSucias) return;
    await onAutocompletar(null, loteSeleccionado, forzar);
  };
  
    const regenerarLista = async () => {
    if (!borrador) return;
    const vista = await previewAutocompletado(borrador.producto_id, borrador.version_receta_id);
    if (vista.lista_ingredientes) {
      setValues((prev) => ({ ...prev, lista_ingredientes: vista.lista_ingredientes }));
    }
  };


  const handleCambioEsImportado = (e: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({
      ...prev,
      es_importado: e.target.checked,
      importador_razon_social: e.target.checked
        ? prev.importador_razon_social
        : "",
      importador_domicilio: e.target.checked
        ? prev.importador_domicilio
        : "",
    }));
  };


  const nombreParaMostrar = productoNombre ?? borrador?.producto_nombre ?? "";

  if (!borrador && !esCreacion) {
    return (
      <TarjetaFormulario>
        <TituloFormulario>Cargando borrador...</TituloFormulario>
      </TarjetaFormulario>
    );
  }

  const esPendiente = (estado: string) => estado === "pendiente" || estado === "sin_datos_origen";
  const pendientesGlobales = campos.filter(c => esPendiente(c.estado)).length;
  const estadoDe = (id: SeccionId): { tono: "ok" | "pendiente" | "neutro"; cantidad: number } => {
    if (id === "conservacion") {
      return conservacion === "sin_guardar" ? { tono: "pendiente", cantidad: 1 }
        : conservacion === "cargada" ? { tono: "ok", cantidad: 0 } : { tono: "neutro", cantidad: 0 };
    }
    const cantidad = campos.filter(c => SECCION_DE_CAMPO[c.nombre] === id && esPendiente(c.estado)).length;
    return { tono: cantidad ? "pendiente" : "ok", cantidad };
  };
  const indice = SECCIONES.findIndex(x => x.id === seccion);
  const anterior = SECCIONES[indice - 1];
  const siguiente = SECCIONES[indice + 1];
  const visible = (id: SeccionId) => (seccion === id ? undefined : "none");

  const enlaceNutricion = borrador && !esCreacion && borrador.version_receta_id != null
    ? `/productos/${borrador.producto_id}/informacion-nutricional?version_id=${borrador.version_receta_id}`
    : undefined;

  return (
    <Box as="form" id="rotulado-form" onSubmit={handleSubmit} onChangeCapture={e => { if (!(e.target as HTMLElement).closest("[data-declaraciones]")) setFormularioSucio(true); }} css={ESTILO_CAMPOS} {...SIN_VALIDACION_NATIVA}>
      {/* Encabezado fijo: título, estado y acciones globales. */}
      {/* `top` negativo = relleno del <main>: así no asoma contenido por arriba
          del encabezado al desplazarse (el relleno extra compensa lo que queda
          oculto). En celular no queda fijo: ocuparía media pantalla. */}
      <Box position={{ base: "static", md: "sticky" }} top={{ base: "-8px", md: "-15px" }} zIndex="3" bg="bg" mx={{ base: "-3", md: "-5" }} px={{ base: "3", md: "5" }}
        pt={{ base: "calc(8px + 0.75rem)", md: "calc(15px + 0.75rem)" }} mt={{ base: "-8px", md: "-15px" }} pb="3" mb="4"
        borderBottomWidth="1px" borderColor="border.subtle">
        <HStack justify="space-between" align="center" gap="3" flexWrap="wrap">
          <HStack gap="3" minW="0" flexWrap="wrap" align="center">
            <Heading as="h1" fontSize={{ base: "18px", md: "21px" }} fontWeight="semibold" lineHeight="1.35" color="fg" lineClamp={{ base: 3, md: 1 }}>
              {esCreacion ? "Nuevo borrador de rotulado" : "Rotulado"} — {nombreParaMostrar}
            </Heading>
            <Badge colorPalette={pendientesGlobales ? "orange" : "green"} rounded="full" px="3" py="1" lineHeight="1">
              {pendientesGlobales ? "En preparación" : "Datos completos"}
            </Badge>
          </HStack>
          <HStack gap="2" flexWrap="wrap">
            {accionesExtra}
            {!esCreacion && (
              <Button type="button" variant="outline" size="sm"
                onClick={() => handleAutocompletar(false)}
                disabled={isLoading || formularioSucio || declaracionesSucias}>
                Autocompletar
              </Button>
            )}
            {onCancel && <BotonCancelar size="sm" onClick={onCancel}>Cancelar</BotonCancelar>}
            {onVolver && <Button type="button" variant="ghost" size="sm" onClick={onVolver}>Volver</Button>}
            <BotonGuardar size="sm" loading={isLoading} disabled={hayFaltantes}>
              Guardar borrador
            </BotonGuardar>
          </HStack>
        </HStack>
        {(avisoDeclaraciones && declaracionesSucias) || ((formularioSucio || declaracionesSucias) && !esCreacion) ? (
          <Stack gap="1" mt="2">
            {avisoDeclaraciones && declaracionesSucias && <Text role="alert" fontSize="sm" color="orange.fg">Guardá o descartá los cambios de declaraciones antes de guardar el formulario.</Text>}
            {(formularioSucio || declaracionesSucias) && !esCreacion && <Text fontSize="sm" color="fg.muted">Guardá los cambios antes de autocompletar.</Text>}
          </Stack>
        ) : null}
      </Box>

      <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

      <Grid templateColumns={{ base: "minmax(0, 1fr)", lg: "272px minmax(0, 1fr)" }} gap={{ base: "5", lg: "6" }} alignItems="start">
        {/* Menú lateral: progreso y secciones (arriba, en fila, en pantallas chicas). */}
        <Stack gap="4" position={{ lg: "sticky" }} top={{ lg: "92px" }} minW="0">
          <IndicadorCompletitud compacto barra sinInsignia
            onIrA={campo => irASeccion(SECCION_DE_CAMPO[campo] ?? "producto", ID_DE_CAMPO[campo] ?? campo)}
            completitud={{
              estado_global: pendientesGlobales ? "pendiente" : "completo",
              campos,
            }}
          />
          <chakra.nav aria-label="Secciones del rótulo">
            <Text fontSize="13px" color="fg.muted" mb="2" hideFrom="lg">
              Paso {indice + 1} de {SECCIONES.length}
            </Text>
            <Stack as="ul" ref={refPasos} listStyleType="none" m="0" p="0" direction={{ base: "row", lg: "column" }} gap="1"
              overflowX={{ base: "auto", lg: "visible" }} pb={{ base: "1", lg: "0" }}
              style={{ maskImage: mascaraPasos, WebkitMaskImage: mascaraPasos }}>
              {SECCIONES.map((x, i) => {
                const est = estadoDe(x.id);
                const activa = x.id === seccion;
                return (
                  <Box as="li" key={x.id} flexShrink={0}>
                    <Button type="button" variant="ghost" colorPalette={activa ? "brand" : "gray"}
                      w={{ lg: "full" }} h="auto" minH="10" py="2.5" px="3" rounded="lg" justifyContent="flex-start" gap="2.5" size="sm"
                      fontWeight={activa ? "medium" : "normal"} color={activa ? "brand.fg" : "fg"}
                      bg={activa ? "brand.500/16" : undefined} _hover={{ bg: activa ? "brand.500/24" : "bg.subtle" }}
                      // Indicador del paso activo: al costado en la lista, abajo en la fila de celular.
                      boxShadow={activa ? {
                        base: "inset 0 -2px 0 var(--chakra-colors-brand-fg)",
                        lg: "inset 3px 0 0 var(--chakra-colors-brand-fg)",
                      } : undefined}
                      aria-current={activa ? "step" : undefined} onClick={() => irASeccion(x.id)}>
                      <Text as="span" color={activa ? "inherit" : "fg.muted"} fontVariantNumeric="tabular-nums">{i + 1}.</Text>
                      <Text as="span" flex="1" textAlign="start">{x.titulo}</Text>
                      {est.tono === "ok" && <Box as="span" color="green.fg" aria-label="Completa"><LuCheck /></Box>}
                      {est.tono === "pendiente" && <Badge colorPalette="orange" size="sm" rounded="full" aria-label={`${est.cantidad} pendientes`}>{est.cantidad}</Badge>}
                      {est.tono === "neutro" && <Box as="span" w="2" h="2" rounded="full" bg="border.emphasized" aria-label="Sin datos" />}
                    </Button>
                  </Box>
                );
              })}
            </Stack>
          </chakra.nav>
        </Stack>

        {/* Área de trabajo: solo la sección activa. */}
        <Box ref={contenidoRef} minW="0" scrollMarginTop="88px">
          <Seccion titulo="Producto e ingredientes" display={visible("producto")}>
            <SimpleGrid columns={{ base: 1, md: 2 }} columnGap="5" rowGap="6">
              <ConOrigen origen={<CampoOrigen origen="producto" />}>
                <FormField id="denominacion_venta" label="Denominación de venta" required mb="0">
                  <FormInput
                    value={values.denominacion_venta ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, denominacion_venta: e.target.value }))}
                    placeholder="Ej: Mermelada de frutilla"
                  />
                </FormField>
              </ConOrigen>
              <FormField id="contenido_neto" label="Contenido neto" required mb="0">
                <FormInput
                  value={values.contenido_neto ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, contenido_neto: e.target.value }))}
                  placeholder="Ej: 450 g"
                />
              </FormField>
            </SimpleGrid>
            <Stack gap="4">
              <ConOrigen origen={<CampoOrigen origen="receta" version={borrador?.version_receta_numero} />}>
                <FormField id="lista_ingredientes" label="Ingredientes y aditivos" required mb="0">
                  <Textarea
                    value={armarTextoRotulo(values.lista_ingredientes ?? "", declaracion?.texto)}
                    readOnly
                    placeholder="Se completa sola cuando el producto tiene receta"
                    minH="100px"
                    bg="bg.subtle"
                    cursor="default"
                  />
                </FormField>
              </ConOrigen>
              {/* Barra de herramientas de la lista. */}
              <HStack columnGap="4" rowGap="3" flexWrap="wrap" align="center" bg="bg.subtle" rounded="lg" p="3.5">
                <Ayuda flex="1 1 260px">
                  Se arma sola con la receta. Lo único que se decide a mano es el orden entre insumos que pesan lo mismo.
                </Ayuda>
                <Button size="xs" variant="outline" borderColor="border.emphasized" flexShrink={0} disabled={isLoading || !borrador} onClick={() => { void regenerarLista(); }}>
                  Volver a armar la lista con la receta
                </Button>
              </HStack>
            </Stack>
            <OrdenListaIngredientes
              versionId={borrador?.version_receta_id ?? null}
              onOrdenCambiado={regenerarLista}
            />
          </Seccion>

          <Seccion titulo="Origen y establecimiento" display={visible("origen")}>
            <Stack gap="3">
              <SimpleGrid columns={{ base: 1, md: 3 }} columnGap="5" rowGap="6">
                <FormField id="rnpa_rppa" label="RNPA / RPPA" required mb="0">
                  <FormInput
                    value={values.rnpa_rppa ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, rnpa_rppa: e.target.value }))}
                    placeholder="Número declarado por el elaborador"
                  />
                </FormField>
                <ConOrigen origen={<CampoOrigen origen="establecimiento" />}>
                  <FormField id="razon_social" label="Razón social" required mb="0">
                    <FormInput
                      value={values.razon_social ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, razon_social: e.target.value }))}
                      placeholder="Nombre del establecimiento elaborador"
                    />
                  </FormField>
                </ConOrigen>
                <ConOrigen origen={<CampoOrigen origen="establecimiento" />}>
                  <FormField id="domicilio" label="Domicilio" required mb="0">
                    <FormInput
                      value={values.domicilio ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, domicilio: e.target.value }))}
                      placeholder="Dirección del establecimiento"
                    />
                  </FormField>
                </ConOrigen>
              </SimpleGrid>
              <Ayuda>
                RNPA/RPPA: dato declarado por el elaborador, sin verificación contra registros oficiales. Razón social y domicilio se autocompletan con los del establecimiento (Establecimientos).
              </Ayuda>
            </Stack>
            <Stack gap="5" borderTopWidth="1px" borderColor="border.subtle" pt="5">
              <HStack as="label" gap="2.5" align="center" alignSelf="start" cursor="pointer">
                <input type="checkbox" checked={values.es_importado ?? false} onChange={handleCambioEsImportado} />
                <Text fontSize="sm" color="fg">¿Producto importado?</Text>
              </HStack>
              {values.es_importado && (
                <SimpleGrid columns={{ base: 1, md: 2 }} columnGap="5" rowGap="6">
                  <FormField id="importador_razon_social" label="Razón social del importador" mb="0">
                    <FormInput
                      value={values.importador_razon_social ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, importador_razon_social: e.target.value }))}
                    />
                  </FormField>
                  <FormField id="importador_domicilio" label="Domicilio del importador" mb="0">
                    <FormInput
                      value={values.importador_domicilio ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, importador_domicilio: e.target.value }))}
                    />
                  </FormField>
                </SimpleGrid>
              )}
            </Stack>
          </Seccion>

          <Seccion titulo="Lote y fechas" display={visible("lote")}>
            <SimpleGrid columns={{ base: 1, md: 2 }} columnGap="5" rowGap="6">
              <FormField id="lote_producto" label="Lote de producción" required mb="0"
                helper="Sin lote se puede guardar como modelo, pero el rótulo no queda completo.">
                <FormNativeSelect
                  value={loteSeleccionado ?? 0}
                  onChange={(e) => elegirLote(e.target.value ? Number(e.target.value) : null)}
                >
                  <SelectPlaceholder>Seleccioná un lote</SelectPlaceholder>
                  {lotes.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {lote.numero_lote}
                      {lote.version_numero != null ? ` (receta v${lote.version_numero})` : ""}
                    </option>
                  ))}
                </FormNativeSelect>
              </FormField>
              {loteSeleccionado && (
                <ConOrigen origen={<CampoOrigen origen="lote" />} etiquetaLarga>
                  <FormField id="identificacion_lote" label="Identificación del lote (visible en rótulo)" mb="0">
                    <FormInput
                      value={values.identificacion_lote ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, identificacion_lote: e.target.value }))}
                    />
                  </FormField>
                </ConOrigen>
              )}
            </SimpleGrid>
            {loteAplicado && (
              <Ayuda role="status">
                Identificación y fechas completadas con los datos del lote {loteAplicado}. Podés ajustarlas antes de guardar.
              </Ayuda>
            )}
            <SimpleGrid columns={{ base: 1, md: 3 }} columnGap="5" rowGap="6">
              <FormField id="fecha_produccion" label="Fecha de producción" mb="0">
                <FormInput type="date" value={values.fecha_produccion ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, fecha_produccion: e.target.value }))} />
              </FormField>
              <FormField id="fecha_cierre" label="Fecha de cierre" mb="0">
                <FormInput type="date" value={values.fecha_cierre ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, fecha_cierre: e.target.value }))} />
              </FormField>
              <FormField id="fecha_duracion" label="Fecha de duración" required mb="0">
                <FormInput type="date" value={values.fecha_duracion ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, fecha_duracion: e.target.value }))} />
              </FormField>
            </SimpleGrid>
            <FormField id="instrucciones_uso" label="Instrucciones de uso (cuando corresponda)" mb="0">
              <Textarea
                value={values.instrucciones_uso ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, instrucciones_uso: e.target.value }))}
                placeholder="Instrucciones de uso"
                minH="80px"
              />
            </FormField>
          </Seccion>

          <Seccion titulo="Información nutricional" id="datos_nutricionales_json" display={visible("nutricion")}
            insignias={<>
              <CampoOrigen origen="nutricion" />
              {borrador?.version_receta_numero != null && (
                <Text fontSize="sm" color="fg.muted">Versión de receta del borrador: {borrador.version_receta_numero}</Text>
              )}
              {nutricion.estado !== "sin_datos_origen" && (
                <Badge colorPalette={nutricion.estado === "completo" ? "green" : "orange"} rounded="full">
                  {nutricion.estado === "completo" ? "Datos completos" : "Datos incompletos"}
                </Badge>
              )}
            </>}
            acciones={<>
              {enlaceNutricion && (
                <Button asChild size="sm" variant="outline">
                  <Link to={enlaceNutricion}>Abrir información nutricional del producto</Link>
                </Button>
              )}
              {onRecalcularNutricion && (
                <Button type="button" size="sm" variant="outline"
                  disabled={isLoading || formularioSucio || declaracionesSucias}
                  onClick={onRecalcularNutricion}>
                  Recalcular y reemplazar tabla nutricional
                </Button>
              )}
            </>}
          >
            {onRecalcularNutricion && (
              <Ayuda>Recalcular reemplaza la tabla guardada con un cálculo para la versión de receta del borrador.</Ayuda>
            )}
            <Box as="aside" aria-label="Sellos de advertencia" rounded="lg" bg="brand.subtle"
              borderStartWidth="3px" borderStartColor="brand.fg" px="4" py="3">
              <HStack columnGap="3" rowGap="1" flexWrap="wrap">
                <Text fontWeight="semibold" fontSize="sm" color="brand.fg">Sellos de advertencia</Text>
                <Text fontSize="sm">Consultar Octogonos en la previsualizacion del borrador</Text>
              </HStack>
              {frontal?.motivo && <Ayuda mt="1.5">Rotulado frontal: {frontal.motivo}</Ayuda>}
            </Box>
            <ResumenNutricional compacta valor={values.datos_nutricionales_json ?? ""} />
          </Seccion>

          {/* Alérgenos y conservación: un solo componente (misma revisión de declaraciones). */}
          <Seccion
            id="declaraciones"
            titulo={seccion === "conservacion" ? "Conservación" : "Alérgenos y gluten"}
            display={seccion === "alergenos" || seccion === "conservacion" ? undefined : "none"}
          >
            {seccion === "alergenos" && declaracionesPendientes && <AvisoDeclaracionesPendientes />}
            <DeclaracionesSection borradorId={esCreacion ? 0 : borrador?.id ?? 0}
              productoId={borrador?.producto_id ?? 0} preview={borrador?.declaraciones}
              vista={seccion === "conservacion" ? "conservacion" : "alergenos"}
              formularioSucio={formularioSucio} onEstado={setDeclaracionesPendientes} onDirtyChange={setDeclaracionesSucias}
              onOrigenChange={onOrigenChange} onDeclaracion={setDeclaracion} onConservacion={setConservacion} />
          </Seccion>

          {/* Navegación entre secciones. */}
          <HStack justify="space-between" mt="5" gap="3" flexWrap="wrap">
            {anterior ? (
              <Button type="button" variant="outline" borderColor="border.emphasized" size="sm" onClick={() => irASeccion(anterior.id)}>
                <LuArrowLeft /> {anterior.titulo}
              </Button>
            ) : <span />}
            {siguiente ? (
              <Button type="button" variant="outline" borderColor="border.emphasized" size="sm" ms="auto" onClick={() => irASeccion(siguiente.id)}>
                {siguiente.titulo} <LuArrowRight />
              </Button>
            ) : <span />}
          </HStack>
        </Box>
      </Grid>
    </Box>
  );
}

/**
 * Tarjeta de una sección del editor (solo se ve la activa). `display` cae en
 * "flex" explícito: con `undefined`, el `Stack` pasaba a bloque y perdía toda
 * la separación entre campos.
 */
function Seccion({ children, titulo, id, display, insignias, acciones }: {
  children: ReactNode; titulo: string; id?: string; display?: string; insignias?: ReactNode; acciones?: ReactNode;
}) {
  return (
    <Stack as="section" id={id} tabIndex={id ? -1 : undefined} aria-label={titulo} display={display ?? "flex"} gap="6" minW="0"
      p={{ base: "5", md: "6", xl: "8" }} borderWidth="1px" borderColor="border.subtle" rounded="xl" bg="bg.panel"
      // Un hijo que no muestra nada no suma separación.
      css={{ "& > :empty": { display: "none" } }}>
      <HStack justify="space-between" align="center" columnGap="4" rowGap="3" flexWrap="wrap" pb="3" borderBottomWidth="1px" borderColor="border.emphasized">
        <HStack columnGap="3" rowGap="2" flexWrap="wrap" minW="0">
          <Text as="h2" fontSize="18px" fontWeight="semibold" lineHeight="1.4" color="brand.fg">{titulo}</Text>
          {insignias}
        </HStack>
        {acciones && <HStack gap="2" flexWrap="wrap">{acciones}</HStack>}
      </HStack>
      {children}
    </Stack>
  );
}

/**
 * Campo con su pill de origen a la derecha del label. Si la columna es
 * angosta (grilla de tres en pantallas medianas) la pill pasa abajo del
 * control: no tapa el label y los campos de la fila siguen alineados.
 */
function ConOrigen({ origen, children, etiquetaLarga = false }: { origen: ReactNode; children: ReactNode; etiquetaLarga?: boolean }) {
  const apilada = { position: "static", order: 2, marginTop: "6px" };
  return (
    <Box minW="0" css={{ containerType: "inline-size" }}>
    <Stack position="relative" gap="0" minW="0">
      <Box display="flex" position="absolute" top="-2px" right="0" zIndex="1"
        css={etiquetaLarga ? { "@container (max-width: 380px)": apilada } : { "@container (max-width: 290px)": apilada }}>
        {origen}
      </Box>
      {children}
    </Stack>
    </Box>
  );
}
