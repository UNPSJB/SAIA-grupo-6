import { DeclaracionesSection } from "./DeclaracionesSection";
import { useState, type ChangeEvent } from "react";
import { Box, Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import {
  AccionesFormulario,
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
import { IndicadorCompletitud } from "./IndicadorCompletitud";
import { CampoOrigen } from "./CampoOrigen";
import { ResumenNutricional } from "./ResumenNutricional";
import type { BorradorRotuladoOut } from "../types/rotulado";
import { OrdenListaIngredientes } from "../../recetas/components/OrdenListaIngredientes";
import { previewAutocompletado } from "../services/rotuladoService";

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
  lotes: { id: number; numero_lote: string; version_receta_id: number | null }[];
  isLoading: boolean;
  hayFaltantes: boolean;
  onCancel?: () => void;
  onOrigenChange?: () => void;
}

export function RotuladoForm({
  borrador,
  esCreacion,
  productoNombre,
  onGuardar,
  onAutocompletar,
  lotes,
  isLoading,
  hayFaltantes,
  onCancel,
  onOrigenChange,
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
  const [values, setValues] = useState<Partial<BorradorRotuladoOut>>(valoresIniciales);

  const [loteSeleccionado, setLoteSeleccionado] = useState<number | null>(
    esCreacion ? null : borrador?.lote_producto_id ?? null,
  );

  const { intentado, puedeEnviar } = useIntentoEnvio();

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
  const campos = Object.entries(reglasFaltantes).map(([nombre, [pendiente, etiqueta]]) => ({
    nombre, etiqueta, estado: pendiente ? "pendiente" : "completo",
  }));
  for (const [nombre, etiqueta] of [["importador_razon_social", "Raz\u00f3n social del importador"], ["importador_domicilio", "Domicilio del importador"]] as const) {
    campos.push({ nombre, etiqueta, estado: !values.es_importado ? "no_aplicable" : values[nombre]?.trim() ? "completo" : "pendiente" });
  }
  campos.push({ nombre: "identificacion_lote", etiqueta: "Identificaci\u00f3n del lote", estado: !loteSeleccionado ? "no_aplicable" : values.identificacion_lote?.trim() ? "completo" : "pendiente" });
  for (const [nombre, etiqueta] of [["fecha_produccion", "Fecha de producci\u00f3n"], ["fecha_cierre", "Fecha de cierre"]] as const) {
    campos.push({ nombre, etiqueta, estado: !loteSeleccionado ? "no_aplicable" : values[nombre] ? "completo" : "pendiente" });
  }
  campos.push({ nombre: "instrucciones_uso", etiqueta: "Instrucciones de uso", estado: values.instrucciones_uso?.trim() ? "completo" : "pendiente" });
  campos.push({ nombre: "sellos_advertencia", etiqueta: "Sellos de advertencia", estado: values.sellos_disponibles ? "completo" : "no_aplicable" });
  campos.push({ nombre: "datos_nutricionales_json", etiqueta: "Informaci\u00f3n nutricional", estado: values.datos_nutricionales_json?.trim() ? "completo" : "sin_datos_origen" });

  campos.push({ nombre: "declaraciones", etiqueta: "Declaraciones", estado: declaracionesPendientes ? "pendiente" : "completo" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (declaracionesSucias) { setAvisoDeclaraciones(true); return; }
    if (!puedeEnviar(faltan.lista)) return;
    const versionOrigen = lotes.find(l => l.id === loteSeleccionado)?.version_receta_id ?? borrador?.version_receta_id ?? null;
    await onGuardar({ ...values, version_receta_id: versionOrigen, lote_producto_id: loteSeleccionado, fecha_produccion: values.fecha_produccion || null, fecha_cierre: values.fecha_cierre || null, fecha_duracion: values.fecha_duracion || null });
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

  return (
    <Box as="form" id="rotulado-form" onSubmit={handleSubmit} onChangeCapture={e => { if (!(e.target as HTMLElement).closest("[data-declaraciones]")) setFormularioSucio(true); }} {...SIN_VALIDACION_NATIVA}>
      <TarjetaFormulario>
        <TituloFormulario>Datos del rótulo — {nombreParaMostrar}</TituloFormulario>

        <IndicadorCompletitud
          completitud={{
            estado_global: campos.some(c => c.estado === "pendiente" || c.estado === "sin_datos_origen") ? "pendiente" : "completo",
            campos,
          }}
        />

        {/* Sección 1: Identificación del producto */}
        <Seccion titulo="Identificación del producto">
          <FormField label="Denominación de venta" required mb="4">
            <FormInput
              value={values.denominacion_venta ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, denominacion_venta: e.target.value }))
              }
              placeholder="Ej: Mermelada de frutilla"
              maxW="500px"
            />
            <CampoOrigen origen="producto" />
          </FormField>
        </Seccion>

       {/* Sección 2: Ingredientes */}
        <Seccion titulo="Lista de ingredientes (Capítulo V CAA)">
          <FormField
            label="Ingredientes y aditivos"
            required
            mb="4"
            helper="Se arma sola con la receta. Lo único que se decide a mano es el orden entre insumos que pesan lo mismo."
          >
            <Textarea
              value={values.lista_ingredientes ?? ""}
              readOnly
              placeholder="Se completa sola cuando el producto tiene receta"
              maxW="500px"
              minH="100px"
              bg="bg.subtle"
              cursor="default"
            />
            <CampoOrigen origen="receta" version={borrador?.version_receta_numero} />
          </FormField>
          <Button
            size="xs"
            variant="outline"
            alignSelf="flex-start"
            disabled={isLoading || !borrador}
            onClick={() => {
              void regenerarLista();
            }}
          >
            Volver a armar la lista con la receta
          </Button>
          <OrdenListaIngredientes
            versionId={borrador?.version_receta_id ?? null}
            onOrdenCambiado={regenerarLista}
          />
        </Seccion>

        {/* Sección 3: Contenido neto */}
        <Seccion titulo="Contenido neto">
          <FormField label="Contenido neto" required mb="4">
            <FormInput
              value={values.contenido_neto ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, contenido_neto: e.target.value }))
              }
              placeholder="Ej: 450 g"
              maxW="500px"
            />
          </FormField>
        </Seccion>

        {/* Sección 4: Identificación del origen */}
        <Seccion titulo="Identificación del origen">
          <FormField label="RNPA / RPPA" required mb="4">
            <FormInput
              value={values.rnpa_rppa ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, rnpa_rppa: e.target.value }))
              }
              placeholder="Número declarado por el elaborador"
              maxW="500px"
            />
            <Text fontSize="xs" color="fg.subtle" mt="1">
              Dato declarado por el elaborador, sin verificación contra registros oficiales.
            </Text>
          </FormField>

          <FormField label="Razón social del establecimiento" required mb="4">
            <FormInput
              value={values.razon_social ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, razon_social: e.target.value }))
              }
              placeholder="Nombre del establecimiento elaborador"
              maxW="500px"
            />
          </FormField>

          <FormField label="Domicilio del establecimiento" required mb="4">
            <FormInput
              value={values.domicilio ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, domicilio: e.target.value }))
              }
              placeholder="Dirección del establecimiento"
              maxW="500px"
            />
          </FormField>
        </Seccion>

        {/* Sección 5: Importador (condicional) */}
        {values.es_importado && (
          <Seccion titulo="Datos del importador">
            <FormField label="Razón social del importador" mb="4">
              <FormInput
                value={values.importador_razon_social ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, importador_razon_social: e.target.value }))
                }
                maxW="500px"
              />
            </FormField>
            <FormField label="Domicilio del importador" mb="4">
              <FormInput
                value={values.importador_domicilio ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, importador_domicilio: e.target.value }))
                }
                maxW="500px"
              />
            </FormField>
          </Seccion>
        )}

        <HStack mt="4" align="center">
          <input
            type="checkbox"
            checked={values.es_importado ?? false}
            onChange={handleCambioEsImportado}
          />
          <Text fontSize="sm" color="fg" ml="2">¿Producto importado?</Text>
        </HStack>

        {/* Sección 6: Lote */}
        <Seccion titulo="Identificación del lote (opcional)">
          <FormField label="Lote de producción" mb="4">
            <FormNativeSelect
              value={loteSeleccionado ?? 0}
              onChange={(e) =>
                setLoteSeleccionado(e.target.value ? Number(e.target.value) : null)
              }
              maxW="500px"
            >
              <SelectPlaceholder>Seleccioná un lote (opcional)</SelectPlaceholder>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {lote.numero_lote}
                  {lote.version_receta_id !== null ? ` (v.${lote.version_receta_id})` : ""}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          {loteSeleccionado && (
            <FormField label="Identificación del lote (visible en rótulo)" mb="4">
              <FormInput
                value={values.identificacion_lote ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, identificacion_lote: e.target.value }))
                }
                maxW="500px"
              />
              <CampoOrigen origen="lote" />
            </FormField>
          )}

          <HStack gap="3" mt="2" align="start" flexWrap="wrap">
            <FormField label="Fecha de producción" mb="0">
              <FormInput
                type="date"
                value={values.fecha_produccion ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, fecha_produccion: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Fecha de cierre" mb="0">
              <FormInput
                type="date"
                value={values.fecha_cierre ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, fecha_cierre: e.target.value }))
                }
              />
            </FormField>
          </HStack>
        </Seccion>

        {/* Sección 7: Fecha de duración */}
        <Seccion titulo="Fecha de duración">
          <FormField label="Fecha de duración" required mb="4">
            <FormInput
              type="date"
              value={values.fecha_duracion ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, fecha_duracion: e.target.value }))
              }
            />
          </FormField>
        </Seccion>

        {/* Sección 8: Instrucciones de uso */}
        <Seccion titulo="Preparación e instrucciones de uso">
          <FormField label="Instrucciones de uso (cuando corresponda)" mb="4">
            <Textarea
              value={values.instrucciones_uso ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, instrucciones_uso: e.target.value }))
              }
              placeholder="Instrucciones de uso"
              maxW="500px"
              minH="80px"
            />
          </FormField>
        </Seccion>

        {/* Sección 9: Información nutricional */}
        <Seccion titulo="Información nutricional">
          <CampoOrigen origen="nutricion" />
          <ResumenNutricional
            valor={values.datos_nutricionales_json ?? ""}
            onCambio={(v) => setValues((prev) => ({ ...prev, datos_nutricionales_json: v }))}
          />
        </Seccion>

        {/* Sección 10: Sellos de advertencia */}
        <Seccion titulo="Sellos de advertencia">
          <FormField label="Sellos (E12)" mb="4">
            <Text fontSize="sm" color="fg.muted">
              {borrador?.sellos_disponibles
                ? "Disponibles desde el módulo E12."
                : "No disponibles: el módulo E12 no está implementado aún."}
            </Text>
          </FormField>
        </Seccion>

        <DeclaracionesSection borradorId={esCreacion ? 0 : borrador?.id ?? 0}
          productoId={borrador?.producto_id ?? 0} preview={borrador?.declaraciones}
          formularioSucio={formularioSucio} onEstado={setDeclaracionesPendientes} onDirtyChange={setDeclaracionesSucias} onOrigenChange={onOrigenChange} />
        {declaracionesPendientes && <Text color="orange.fg">Declaraciones pendientes de revisión o confirmación.</Text>}
        {avisoDeclaraciones && declaracionesSucias && <Text role="alert">Guardá o descartá los cambios de declaraciones antes de guardar el formulario.</Text>}
        {(formularioSucio || declaracionesSucias) && !esCreacion && <Text>Guardá los cambios antes de autocompletar.</Text>}
        <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
        <AccionesFormulario>
          <BotonGuardar loading={isLoading} disabled={hayFaltantes}>
            Guardar borrador
          </BotonGuardar>
          {!esCreacion && (
            <Button
              type="button"
              colorPalette="brand"
              size="md"
              mr="3"
              onClick={() => handleAutocompletar(false)}
              disabled={isLoading || formularioSucio || declaracionesSucias}
            >
              Autocompletar
            </Button>
          )}
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}

function Seccion({ children, titulo }: { children: React.ReactNode; titulo: string }) {
  return (
    <Stack as="section" gap="4" mb="6" p={{ base: "4", md: "6" }} borderWidth="1px" borderColor="border.subtle" rounded="xl" bg="bg.panel">
      <Text as="h2" fontSize="lg" fontWeight="semibold" color="brand.fg" pb="3" borderBottomWidth="1px" borderColor="border.subtle">
        {titulo}
      </Text>
      {children}
    </Stack>
  );
}
