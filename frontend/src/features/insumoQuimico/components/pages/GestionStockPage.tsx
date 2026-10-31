import { Box, Tabs } from "@chakra-ui/react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../../../../components/ui/patrones";

const TABS = [
  { value: "stock", label: "Stock actual" },
  { value: "movimientos", label: "Movimientos" },
  { value: "lotes", label: "Lotes" },
  { value: "consumos", label: "Consumos" },
];

export function GestionStockPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tabActual = TABS.find((tab) => pathname.endsWith(`/${tab.value}`))?.value ?? "stock";

  return (
    <Box p={{ base: "3", md: "5" }}>
      <PageHeader
        title="Gestión de Stock"
        description="Controlá existencias, movimientos y consumos de productos químicos."
      />

      <Tabs.Root
        value={tabActual}
        onValueChange={(detalle) => navigate(`/gestion-stock/${detalle.value}`)}
        variant="line"
        colorPalette="brand"
      >
        <Tabs.List overflowX="auto" overflowY="hidden" mb="6">
          {TABS.map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value} flexShrink={0}>
              {tab.label}
            </Tabs.Trigger>
          ))}
          <Tabs.Indicator />
        </Tabs.List>
      </Tabs.Root>

      <Outlet />
    </Box>
  );
}
