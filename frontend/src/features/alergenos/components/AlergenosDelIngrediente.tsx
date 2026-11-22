import { useCallback, useMemo, useState } from "react";
import { Box, Button, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { useLista } from "../../../common/hooks/useLista";
import {
  BannerError,
  BannerExito,
  EstadoCargando,
  FormNativeSelect,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import {
  guardarAlergenosDeIngrediente,
  listarAlergenos,
  obtenerAlergenosDeIngrediente,
} from "../services/alergenoService";
import { ETIQUETA_NIVEL, type Alergeno, type NivelAlergeno } from "../types/alergeno";

type Seleccion = NivelAlergeno | "";

interface Datos {
  catalogo: Alergeno[];
  asignados: Record<number, { nombre: string; nivel: NivelAlergeno }>;
}

/**
 * Alérgenos de un ingrediente, en su ficha: por cada alérgeno del catálogo,
 * si el ingrediente lo contiene, puede contenerlo (trazas) o no.
 */
export function AlergenosDelIngrediente({ ingredienteId }: { ingredienteId: number }) {
  // Lo que el usuario cambió y todavía no guardó, por id de alérgeno.
  const [cambios, setCambios] = useState<Record<number, Seleccion>>({});
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
        delIngrediente.alergenos.map((a) => [a.alergeno_id, { nombre: a.nombre, nivel: a.nivel }])
      ),
    };
  }, [ingredienteId]);
  const { items, loading, error, recargar } = useLista<Datos>({
    cargar,
    dependencias: [ingredienteId],
    valorInicial: { catalogo: [], asignados: {} },
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

  const valor = (id: number): Seleccion => cambios[id] ?? items.asignados[id]?.nivel ?? "";
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    setGuardando(true);
    setErrorGuardado(null);
    setGuardado(false);
    try {
      const lista = filas
        .map((f) => ({ alergeno_id: f.id, nivel: valor(f.id) }))
        .filter((a): a is { alergeno_id: number; nivel: NivelAlergeno } => a.nivel !== "");
      await guardarAlergenosDeIngrediente(ingredienteId, lista);
      setCambios({});
      setGuardado(true);
      await recargar();
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : "No se pudieron guardar los alérgenos.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <TarjetaFormulario mt="6" mb="0">
      <TituloFormulario mb="1">Alérgenos</TituloFormulario>
      <Text fontSize="sm" color="fg.muted" mb="4">
        "Contiene" si es parte de su formulación; "Puede contener" si hay trazas por contacto cruzado.
        Los alérgenos del producto se calculan desde su receta.
      </Text>

      {error && <BannerError mb="4">{error}</BannerError>}
      {errorGuardado && <BannerError mb="4">{errorGuardado}</BannerError>}
      {guardado && !hayCambios && <BannerExito mb="4">Alérgenos guardados.</BannerExito>}
      {loading && <EstadoCargando>Cargando alérgenos...</EstadoCargando>}

      {!loading && !error && (
        <>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            {filas.map((f) => (
              <HStack key={f.id} justify="space-between" gap="3">
                <Text fontSize="sm" minW="0">{f.nombre}</Text>
                <Box w="170px" flexShrink={0}>
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
                    <option value="puede_contener">{ETIQUETA_NIVEL.puede_contener}</option>
                  </FormNativeSelect>
                </Box>
              </HStack>
            ))}
          </SimpleGrid>
          <HStack mt="5" gap="3">
            <Button onClick={guardar} loading={guardando} disabled={!hayCambios}>
              Guardar alérgenos
            </Button>
            {hayCambios && (
              <Button variant="ghost" onClick={() => setCambios({})} disabled={guardando}>
                Descartar cambios
              </Button>
            )}
          </HStack>
        </>
      )}
    </TarjetaFormulario>
  );
}
