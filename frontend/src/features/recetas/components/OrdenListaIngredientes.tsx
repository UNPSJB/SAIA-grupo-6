import { useState } from "react";
import { Badge, Button, HStack, IconButton, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { LuArrowDown, LuArrowUp, LuCheck } from "react-icons/lu";
import { formatoFechaHora } from "../../../common/utils/fechas";
import { useRegistro } from "../../../common/hooks/useRegistro";
import { BannerError, EstadoCargando } from "../../../components/ui/patrones";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import { decidirOrdenEmpate, obtenerComposicion } from "../services/recetaService";
import type { Composicion, ComposicionItem } from "../types/receta";

const AYUDA = { fontSize: "13px", lineHeight: "1.45", color: "fg.muted" } as const;

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

function pesoDe(item: ComposicionItem): string {
  return `${Number(item.gramos).toLocaleString("es-AR", { maximumFractionDigits: 1 })} g`;
}

interface GrupoProps {
  grupo: ComposicionItem[];
  ocupado: boolean;
  onOrdenar: (ids: number[]) => void;
}

/** Un empate: sus ingredientes en orden, con flechas para subirlos y bajarlos. */
function GrupoEmpatado({ grupo, ocupado, onOrdenar }: GrupoProps) {
  const decidido = grupo.find((i) => i.orden_decidido_por !== null);
  const ids = grupo.map((i) => i.ingrediente.id);

  const mover = (desde: number, hacia: number) => {
    const nuevo = [...ids];
    [nuevo[desde], nuevo[hacia]] = [nuevo[hacia], nuevo[desde]];
    onOrdenar(nuevo);
  };

  return (
    <Stack
      data-testid={`empate-${grupo[0].grupo_empate}`}
      gap="3" minW="0" p="4" rounded="lg" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
    >
      <HStack justify="space-between" gap="3" flexWrap="wrap">
        <Text fontSize="sm" fontWeight="medium">{pesoDe(grupo[0])} cada uno</Text>
        <Badge colorPalette={decidido ? "green" : "orange"} rounded="full" px="2">
          {decidido ? "Orden decidido" : "Sin decidir"}
        </Badge>
      </HStack>

      <Stack as="ol" listStyleType="none" m="0" p="0" gap="2">
        {grupo.map((item, indice) => (
          <HStack
            as="li" key={item.ingrediente.id} gap="3" minW="0" ps="3" pe="1.5" py="1.5"
            rounded="md" bg="bg.panel" borderWidth="1px" borderColor="border.subtle"
          >
            <Text as="span" w="4" flexShrink={0} fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
              {indice + 1}.
            </Text>
            <Text as="span" flex="1" minW="0" fontSize="sm" fontWeight="medium">{nombreEnLista(item)}</Text>
            <HStack gap="1" flexShrink={0}>
              <IconButton
                type="button" size="xs" variant="ghost"
                aria-label={`Subir ${item.ingrediente.nombre}`} title="Subir"
                disabled={ocupado || indice === 0}
                onClick={() => mover(indice, indice - 1)}
              >
                <LuArrowUp aria-hidden />
              </IconButton>
              <IconButton
                type="button" size="xs" variant="ghost"
                aria-label={`Bajar ${item.ingrediente.nombre}`} title="Bajar"
                disabled={ocupado || indice === grupo.length - 1}
                onClick={() => mover(indice, indice + 1)}
              >
                <LuArrowDown aria-hidden />
              </IconButton>
            </HStack>
          </HStack>
        ))}
      </Stack>

      {decidido ? (
        <Text {...AYUDA}>
          Decidido por {decidido.orden_decidido_por}
          {decidido.orden_decidido_en ? ` el ${formatoFechaHora(decidido.orden_decidido_en)}` : ""}
        </Text>
      ) : (
        <HStack justify="space-between" columnGap="3" rowGap="2" flexWrap="wrap">
          <Text {...AYUDA}>Por ahora se usa el orden de carga de la receta.</Text>
          <Button type="button" size="xs" variant="outline" borderColor="border.emphasized" disabled={ocupado} onClick={() => onOrdenar(ids)}>
            Dejar este orden
          </Button>
        </HStack>
      )}
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

  const ordenar = async (ids: number[]) => {
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
    <Stack data-testid="orden-lista-ingredientes" gap="4">
      {loading && !composicion && <EstadoCargando>Calculando el orden...</EstadoCargando>}
      {error && <BannerError mb="0">{error}</BannerError>}
      {errorGuardar && <BannerError mb="0">{errorGuardar}</BannerError>}
      {composicion && !composicion.completa && (
        <Stack gap="1.5">
          <Text fontSize="sm" fontWeight="semibold">
            No se puede ordenar la lista todavía
          </Text>
          <Text {...AYUDA}>
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
        <>
          <Stack gap="1">
            <Text fontSize="sm" fontWeight="semibold">Ingredientes que pesan lo mismo</Text>
            <Text {...AYUDA}>
              La lista va de mayor a menor peso. Cuando hay empate, elegí cuál se nombra primero.
            </Text>
          </Stack>
          <SimpleGrid columns={{ base: 1, xl: grupos.length > 1 ? 2 : 1 }} gap="4" maxW={grupos.length > 1 ? undefined : { xl: "640px" }}>
            {grupos.map((grupo) => (
              <GrupoEmpatado
                key={grupo[0].grupo_empate}
                grupo={grupo}
                ocupado={guardando}
                onOrdenar={(ids) => { void ordenar(ids); }}
              />
            ))}
          </SimpleGrid>
          {cambiado && (
            <HStack role="status" gap="2" fontSize="sm" color="green.fg">
              <LuCheck aria-hidden />
              Orden actualizado. Guardá el borrador para conservarlo en el rótulo.
            </HStack>
          )}
        </>
      )}
    </Stack>
  );
}
