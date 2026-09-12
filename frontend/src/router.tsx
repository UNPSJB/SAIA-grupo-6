import { createBrowserRouter } from "react-router-dom";
import Navbar from "./common/components/Navbar";
import ListarPersonal from "./features/personal/pages/personal/ListarPersonal";
import AgregarPersonal from "./features/personal/pages/personal/AgregarPersonal";
import ModificarPersonal from "./features/personal/pages/personal/ModificarPersonal";
import DetallePersonal from "./features/personal/pages/personal/DetallePersonal";
import { InsumosPage } from "./features/insumos/components/pages/insumosPage";
import { InsumoCreatePage } from "./features/insumos/components/pages/insumoCreatePage";
import { InsumoEditPage } from "./features/insumos/components/pages/insumoEditPage";

// Layout principal que mantiene el menú a la izquierda
function LayoutPrincipal({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f4f7f6",
      }}
    >
      <Navbar />
      <div style={{ flex: 1, padding: "30px" }}>{children}</div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <LayoutPrincipal>
        <div style={{ textAlign: "center", marginTop: "50px" }}>
          <h1>Panel Principal - SAIA</h1>
          <p>Seleccioná una opción en el menú lateral para comenzar.</p>
        </div>
      </LayoutPrincipal>
    ),
  },
  {
    path: "/personal",
    element: (
      <LayoutPrincipal>
        <ListarPersonal />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/personal/nuevo",
    element: (
      <LayoutPrincipal>
        <AgregarPersonal />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/personal/editar/:id",
    element: (
      <LayoutPrincipal>
        <ModificarPersonal />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/personal/detalle/:id",
    element: (
      <LayoutPrincipal>
        <DetallePersonal />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/insumos",
    element: (
      <LayoutPrincipal>
        <InsumosPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/insumos/nuevo",
    element: (
      <LayoutPrincipal>
        <InsumoCreatePage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/insumos/:id/editar",
    element: (
      <LayoutPrincipal>
        <InsumoEditPage />
      </LayoutPrincipal>
    ),
  },
]);
