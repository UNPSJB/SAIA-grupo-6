import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router'; // o como lo tengas importado
import { AuthProvider } from './common/context/AuthContext'; // Importá el proveedor
// Inter auto-hospedada: no depende de Google Fonts, así que la app funciona
// sin internet (importante en las notebooks de la sala).
import '@fontsource-variable/inter';
import './index.css';
import { Provider } from "./components/ui/provider";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider> {/* Ahora usamos tu Provider personalizado */}
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </Provider>
  </React.StrictMode>
);