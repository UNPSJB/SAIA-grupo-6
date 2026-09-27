import { createContext, useState, type ReactNode, useContext, useEffect } from 'react';

// Molde de los datos que vamos a guardar en memoria
export interface User {
    id: number;
    nombre: string;
    apellido: string;
    dni: string;
    puede_operar: boolean;
    puede_administrar: boolean;
}

interface AuthContextType {
    user: User | null;
    loginUser: (userData: User) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);

    // Al recargar la página, busca si ya había alguien logueado guardado en el navegador
    useEffect(() => {
        const storedUser = localStorage.getItem('saia_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const loginUser = (userData: User) => {
        setUser(userData);
        localStorage.setItem('saia_user', JSON.stringify(userData)); // Guarda la sesión
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('saia_user'); // Borra la sesión al salir
    };

    return (
        <AuthContext.Provider value={{ user, loginUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook para que el Navbar o cualquier pantalla pueda usar fácilmente esta memoria
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth debe usarse dentro de un AuthProvider");
    }
    return context;
};