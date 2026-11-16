import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import {
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import {
  asociarInsumosProveedor,
  cargarCertificacionProveedor,
} from "../services/proveedorService";
import type { Proveedor } from "../types/proveedor";

type Insumo = { id: number; nombre: string; activo: boolean };

export function ProveedorComplementos({
  proveedor,
  onActualizado,
}: {
  proveedor: Proveedor;
  onActualizado: () => void;
}) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [busquedaInsumos, setBusquedaInsumos] = useState("");
  const [tipo, setTipo] = useState("");
  const [numero, setNumero] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;

    apiFetch(`${API_URL}/insumos`)
      .then((r) => pedir<Insumo[]>(r, "No se pudieron cargar los insumos"))
      .then((data) => {
        if (activo) setInsumos(data.filter((i) => i.activo));
      })
      .catch((e) => {
        if (activo) {
          setError(e instanceof Error ? e.message : "Error al cargar insumos");
        }
      });

    setSeleccionados(proveedor.insumos?.map((i: any) => i.id) ?? []);
    return () => {
      activo = false;
    };
  }, [proveedor.id]);

  const insumosFiltrados = insumos.filter((insumo) =>
    insumo.nombre.toLocaleLowerCase("es").includes(
      busquedaInsumos.trim().toLocaleLowerCase("es")
    )
  );

  const seleccionarResultados = () => {
    const idsVisibles = insumosFiltrados.map((insumo) => insumo.id);
    setSeleccionados((prev) => [...new Set([...prev, ...idsVisibles])]);
  };

  const limpiarSeleccionResultados = () => {
    const idsVisibles = new Set(insumosFiltrados.map((insumo) => insumo.id));
    setSeleccionados((prev) => prev.filter((id) => !idsVisibles.has(id)));
  };

  const guardarAsociaciones = async () => {
    setGuardando(true);
    setError("");
    try {
      await asociarInsumosProveedor(proveedor.id, seleccionados);
      onActualizado();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron guardar las asociaciones"
      );
    } finally {
      setGuardando(false);
    }
  };

  const guardarCertificacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!archivo || !tipo.trim() || !numero.trim() || !vencimiento) {
      setError(
        "Completá tipo, número, vencimiento y adjuntá el certificado PDF."
      );
      return;
    }

    setGuardando(true);
    try {
      await cargarCertificacionProveedor(proveedor.id, {
        tipo,
        numero,
        fecha_vencimiento: vencimiento,
        archivo,
      });
      setTipo("");
      setNumero("");
      setVencimiento("");
      setArchivo(null);
      onActualizado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el certificado");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Stack gap="5" mt="5">
      <TarjetaFormulario mb="0">
        <TituloFormulario>Insumos que provee</TituloFormulario>
        <Text color="fg.muted" fontSize="sm" mb="3">
          Buscá los insumos por nombre y seleccioná aquellos que este proveedor
          está habilitado para suministrar.
        </Text>

        <Stack gap="3" mb="3">
          <Input
            value={busquedaInsumos}
            onChange={(e) => setBusquedaInsumos(e.target.value)}
            placeholder="Buscar insumo por nombre..."
            aria-label="Buscar insumos"
            bg="bg.subtle"
            borderColor="border.subtle"
            color="fg.default"
            _placeholder={{ color: "fg.muted" }}
          />

          <Stack direction={{ base: "column", sm: "row" }} gap="2">
            <Button
              size="sm"
              variant="outline"
              onClick={seleccionarResultados}
              disabled={insumosFiltrados.length === 0}
            >
              Seleccionar todos los resultados
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={limpiarSeleccionResultados}
              disabled={
                insumosFiltrados.length === 0 ||
                !insumosFiltrados.some((i) => seleccionados.includes(i.id))
              }
            >
              Limpiar selección
            </Button>
          </Stack>

          <Text color="fg.muted" fontSize="xs">
            {seleccionados.length} insumo(s) seleccionado(s)
            {busquedaInsumos.trim()
              ? ` · ${insumosFiltrados.length} resultado(s)`
              : ""}
          </Text>
        </Stack>

        <Box
          maxH="240px"
          overflowY="scroll"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md"
          bg="bg.subtle"
          p="3"
          css={{
            scrollbarWidth: "thin",
            scrollbarColor:
              "var(--chakra-colors-border-emphasized) var(--chakra-colors-bg-subtle)",
            "&::-webkit-scrollbar": { width: "10px" },
            "&::-webkit-scrollbar-track": {
              background: "var(--chakra-colors-bg-subtle)",
              borderRadius: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "var(--chakra-colors-border-emphasized)",
              borderRadius: "8px",
              border: "2px solid var(--chakra-colors-bg-subtle)",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "var(--chakra-colors-fg-muted)",
            },
          }}
        >
          <Stack gap="3">
            {insumosFiltrados.length > 0 ? (
              insumosFiltrados.map((i) => (
                <Checkbox.Root
                  key={i.id}
                  checked={seleccionados.includes(i.id)}
                  onCheckedChange={(v) =>
                    setSeleccionados((prev) =>
                      v.checked
                        ? prev.includes(i.id)
                          ? prev
                          : [...prev, i.id]
                        : prev.filter((id) => id !== i.id)
                    )
                  }
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label color="fg.default" fontSize="sm">
                    {i.nombre}
                  </Checkbox.Label>
                </Checkbox.Root>
              ))
            ) : (
              <Text color="fg.muted" fontSize="sm">
                {insumos.length === 0
                  ? "No hay insumos activos para asociar."
                  : "No se encontraron insumos con esa búsqueda."}
              </Text>
            )}
          </Stack>
        </Box>

        <Button mt="4" onClick={guardarAsociaciones} loading={guardando}>
          Guardar asociaciones
        </Button>
      </TarjetaFormulario>

      <TarjetaFormulario mb="0">
        <TituloFormulario>Certificaciones</TituloFormulario>

        <Stack gap="2" mb="5">
          {proveedor.certificaciones?.length ? (
            proveedor.certificaciones.map((c) => (
              <Box
                key={c.id}
                bg="bg.subtle"
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="md"
                px="3"
                py="2"
              >
                <Text color="fg.default" fontSize="sm" fontWeight="medium">
                  {c.tipo} · {c.numero}
                </Text>
                <Text color="fg.muted" fontSize="xs">
                  Vence {c.fecha_vencimiento} · {c.estado}
                </Text>
              </Box>
            ))
          ) : (
            <Text color="fg.muted" fontSize="sm">
              Todavía no hay certificados cargados.
            </Text>
          )}
        </Stack>

        <Box as="form" onSubmit={guardarCertificacion}>
          <Stack gap="3">
            <FormField label="Tipo de certificación" mb="0">
              <FormInput
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Ej: RNE, RNPA, BPM..."
              />
            </FormField>
            <FormField label="Número / código" mb="0">
              <FormInput
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Número o código del certificado"
              />
            </FormField>
            <FormField label="Fecha de vencimiento" mb="0">
              <FormInput
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
              />
            </FormField>
            <FormField label="Archivo del certificado (PDF)" mb="0">
              <FormInput
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </FormField>
            <Button type="submit" alignSelf="flex-start" loading={guardando}>
              Agregar certificación
            </Button>
          </Stack>
        </Box>
      </TarjetaFormulario>

      {error && <Text color="red.fg" fontSize="sm">{error}</Text>}
    </Stack>
  );
}
