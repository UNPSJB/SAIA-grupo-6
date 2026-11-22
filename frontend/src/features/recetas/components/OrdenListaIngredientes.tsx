import { useState } from "react";
import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { useRegistro } from "../../../common/hooks/useRegistro";
import { BannerError, EstadoCargando } from "../../../components/ui/patrones";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import { decidirOrdenEmpate, obtenerComposicion } from "../services/recetaService";
import type { Composicion, ComposicionItem } from "../types/receta";

/** Los grupos de empate llegan numerados (1, 2, 3...); se muestran como A, B, C... */
function letraDeGrupo(grupo: number): string {
  return String.fromCharCode(65 + ((grupo - 1) % 26));
}

function nombreEnLista(item: ComposicionItem): string {
  return item.aditivo ? etiquetaAditivo(item.aditivo) : item.ingrediente.nombre;
}

/** Los grupos de ingredientes que pesan lo mismo, cada uno en el orden actual de la lista. */
function gruposDeEmpate(composicion: Composicion): ComposicionItem[][] {
  const grupos = new Map<number, ComposicionItem[]>();
  for (const item of [...composicion.ingredientes, ...composicion.aditivos]) {
    if (item.grupo_empate === null) continue;
    grupos.set(item.grupo_empate, [...(grupos.get(item.grupo_empate) ?? []), item]);
  }
  return [...grupos.values()];
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

interface GrupoProps {
  grupo: ComposicionItem[];
  ocupado: boolean;
  onMover: (grupo: ComposicionItem[], desde: number, hacia: number) => void;
}

function GrupoEmpatado({ grupo, ocupado, onMover }: GrupoProps) {
  const letra = letraDeGrupo(grupo[0].grupo_empate ?? 1);
  const decidido = grupo.find((i) => i.orden_decidido_por !== null);

  return (
    <Stack gap="1" data-testid={`empate-${letra}`}>
      <Text fontSize="xs" color="fg.subtle">
        Pesan lo mismo, elegí cuál va primero:
      </Text>
      <HStack gap="1" wrap="wrap">
        {grupo.map((item, indice) => (
          <HStack key={item.ingrediente.id} gap="0">
            <Button
              size="2xs"
              variant="ghost"
              aria-label={`Mover ${item.ingrediente.nombre} hacia adelante`}
              disabled={ocupado || indice === 0}
              onClick={() => onMover(grupo, indice, indice - 1)}
            >
              <LuChevronLeft aria-hidden />
            </Button>
            <Badge colorPalette="orange" variant="subtle" fontSize="sm">
              {`${nombreEnLista(item)} · ${letra}`}
            </Badge>
            <Button
              size="2xs"
              variant="ghost"
              aria-label={`Mover ${item.ingrediente.nombre} hacia atrás`}
              disabled={ocupado || indice === grupo.length - 1}
              onClick={() => onMover(grupo, indice, indice + 1)}
            >
              <LuChevronRight aria-hidden />
            </Button>
            {indice < grupo.length - 1 && <Text color="fg.subtle">{";"}</Text>}
          </HStack>
        ))}
      </HStack>
      <Text fontSize="xs" color="fg.subtle">
        {decidido && decidido.orden_decidido_por
          ? `Orden decidido por ${decidido.orden_decidido_por}${
              decidido.orden_decidido_en ? ` el ${fechaCorta(decidido.orden_decidido_en)}` : ""
            }.`
          : "Sin decidir: se usa el orden de carga de la receta."}
      </Text>
    </Stack>
  );
}

interface OrdenListaIngredientesProps {
  versionId: number | null;
  /** Se llama después de guardar una decisión, para que la pantalla actualice su texto. */
  onOrdenCambiado?: () => void | Promise<void>;
}

/**
 * Decisión del orden entre ingredientes que pesan lo mismo, sin repetir la lista.
 *
 * La lista en sí es la cadena del campo de ingredientes. Este componente solo aparece
 * cuando hay algo que decidir (empates) o algo que avisar (composición incompleta).
 * Recibe el id de la versión (sin router ni layout), así se puede colocar en otra
 * pantalla. Cada decisión se guarda con quién la tomó y cuándo.
 */
export function OrdenListaIngredientes({ versionId, onOrdenCambiado }: OrdenListaIngredientesProps) {
  const { registro: composicion, loading, error, recargar } = useRegistro<Composicion>({
    cargar: obtenerComposicion,
    id: versionId,
    etiqueta: "el orden de la lista",
  });
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [cambiado, setCambiado] = useState(false);

  if (versionId === null) return null;

  const mover = async (grupo: ComposicionItem[], desde: number, hacia: number) => {
    const ids = grupo.map((i) => i.ingrediente.id);
    [ids[desde], ids[hacia]] = [ids[hacia], ids[desde]];
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await decidirOrdenEmpate(versionId, ids);
      await recargar();
      await onOrdenCambiado?.();
      setCambiado(true);
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No se pudo guardar el orden");
    } finally {
      setGuardando(false);
    }
  };

  const grupos = composicion && composicion.completa ? gruposDeEmpate(composicion) : [];

  return (
    <Box data-testid="orden-lista-ingredientes" mt="2">
      {loading && !composicion && <EstadoCargando>Calculando el orden...</EstadoCargando>}
      {error && <BannerError mb="0">{error}</BannerError>}
      {errorGuardar && <BannerError mb="0">{errorGuardar}</BannerError>}
      {composicion && !composicion.completa && (
        <Stack gap="1">
          <Text fontSize="sm" fontWeight="semibold">
            No se puede ordenar la lista todavía
          </Text>
          <Text fontSize="xs" color="fg.subtle">
            Faltan datos para calcular la masa de estos ingredientes:
          </Text>
          {composicion.faltantes.map((f) => (
            <Text key={f.ingrediente.id} fontSize="sm">
              {f.ingrediente.nombre}: {f.motivo}
            </Text>
          ))}
        </Stack>
      )}
      {grupos.length > 0 && (
        <Stack gap="3">
          {grupos.map((grupo) => (
            <GrupoEmpatado
              key={grupo[0].grupo_empate}
              grupo={grupo}
              ocupado={guardando}
              onMover={mover}
            />
          ))}
          {cambiado && (
            <Text fontSize="xs" color="fg.subtle">
              Orden actualizado. Guardá el borrador para conservarlo en el rótulo.
            </Text>
          )}
        </Stack>
      )}
    </Box>
  );
}
