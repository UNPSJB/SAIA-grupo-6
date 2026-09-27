import axios from 'axios';

const API_URL = 'http://localhost:8000/personal';

// Función para enviar las credenciales y recibir el usuario si está todo OK
export const login = async (dni: string, password: string) => {
    const response = await axios.post(`${API_URL}/login`, { dni, password });
    return response.data;
};

// Función para el registro (Sign Up) de un usuario nuevo
export const register = async (userData: any) => {
    const response = await axios.post(`${API_URL}`, userData);
    return response.data;
};