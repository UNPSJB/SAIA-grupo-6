import { useCallback, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider } from "./common/context/AuthContext";
import { SplashScreen } from "./features/SplashScreen";

/** Marca de que la presentación ya se vio en esta pestaña. */
const CLAVE_INTRO = "saia:intro-vista";

function introVista(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_INTRO) !== null;
  } catch {
    return false;
  }
}

export function App() {
  // Una vez por sesión: el navegador del celular recarga la pestaña seguido, y
  // eran casi cinco segundos de espera cada vez.
  const [mostrarIntro, setMostrarIntro] = useState(() => !introVista());
  const terminarIntro = useCallback(() => {
    try {
      sessionStorage.setItem(CLAVE_INTRO, "1");
    } catch {
      // Sin storage se vuelve a mostrar en la próxima carga.
    }
    setMostrarIntro(false);
  }, []);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
      {mostrarIntro && (
        <SplashScreen onFinish={terminarIntro} />
      )}
    </AuthProvider>
  );
}
