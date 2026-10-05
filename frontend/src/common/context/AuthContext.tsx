import { useState, type ReactNode } from 'react';
import { clearTokens, getAccessToken, getRefreshToken, API_URL } from '../api/apiClient';
import { AuthContext, type User } from './auth-context';

// Protected personal screens retain this legacy import path.
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth } from './useAuth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    // Recuperamos la sesión guardada desde el primer render (lazy init),
    // así RequireAuth no redirige al login antes de consultar localStorage.
    const [user, setUser] = useState<User | null>(() => {
        try {
            const storedUser = localStorage.getItem('saia_user');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch {
            // Si el dato quedó corrupto en localStorage, lo limpiamos
            localStorage.removeItem('saia_user');
            return null;
        }
    });

    const loginUser = (userData: User) => {
        setUser(userData);
        localStorage.setItem('saia_user', JSON.stringify(userData)); // Guarda la sesión
    };

    const logout = async () => {
        // Avisamos al backend para que revoque los tokens: con esa llamada el
        // access token deja de servir de inmediato en lugar de esperar a que
        // venza (30 min).
        const refreshToken = getRefreshToken();
        const accessToken = getAccessToken();

        if (refreshToken) {
            try {
                await fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                    },
                    body: JSON.stringify({ refresh_token: refreshToken }),
                });
            } catch {
                // Si el backend no responde, igual limpiamos la sesión local.
            }
        }

        setUser(null);
        localStorage.removeItem('saia_user'); // Borra la sesión al salir
        clearTokens(); // Borra los tokens JWT guardados
    };

    return (
        <AuthContext.Provider value={{ user, loginUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
