import { useEffect } from "react";
import { Box, Button, Field, Heading, HStack, Input, Spinner, Table, Text } from "@chakra-ui/react";
import { useConsumoInsumos } from "../../hooks/useConsumoInsumos";
import {
  BLANCO,
  ERROR_FONDO,
  ERROR_TEXTO,
  FONDO_TEAL,
  TEAL,
  TEAL_CLARO,
  TEXTO_PRIMARIO,
  TEXTO_SECUNDARIO,
  estiloInputCompacto,
} from "../../../../common/theme/tokens";

const estiloTarjeta = {
  backgroundColor: BLANCO,
  borderRadius: "10px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  overflow: "hidden" as const,
};

const estiloCelda = {
  color: TEXTO_PRIMARIO,
  fontSize: "14px",
  padding: "10px 16px",
  borderBottom: "1px solid #eee",
  backgroundColor: BLANCO,
};

export function ConsumoInsumosPage() {
  const {
    fechaDesde,
    fechaHasta,
    setFechaDesde,
    setFechaHasta,
    consumo,
    loading,
    error,
    cargar,
  } = useConsumoInsumos();

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      <Heading as="h2" size="md" fontWeight="bold" color="black" mb="20px">
        Consumo de productos de limpieza
      </Heading>

      <HStack gap="20px" mb="20px" flexWrap="wrap">
        <Field.Root>
          <Box as="label" style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "8px", color: TEXTO_SECUNDARIO }}>
            DESDE
          </Box>
          <Input type="date" value={fechaDesde} max={fechaHasta} onChange={(e) => setFechaDesde(e.target.value)} style={estiloInputCompacto} />
        </Field.Root>

        <Field.Root>
          <Box as="label" style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "8px", color: TEXTO_SECUNDARIO }}>
            HASTA
          </Box>
          <Input type="date" value={fechaHasta} min={fechaDesde} onChange={(e) => setFechaHasta(e.target.value)} style={estiloInputCompacto} />
        </Field.Root>

        <Button
          mt="26px"
          bg={TEAL}
          color="white"
          onClick={() => cargar()}
          loading={loading}
          style={{ border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
        >
          Consultar
        </Button>
      </HStack>

      {error && (
        <Box style={{ backgroundColor: ERROR_FONDO, color: ERROR_TEXTO, padding: "12px", borderRadius: "6px", marginBottom: "20px", border: "1px solid #f5c6cb", fontWeight: "bold" }}>
          ⚠️ {error}
        </Box>
      )}

      {loading && (
        <Box style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
          <Spinner color={TEAL} />
        </Box>
      )}

      {!loading && consumo && (
        <>
          <Box style={estiloTarjeta}>
            <Box style={{ padding: "16px", borderBottom: `2px solid ${TEAL_CLARO}` }}>
              <Text style={{ color: TEXTO_SECUNDARIO, fontSize: "14px" }}>
                Total consumido en el período:{" "}
                <strong style={{ color: TEXTO_PRIMARIO, fontSize: "18px" }}>
                  {consumo.total_general}
                </strong>
              </Text>
            </Box>

            {consumo.insumos.length === 0 ? (
              <Box style={{ padding: "30px", textAlign: "center" }}>
                <Text style={{ color: "#777" }}>
                  No hay consumos registrados en el período seleccionado.
                </Text>
              </Box>
            ) : (
              <Table.Root size="sm">
                <Table.Header style={{ backgroundColor: FONDO_TEAL }}>
                  <Table.Row>
                    <Table.ColumnHeader style={{ padding: "10px 16px", fontSize: "13px", color: TEXTO_PRIMARIO }}>
                      Producto
                    </Table.ColumnHeader>
                    <Table.ColumnHeader style={{ padding: "10px 16px", fontSize: "13px", color: TEXTO_PRIMARIO }}>
                      Cantidad acumulada
                    </Table.ColumnHeader>
                    <Table.ColumnHeader style={{ padding: "10px 16px", fontSize: "13px", color: TEXTO_PRIMARIO }}>
                      Registros
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {consumo.insumos.map((insumo) => (
                    <Table.Row key={insumo.insumo_quimico_id}>
                      <Table.Cell style={estiloCelda}>{insumo.nombre}</Table.Cell>
                      <Table.Cell style={estiloCelda}>
                        {insumo.cantidad_total} {insumo.unidad_simbolo ?? ""}
                      </Table.Cell>
                      <Table.Cell style={estiloCelda}>{insumo.cantidad_registros}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Box>

          {consumo.por_fecha.length > 0 && (
            <Box style={{ ...estiloTarjeta, marginTop: "20px" }}>
              <Box style={{ padding: "16px", borderBottom: `2px solid ${TEAL_CLARO}` }}>
                <Text style={{ color: TEXTO_SECUNDARIO, fontSize: "14px", fontWeight: "bold" }}>
                  Consumo por día
                </Text>
              </Box>
              <Box style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {consumo.por_fecha.map((item) => {
                  const maximo = Math.max(
                    ...consumo.por_fecha.map((i) => i.cantidad_total),
                    0.0001
                  );
                  const porcentaje = (item.cantidad_total / maximo) * 100;

                  return (
                    <Box key={item.fecha} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Text style={{ width: "100px", fontSize: "13px", color: TEXTO_SECUNDARIO }}>{item.fecha}</Text>
                      <Box style={{ flex: 1, backgroundColor: "#eee", borderRadius: "4px", height: "16px", overflow: "hidden" }}>
                        <Box
                          style={{
                            width: `${porcentaje}%`,
                            height: "100%",
                            backgroundColor: TEAL,
                          }}
                        />
                      </Box>
                      <Text style={{ width: "70px", textAlign: "right", fontSize: "13px", fontWeight: "bold", color: TEXTO_PRIMARIO }}>
                        {item.cantidad_total}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}