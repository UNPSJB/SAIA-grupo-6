import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Heading, Spinner, Text } from "@chakra-ui/react";
import { useAuth } from "../../../common/context/AuthContext";
import { useDocumentosVigentes } from "../hooks/useDocumentosVigentes";
import { urlArchivo } from "../services/documentoService";
import { TIPOS_DOCUMENTO } from "../types/documento";
import type { TipoDocumento } from "../types/documento";
import { etiquetaTipo, fechaCorta } from "../utils/formato";

const TEAL = "#468189";

const estiloCampo = {
  backgroundColor: "#fff",
  padding: "12px",
  borderRadius: "8px",
  border: "2px solid #90BEBB",
  fontSize: "16px",
  outline: "none",
  color: "#333",
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
};

export function ConsultaDocumentosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [buscar, setBuscar] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento | "">("");

  const { documentos, loading, error } = useDocumentosVigentes(buscar, tipo);

  return (
    <Box style={{ padding: "20px" }}>
      <Heading as="h2" size="md" fontWeight="bold" color="black" mb="6px">
        Consultar documentos
      </Heading>
      <Text style={{ color: "#555", marginBottom: "20px" }}>
        Documentos vigentes
      </Text>

      {/* Buscador y filtro: se apilan en pantallas chicas */}
      <Box style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
        <input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por nombre…"
          style={{ ...estiloCampo, flex: "1 1 220px", minWidth: 0 }}
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDocumento | "")}
          style={{ ...estiloCampo, flex: "0 1 220px" }}
        >
          <option value="">Todos los tipos</option>
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Box>

      {loading && documentos.length === 0 && <Spinner />}
      {error && <Text color="red.500">{error}</Text>}

      {!loading && !error && documentos.length === 0 && (
        <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
          <Text color="gray.500">No se encontraron documentos.</Text>
        </Box>
      )}

      {documentos.length > 0 && (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {documentos.map((doc) => {
            const v = doc.version_vigente;
            return (
              <Box
                key={doc.id}
                bg="white"
                style={{
                  borderRadius: "10px",
                  padding: "18px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  borderTop: `5px solid ${TEAL}`,
                }}
              >
                <Text style={{ fontSize: "12px", fontWeight: "bold", color: "#777" }}>
                  {etiquetaTipo(doc.tipo).toUpperCase()}
                </Text>
                <Text style={{ fontSize: "18px", fontWeight: "bold", color: "#222", margin: "4px 0 10px" }}>
                  {doc.nombre}
                </Text>
                <Text style={{ color: "#555", marginBottom: "14px" }}>
                  Versión vigente: <b style={{ color: TEAL }}>v{v.numero_version}</b>
                  <br />
                  Vigente desde {fechaCorta(v.vigente_desde)}
                </Text>

                <Box style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <a
                    href={urlArchivo(v.archivo_url)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      backgroundColor: TEAL,
                      color: "white",
                      padding: "10px 16px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      textDecoration: "none",
                    }}
                  >
                    Abrir documento
                  </a>

                  {/* Acción explícita: solo para quien puede administrar (historia 4) */}
                  {user?.puede_administrar && (
                    <button
                      type="button"
                      onClick={() => navigate(`/documentos/${doc.id}/historial`)}
                      style={{
                        backgroundColor: "#e0e0e0",
                        color: "#333",
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "none",
                        fontWeight: "bold",
                        cursor: "pointer",
                        fontSize: "16px",
                      }}
                    >
                      Ver historial
                    </button>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}