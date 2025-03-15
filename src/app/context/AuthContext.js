// context/AuthContext.js
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { googleLogout, useGoogleLogin } from '@react-oauth/google'

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUserProfile = async (token) => {
        try {
            const response = await fetch('https://people.googleapis.com/v1/people/me?personFields=photos,names,emailAddresses', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Ошибка загрузки профиля');
            const profileData = await response.json();
            
            const avatarUrl = profileData.photos?.[0]?.url;
            const displayName = profileData.names?.[0]?.displayName;
            const email = profileData.emailAddresses?.[0]?.value;
            setUserProfile({ avatarUrl, displayName, email });
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            throw error;
        }
    };

    const validateToken = async (token) => {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token);
            if (!response.ok) throw new Error('Токен недействителен');
            return true;
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            return false;
        }
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('google_token');
        if (storedToken) {
            validateToken(storedToken)
                .then(isValid => {
                    if (isValid) {
                        setToken(storedToken);
                        return fetchUserProfile(storedToken);
                    } else {
                        logout();
                        return Promise.reject('Invalid token');
                    }
                })
                .finally(() => setIsLoading(false))
                .catch(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            localStorage.setItem('google_token', tokenResponse.access_token);
            setToken(tokenResponse.access_token);
            setIsLoading(true);
            try {
                await fetchUserProfile(tokenResponse.access_token);
            } catch (error) {
                console.error('Ошибка авторизации:', error);
                logout();
            } finally {
                setIsLoading(false);
            }
        },
        onError: (error) => {
            console.error('Ошибка авторизации:', error);
            setIsLoading(false);
        },
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    });

    const logout = () => {
        localStorage.removeItem('google_token');
        setToken(null);
        setUserProfile(null);
        googleLogout();
    };

    return (
        <AuthContext.Provider value={{ token, login, logout, userProfile, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);