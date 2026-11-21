import { useState } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider } from "./common/context/AuthContext";
import { SplashScreen } from "./features/SplashScreen";

export function App() {
  const [mostrarIntro, setMostrarIntro] = useState(true);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
      {mostrarIntro && (
        <SplashScreen onFinish={() => setMostrarIntro(false)} />
      )}
    </AuthProvider>
  );
}
