import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Field, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { LuExternalLink, LuHistory } from "react-icons/lu";
import { useAuth } from "../../../common/context/useAuth";
import { usePaginas } from "../../../common/hooks/usePaginas";
import {
  BannerError,
  EstadoCargando,
  EstadoVacio,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  PageHeader,
  Paginacion,
  SelectPlaceholder,
  Tarjeta,
} from "../../../components/ui/patrones";
import { useDocumentosVigentes } from "../hooks/useDocumentosVigentes";
import { TIPOS_DOCUMENTO } from "../types/documento";
import type { TipoDocumento } from "../types/documento";
import { etiquetaTipo, fechaCorta } from "../utils/formato";
import { abrirArchivo } from "../services/documentoService";

// 9 tarjetas = 3 filas de 3 en pantallas anchas. Sin tope, la grilla crecía
// hacia abajo con cada documento nuevo.
const PAGE_SIZE = 9;

export function ConsultaDocumentosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [buscar, setBuscar] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento | "">("");

  const [errorApertura, setErrorApertura] = useState<string | null>(null);

  const { documentos, loading, error } = useDocumentosVigentes(buscar, tipo);
  const {
    paginados: documentosPaginados,
    page,
    setPage,
    totalPaginas,
    hayVariasPaginas,
  } = usePaginas(documentos, PAGE_SIZE, `${buscar}|${tipo}`);

  const handleAbrir = (archivoUrl: string) => {
    setErrorApertura(null);
    abrirArchivo(archivoUrl).catch(() =>
      setErrorApertura("No se pudo abrir el documento."),
    );
  };

  return (
    <Box p="5">
      <PageHeader
        title="Consultar documentos"
        description="Documentos vigentes del sistema de calidad, con su versión al día."
      />

      {/* Buscador y filtro: se apilan en pantallas chicas */}
      <Tarjeta p="4" mb="6">
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          <Box flex="1 1 220px" minW={0}>
            <Field.Root>
              <LabelFiltro>Buscar por nombre</LabelFiltro>
              <FormInput
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar por nombre…"
                aria-label="Buscar documentos por nombre"
              />
            </Field.Root>
          </Box>
          <Box flex="0 1 220px">
            <Field.Root>
              <LabelFiltro>Tipo</LabelFiltro>
              <FormNativeSelect
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoDocumento | "")}
                aria-label="Filtrar documentos por tipo"
              >
                <SelectPlaceholder value="">Todos los tipos</SelectPlaceholder>
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </FormNativeSelect>
            </Field.Root>
          </Box>
        </HStack>
      </Tarjeta>

      {loading && documentos.length === 0 && (
        <EstadoCargando>Cargando documentos...</EstadoCargando>
      )}
      {error && <BannerError>{error}</BannerError>}
      {errorApertura && <BannerError>{errorApertura}</BannerError>}

      {!loading && !error && documentos.length === 0 && (
        <EstadoVacio>No se encontraron documentos.</EstadoVacio>
      )}

      {documentos.length > 0 && (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
            {documentosPaginados.map((doc) => {
              const v = doc.version_vigente;
              return (
                <Tarjeta
                  key={doc.id}
                  p="4"
                  borderTopWidth="4px"
                  borderTopColor="brand.500"
                >
                  <Text fontSize="xs" fontWeight="bold" color="fg.muted">
                    {etiquetaTipo(doc.tipo)}
                  </Text>
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color="fg"
                    mt="1"
                    mb="2"
                  >
                    {doc.nombre}
                  </Text>
                  <Text color="fg.muted" fontSize="sm" mb="1">
                    Versión vigente:{" "}
                    <Text as="span" color="brand.fg" fontWeight="bold">
                      v{v.numero_version}
                    </Text>
                  </Text>
                  <Text color="fg.muted" fontSize="sm" mb="4">
                    Vigente desde {fechaCorta(v.vigente_desde)}
                  </Text>

                  <HStack gap="2" flexWrap="wrap">
                    <Button
                      colorPalette="brand"
                      onClick={() => handleAbrir(v.archivo_url)}
                    >
                      <LuExternalLink aria-hidden />
                      Abrir documento
                    </Button>

                    {/* Acción explícita: solo para quien puede administrar (historia 4) */}
                    {user?.puede_administrar && (
                      <Button
                        variant="outline"
                        colorPalette="neutral"
                        onClick={() =>
                          navigate(`/documentos/${doc.id}/historial`)
                        }
                      >
                        <LuHistory aria-hidden />
                        Ver historial
                      </Button>
                    )}
                  </HStack>
                </Tarjeta>
              );
            })}
          </SimpleGrid>

          {hayVariasPaginas && (
            <Paginacion
              count={totalPaginas}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </Box>
  );
}
