import { useEffect, useState, type MouseEvent } from "react";
import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { LuDatabase, LuX } from "react-icons/lu";
import { FormField, FormInput } from "../../../components/ui/patrones";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { buscarAlimentos } from "../services/nutricionService";
import type { AlimentoReferencia } from "../types/nutricion";

/**
 * Buscador de un alimento de la base de composición (SARA 2 u otra importada).
 * La lista se abre como desplegable al enfocar o escribir, sin empujar el resto
 * del formulario.
 */
export function BuscadorAlimento({
  seleccionado,
  onSeleccionar,
}: {
  seleccionado: AlimentoReferencia | null;
  onSeleccionar: (alimento: AlimentoReferencia | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const buscar = useValorDebounced(texto);
  const [resultados, setResultados] = useState<AlimentoReferencia[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seleccionado) return;
    let vigente = true;
    buscarAlimentos(buscar)
      .then((r) => {
        if (!vigente) return;
        setResultados(r.slice(0, 8));
        setError(null);
      })
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [buscar, seleccionado]);

  if (seleccionado) {
    return (
      <FormField label="Alimento de la base" mb="0">
        <HStack
          gap="3"
          minH="10"
          px="3"
          py="2"
          borderWidth="2px"
          borderColor="brand.300"
          bg="brand.50"
          rounded="lg"
          w="100%"
          justify="space-between"
        >
          <HStack gap="2" minW="0">
            <Box as="span" color="brand.600" display="inline-flex" flexShrink={0}>
              <LuDatabase size={16} aria-hidden />
            </Box>
            <Box minW="0">
              <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>{seleccionado.nombre}</Text>
              <Text fontSize="xs" color="fg.muted" lineClamp={1}>{seleccionado.base}</Text>
            </Box>
          </HStack>
          <Button size="xs" variant="ghost" onClick={() => onSeleccionar(null)} aria-label="Elegir otro alimento">
            <LuX aria-hidden /> Cambiar
          </Button>
        </HStack>
      </FormField>
    );
  }

  return (
    <FormField label="Alimento de la base" mb="0">
      <Box position="relative" w="100%">
        <FormInput
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          // Se cierra después del clic en un resultado.
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Buscar por nombre (ej.: harina)"
          aria-label="Buscar alimento en la base de composición"
          autoComplete="off"
        />
        {error && <Text fontSize="xs" color="red.fg" mt="1">{error}</Text>}
        {abierto && (
          <Box
            position="absolute"
            top="calc(100% + 4px)"
            left="0"
            right="0"
            zIndex="dropdown"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="md"
            boxShadow="lg"
            maxH="260px"
            overflowY="auto"
            py="1"
          >
            {resultados.length === 0 ? (
              <Text fontSize="sm" color="fg.muted" px="3" py="2">
                Sin resultados. Las bases se importan desde Producción → Parámetros nutricionales.
              </Text>
            ) : (
              resultados.map((a) => (
                <Box
                  as="button"
                  key={a.id}
                  display="block"
                  w="100%"
                  textAlign="left"
                  px="3"
                  py="2"
                  _hover={{ bg: "brand.50" }}
                  onMouseDown={(e: MouseEvent) => e.preventDefault()}
                  onClick={(e: MouseEvent) => {
                    e.preventDefault();
                    onSeleccionar(a);
                    setAbierto(false);
                  }}
                >
                  <Text fontSize="sm" fontWeight="medium">{a.nombre}</Text>
                  <Text fontSize="xs" color="fg.muted">{a.base}</Text>
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>
    </FormField>
  );
}
