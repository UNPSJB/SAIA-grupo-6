import { useCallback, useMemo, useState } from "react";
import { Box, Button, HStack, SimpleGrid, Text, Textarea } from "@chakra-ui/react";
import { useLista } from "../../../common/hooks/useLista";
import { formatoFechaHora } from "../../../common/utils/fechas";
import {
  BannerError,
  BannerExito,
  EstadoCargando,
  FormField,
  FormNativeSelect,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import {
  guardarAlergenosDeIngrediente,
  listarAlergenos,
  obtenerAlergenosDeIngrediente,
} from "../services/alergenoService";
import {
  ETIQUETA_EVALUACION,
  ETIQUETA_GLUTEN,
  ETIQUETA_NIVEL,
  type Alergeno,
  type AlergenosDeIngrediente,
  type EstadoGluten,
  type EvaluacionAlergenos,
  type FormaAlergeno,
  type NivelAlergeno,
} from "../types/alergeno";

/** Lo que se elige por alérgeno: "derivado" es "contiene" a través de un derivado. */
type Seleccion = "" | "contiene" | "derivado" | "puede_contener";

interface Evaluacion {
  evaluacion: EvaluacionAlergenos;
  gluten: EstadoGluten;
  respaldo: string;
  observaciones: string;
}

interface Datos {
  catalogo: Alergeno[];
  asignados: Record<number, { nombre: string; seleccion: Seleccion }>;
  delIngrediente: AlergenosDeIngrediente | null;
}

const SIN_DATOS: Datos = { catalogo: [], asignados: {}, delIngrediente: null };

function seleccionDe(nivel: NivelAlergeno, forma: FormaAlergeno): Seleccion {
  if (nivel === "puede_contener") return "puede_contener";
  return forma === "derivado" ? "derivado" : "contiene";
}

function evaluacionDe(datos: AlergenosDeIngrediente | null): Evaluacion {
  return {
    evaluacion: datos?.evaluacion ?? "sin_evaluar",
    gluten: datos?.gluten ?? "desconocido",
    respaldo: datos?.respaldo ?? "",
    observaciones: datos?.observaciones ?? "",
  };
}

/**
 * Alérgenos de un ingrediente, en su ficha: por cada alérgeno del catálogo, si
 * el ingrediente lo contiene (directo o en un derivado), puede contenerlo
 * (trazas) o no; y cómo está evaluado, con el gluten aparte. Con esto se arma
 * la declaración del rótulo: si la evaluación no está completa, la
 * declaración queda pendiente (no se asume "sin alérgenos").
 */
export function AlergenosDelIngrediente({ ingredienteId }: { ingredienteId: number }) {
  // Lo que el usuario cambió y todavía no guardó, por id de alérgeno.
  const [cambios, setCambios] = useState<Record<number, Seleccion>>({});
  const [evaluacionEditada, setEvaluacionEditada] = useState<Evaluacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const cargar = useCallback(async (): Promise<Datos> => {
    const [catalogo, delIngrediente] = await Promise.all([
      listarAlergenos(),
      obtenerAlergenosDeIngrediente(ingredienteId),
    ]);
    return {
      catalogo,
      asignados: Object.fromEntries(
        delIngrediente.alergenos.map((a) => [
          a.alergeno_id,
          { nombre: a.nombre, seleccion: seleccionDe(a.nivel, a.forma) },
        ])
      ),
      delIngrediente,
    };
  }, [ingredienteId]);
  const { items, loading, error, recargar } = useLista<Datos>({
    cargar,
    dependencias: [ingredienteId],
    valorInicial: SIN_DATOS,
    mensajeError: "No se pudieron cargar los alérgenos.",
  });

  // El catálogo activo más los dados de baja que el ingrediente ya tenía.
  const filas = useMemo(() => {
    const activos = items.catalogo.map((a) => ({ id: a.id, nombre: a.nombre }));
    const extras = Object.entries(items.asignados)
      .filter(([id]) => !items.catalogo.some((a) => a.id === Number(id)))
      .map(([id, a]) => ({ id: Number(id), nombre: `${a.nombre} (dado de baja)` }));
    return [...activos, ...extras];
  }, [items]);

  const valor = (id: number): Seleccion => cambios[id] ?? items.asignados[id]?.seleccion ?? "";
  const evaluacion = evaluacionEditada ?? evaluacionDe(items.delIngrediente);
  const hayCambios = Object.keys(cambios).length > 0 || evaluacionEditada !== null;

  const cambiarEvaluacion = (parcial: Partial<Evaluacion>) => {
    setGuardado(false);
    setEvaluacionEditada({ ...evaluacion, ...parcial });
  };

  const descartar = () => {
    setCambios({});
    setEvaluacionEditada(null);
  };

  const guardar = async () => {
    setGuardando(true);
    setErrorGuardado(null);
    setGuardado(false);
    try {
      const alergenos = filas.flatMap((f) => {
        const seleccion = valor(f.id);
        if (seleccion === "") return [];
        const nivel: NivelAlergeno = seleccion === "puede_contener" ? "puede_contener" : "contiene";
        const forma: FormaAlergeno = seleccion === "derivado" ? "derivado" : "directa";
        return [{ alergeno_id: f.id, nivel, forma }];
      });
      await guardarAlergenosDeIngrediente(ingredienteId, {
        alergenos,
        evaluacion: evaluacion.evaluacion,
        gluten: evaluacion.gluten,
        respaldo: evaluacion.respaldo.trim() || null,
        observaciones: evaluacion.observaciones.trim() || null,
      });
      descartar();
      setGuardado(true);
      await recargar();
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : "No se pudieron guardar los alérgenos.");
    } finally {
      setGuardando(false);
    }
  };

  const actualizado = items.delIngrediente;

  return (
    <TarjetaFormulario mt="6" mb="0">
      <TituloFormulario mb="1">Alérgenos y gluten</TituloFormulario>
      <Text fontSize="sm" color="fg.muted" mb="4">
        "Contiene" si es parte de su formulación (o "derivado", si viene en un derivado como la
        lecitina de soja); "Puede contener" si hay trazas por contacto cruzado. Con esto se arma la
        declaración del rótulo de cada producto que lo usa.
      </Text>

      {error && <BannerError mb="4">{error}</BannerError>}
      {errorGuardado && <BannerError mb="4">{errorGuardado}</BannerError>}
      {guardado && !hayCambios && <BannerExito mb="4">Alérgenos guardados.</BannerExito>}
      {loading && <EstadoCargando>Cargando alérgenos...</EstadoCargando>}

      {!loading && !error && (
        <>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mb="5">
            <FormField
              label="Evaluación de alérgenos"
              mb="0"
              helper="Mientras no esté evaluada, la declaración del rótulo queda pendiente."
            >
              <FormNativeSelect
                value={evaluacion.evaluacion}
                onChange={(e) =>
                  cambiarEvaluacion({ evaluacion: e.target.value as EvaluacionAlergenos })
                }
              >
                {Object.entries(ETIQUETA_EVALUACION).map(([clave, etiqueta]) => (
                  <option key={clave} value={clave}>
                    {etiqueta}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>
            <FormField
              label="Información de gluten"
              mb="0"
              helper="La ausencia declarada no certifica un producto libre de gluten."
            >
              <FormNativeSelect
                value={evaluacion.gluten}
                onChange={(e) => cambiarEvaluacion({ gluten: e.target.value as EstadoGluten })}
              >
                {Object.entries(ETIQUETA_GLUTEN).map(([clave, etiqueta]) => (
                  <option key={clave} value={clave}>
                    {etiqueta}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            {filas.map((f) => (
              <HStack key={f.id} justify="space-between" gap="3">
                <Text fontSize="sm" minW="0">
                  {f.nombre}
                </Text>
                <Box w="190px" flexShrink={0}>
                  <FormNativeSelect
                    value={valor(f.id)}
                    onChange={(e) => {
                      setGuardado(false);
                      setCambios((prev) => ({ ...prev, [f.id]: e.target.value as Seleccion }));
                    }}
                    aria-label={`Alérgeno ${f.nombre}`}
                  >
                    <option value="">No</option>
                    <option value="contiene">{ETIQUETA_NIVEL.contiene}</option>
                    <option value="derivado">Contiene (derivado)</option>
                    <option value="puede_contener">{ETIQUETA_NIVEL.puede_contener}</option>
                  </FormNativeSelect>
                </Box>
              </HStack>
            ))}
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mt="5">
            <FormField label="Respaldo" opcional mb="0" helper="Ficha técnica, declaración del proveedor, análisis.">
              <Textarea
                value={evaluacion.respaldo}
                onChange={(e) => cambiarEvaluacion({ respaldo: e.target.value })}
                maxLength={2000}
                minH="70px"
              />
            </FormField>
            <FormField label="Observaciones" opcional mb="0">
              <Textarea
                value={evaluacion.observaciones}
                onChange={(e) => cambiarEvaluacion({ observaciones: e.target.value })}
                maxLength={2000}
                minH="70px"
              />
            </FormField>
          </SimpleGrid>

          {actualizado?.actualizado_en && (
            <Text fontSize="xs" color="fg.muted" mt="3">
              Actualizado {formatoFechaHora(actualizado.actualizado_en)}
              {actualizado.actualizado_por ? ` por ${actualizado.actualizado_por}` : ""}.
            </Text>
          )}

          <HStack mt="5" gap="3">
            <Button onClick={guardar} loading={guardando} disabled={!hayCambios}>
              Guardar alérgenos
            </Button>
            {hayCambios && (
              <Button variant="ghost" onClick={descartar} disabled={guardando}>
                Descartar cambios
              </Button>
            )}
          </HStack>
        </>
      )}
    </TarjetaFormulario>
  );
}
