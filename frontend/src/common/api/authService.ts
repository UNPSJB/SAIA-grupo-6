import axios from 'axios';
import { setTokens, clearTokens, API_URL } from './apiClient';

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
}) => {
    const response = await axios.post(`${API_URL}/personal`, userData);
    return response.data;
};

export const logout = () => {
    clearTokens();
};