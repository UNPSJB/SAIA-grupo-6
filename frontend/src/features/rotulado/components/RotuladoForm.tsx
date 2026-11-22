import { DeclaracionesSection } from "./DeclaracionesSection";
import { useState, type ChangeEvent } from "react";
import { Box, Button, HStack, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
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
  onRecalcularNutricion,
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
      <Stack gap="4">
        <TituloFormulario mb="0">Datos del rótulo — {nombreParaMostrar}</TituloFormulario>

        <IndicadorCompletitud compacto
          completitud={{
            estado_global: campos.some(c => c.estado === "pendiente" || c.estado === "sin_datos_origen") ? "pendiente" : "completo",
            campos,
          }}
        />

        <Seccion titulo="Identificación del producto">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            <FormField id="denominacion_venta" label="Denominación de venta" required mb="0">
              <FormInput
                value={values.denominacion_venta ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, denominacion_venta: e.target.value }))
                }
                placeholder="Ej: Mermelada de frutilla"
              />
              <CampoOrigen origen="producto" />
            </FormField>
            <FormField id="contenido_neto" label="Contenido neto" required mb="0">
              <FormInput
                value={values.contenido_neto ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, contenido_neto: e.target.value }))
                }
                placeholder="Ej: 450 g"
              />
            </FormField>
          </SimpleGrid>
          <FormField id="lista_ingredientes" label="Ingredientes y aditivos" required mb="0">
            <Textarea
              value={values.lista_ingredientes ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, lista_ingredientes: e.target.value }))
              }
              placeholder="Ingredientes y aditivos"
              minH="100px"
            />
            <CampoOrigen origen="receta" version={borrador?.version_receta_numero} />
          </FormField>
        </Seccion>

        <Seccion titulo="Identificación del origen">
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
            <FormField id="rnpa_rppa" label="RNPA / RPPA" required mb="0">
              <FormInput
                value={values.rnpa_rppa ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, rnpa_rppa: e.target.value }))
                }
                placeholder="Número declarado por el elaborador"
              />
              <Text fontSize="xs" color="fg.subtle" mt="1">
                Dato declarado por el elaborador, sin verificación contra registros oficiales.
              </Text>
            </FormField>

            <FormField id="razon_social" label="Razón social del establecimiento" required mb="0">
              <FormInput
                value={values.razon_social ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, razon_social: e.target.value }))
                }
                placeholder="Nombre del establecimiento elaborador"
              />
            </FormField>

            <FormField id="domicilio" label="Domicilio del establecimiento" required mb="0">
              <FormInput
                value={values.domicilio ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, domicilio: e.target.value }))
                }
                placeholder="Dirección del establecimiento"
              />
            </FormField>
          </SimpleGrid>
          <HStack as="label" gap="2" align="center" alignSelf="start" cursor="pointer">
            <input
              type="checkbox"
              checked={values.es_importado ?? false}
              onChange={handleCambioEsImportado}
            />
            <Text fontSize="sm" color="fg">¿Producto importado?</Text>
          </HStack>
          {values.es_importado && (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
              <FormField id="importador_razon_social" label="Razón social del importador" mb="0">
                <FormInput
                  value={values.importador_razon_social ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, importador_razon_social: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="importador_domicilio" label="Domicilio del importador" mb="0">
                <FormInput
                  value={values.importador_domicilio ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, importador_domicilio: e.target.value }))
                  }
                />
              </FormField>
            </SimpleGrid>
          )}
        </Seccion>

        <Seccion titulo="Lote, fechas e instrucciones">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            <FormField label="Lote de producción" mb="0">
              <FormNativeSelect
                value={loteSeleccionado ?? 0}
                onChange={(e) =>
                  setLoteSeleccionado(e.target.value ? Number(e.target.value) : null)
                }
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
              <FormField id="identificacion_lote" label="Identificación del lote (visible en rótulo)" mb="0">
                <FormInput
                  value={values.identificacion_lote ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, identificacion_lote: e.target.value }))
                  }
                />
                <CampoOrigen origen="lote" />
              </FormField>
            )}
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
            <FormField id="fecha_produccion" label="Fecha de producción" mb="0">
              <FormInput
                type="date"
                value={values.fecha_produccion ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, fecha_produccion: e.target.value }))
                }
              />
            </FormField>
            <FormField id="fecha_cierre" label="Fecha de cierre" mb="0">
              <FormInput
                type="date"
                value={values.fecha_cierre ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, fecha_cierre: e.target.value }))
                }
              />
            </FormField>
            <FormField id="fecha_duracion" label="Fecha de duración" required mb="0">
              <FormInput
                type="date"
                value={values.fecha_duracion ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, fecha_duracion: e.target.value }))
                }
              />
            </FormField>
          </SimpleGrid>
          <FormField id="instrucciones_uso" label="Instrucciones de uso (cuando corresponda)" mb="0">
            <Textarea
              value={values.instrucciones_uso ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, instrucciones_uso: e.target.value }))
              }
              placeholder="Instrucciones de uso"
              minH="80px"
            />
          </FormField>
        </Seccion>

        <Seccion titulo="Información nutricional" id="datos_nutricionales_json">
          <CampoOrigen origen="nutricion" />
          {borrador?.version_receta_numero != null && (
            <Text fontSize="sm">Versión de receta del borrador: {borrador.version_receta_numero}</Text>
          )}
          <ResumenNutricional
            valor={values.datos_nutricionales_json ?? ""}
            onCambio={(v) => setValues((prev) => ({ ...prev, datos_nutricionales_json: v }))}
            enlaceOrigen={borrador && !esCreacion && borrador.version_receta_id != null
              ? `/productos/${borrador.producto_id}/informacion-nutricional?version_id=${borrador.version_receta_id}`
              : undefined}
          />
          {onRecalcularNutricion && (
            <Stack align="start">
              <Text fontSize="sm">Esta acción reemplaza la tabla guardada con un cálculo para la versión de receta del borrador.</Text>
              <Button type="button" variant="outline"
                disabled={isLoading || formularioSucio || declaracionesSucias}
                onClick={onRecalcularNutricion}>
                Recalcular y reemplazar tabla nutricional
              </Button>
            </Stack>
          )}
        </Seccion>

        <Box as="section" aria-label="Sellos de advertencia" borderRadius="lg" bg="brand.subtle"
          borderStartWidth="4px" borderStartColor="brand.fg" px="4" py="3">
          <Text as="h2" fontWeight="semibold" color="brand.fg">Sellos de advertencia</Text>
          <Text fontSize="sm">Consultar Octogonos en la previsualizacion del borrador</Text>
        </Box>

        <Box as="section" id="declaraciones" tabIndex={-1} aria-label="Alérgenos, gluten y conservación">
          <DeclaracionesSection borradorId={esCreacion ? 0 : borrador?.id ?? 0}
          productoId={borrador?.producto_id ?? 0} preview={borrador?.declaraciones}
          formularioSucio={formularioSucio} onEstado={setDeclaracionesPendientes} onDirtyChange={setDeclaracionesSucias} onOrigenChange={onOrigenChange} />
        </Box>
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
      </Stack>
    </Box>
  );
}

function Seccion({ children, titulo, id }: { children: React.ReactNode; titulo: string; id?: string }) {
  return (
    <Stack as="section" id={id} tabIndex={id ? -1 : undefined} aria-label={id ? titulo : undefined} gap="3" minW="0" p={{ base: "3", md: "4" }} borderWidth="1px" borderColor="border.subtle" rounded="xl" bg="bg.panel">
      <Text as="h2" fontSize="md" fontWeight="semibold" color="brand.fg" pb="2" borderBottomWidth="1px" borderColor="border.subtle">
        {titulo}
      </Text>
      {children}
    </Stack>
  );
}
