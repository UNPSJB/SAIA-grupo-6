import { createContext } from 'react';

export interface User {
    id: number;
    nombre: string;
    apellido: string;
    dni: string;
    puede_operar: boolean;
    puede_administrar: boolean;
    es_super_admin: boolean;
}

export interface AuthContextType {
    user: User | null;
    loginUser: (userData: User) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
