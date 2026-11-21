import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
// Inter auto-hospedada: no depende de Google Fonts, así que la app funciona
// sin internet (importante en las notebooks de la sala).
import '@fontsource-variable/inter';
import './index.css';
import { Provider } from "./components/ui/provider";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>
);