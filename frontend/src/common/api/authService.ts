import axios from 'axios';
import { setTokens, clearTokens, API_URL } from './apiClient';

// Estado de instalación: lo usa la pantalla de registro para saber si el
// sistema todavía no tiene administradores (y entonces se puede crear el
// primer super admin desde el propio registro).
export interface BootstrapStatus {
  hay_personas: boolean;
  hay_administradores: boolean;
  permite_super_admin: boolean;
}

export const getBootstrapStatus = async (): Promise<BootstrapStatus> => {
  const response = await axios.get(`${API_URL}/auth/bootstrap`);
  return response.data;
};

// Login: devuelve { access_token, refresh_token, user } y guarda los tokens
export const login = async (dni: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/login`, { dni, password });
    const data = response.data;
    setTokens(data.access_token, data.refresh_token);
    return data;
};

// Registro: crea el usuario; después conviene llamar a login para obtener tokens
export const register = async (userData: {
    nombre: string;
    apellido: string | null;
    dni: string;
    email: string;
    telefono: string | null;
    password: string;
    puede_operar: boolean;
    puede_administrar: boolean;
    es_super_admin?: boolean;
}) => {
    const response = await axios.post(`${API_URL}/personal`, userData);
    return response.data;
};

export const logout = () => {
    clearTokens();
};