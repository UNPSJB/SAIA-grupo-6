import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useAuth } from "../../../common/context/useAuth";
import {
  BannerError,
  Tarjeta,
} from "../../../components/ui/patrones";
import { useDocumentosVigentes } from "../hooks/useDocumentosVigentes";
import { TIPOS_DOCUMENTO } from "../types/documento";
import type { TipoDocumento } from "../types/documento";
import { etiquetaTipo, fechaCorta } from "../utils/formato";
import { abrirArchivo } from "../services/documentoService";

export function ConsultaDocumentosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [buscar, setBuscar] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento | "">("");

  const { documentos, loading, error } = useDocumentosVigentes(buscar, tipo);

  return (
    <Box p="5">
      <Heading as="h2" size="md" fontWeight="bold" color="gray.900" mb="1">
        Consultar documentos
      </Heading>
      <Text color="gray.600" mb="5">
        Documentos vigentes
      </Text>

      {/* Buscador y filtro: se apilan en pantallas chicas */}
      <HStack gap="3" flexWrap="wrap" mb="6" align="flex-end">
        <Box flex="1 1 220px" minW={0}>
          <Input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar documentos por nombre"
          />
        </Box>
        <Box flex="0 1 220px">
          <NativeSelect.Root w="100%">
            <NativeSelect.Field
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoDocumento | "")}
              aria-label="Filtrar documentos por tipo"
              bg="white"
              borderWidth="2px"
              borderColor="brand.300"
              borderRadius="lg"
            >
              <option value="">Todos los tipos</option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>
      </HStack>

      {loading && documentos.length === 0 && <Spinner color="brand.500" />}
      {error && <BannerError>{error}</BannerError>}

      {!loading && !error && documentos.length === 0 && (
        <Tarjeta p={8} textAlign="center">
          <Text color="gray.500">No se encontraron documentos.</Text>
        </Tarjeta>
      )}

      {documentos.length > 0 && (
        <SimpleGrid minChildWidth="260px" gap="4">
          {documentos.map((doc) => {
            const v = doc.version_vigente;
            return (
              <Tarjeta
                key={doc.id}
                p="4.5"
                borderTopWidth="5px"
                borderTopColor="brand.500"
              >
                <Text fontSize="xs" fontWeight="bold" color="gray.500">
                  {etiquetaTipo(doc.tipo).toUpperCase()}
                </Text>
                <Heading as="h3" size="lg" color="gray.900" mt="1" mb="2.5">
                  {doc.nombre}
                </Heading>
                <Text color="gray.600" mb="1.5">
                  Versión vigente:{" "}
                  <Text as="span" color="brand.500" fontWeight="bold">
                    v{v.numero_version}
                  </Text>
                </Text>
                <Text color="gray.600" mb="3.5">
                  Vigente desde {fechaCorta(v.vigente_desde)}
                </Text>

                <HStack gap="2.5" flexWrap="wrap">
                  <Button
                    colorPalette="brand"
                    variant="solid"
                    rounded="lg"
                    fontWeight="bold"
                    px="4"
                    py="2.5"
                    onClick={() =>
                      abrirArchivo(v.archivo_url).catch(() =>
                        alert("No se pudo abrir el documento"),
                      )
                    }
                  >
                    Abrir documento
                  </Button>

                  {/* Acción explícita: solo para quien puede administrar (historia 4) */}
                  {user?.puede_administrar && (
                    <Button
                      variant="plain"
                      bg="gray.200"
                      color="gray.800"
                      rounded="lg"
                      fontWeight="bold"
                      px="4"
                      py="2.5"
                      _hover={{ bg: "gray.300" }}
                      onClick={() => navigate(`/documentos/${doc.id}/historial`)}
                    >
                      Ver historial
                    </Button>
                  )}
                </HStack>
              </Tarjeta>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
}