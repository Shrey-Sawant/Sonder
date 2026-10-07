import axios from 'axios';

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const getWebSocketUrl = (endpoint: string): string => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    return `${wsUrl}/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

/**
 * Subprotocols for an authenticated WebSocket handshake. The JWT travels in
 * `Sec-WebSocket-Protocol` rather than the query string so it is not captured
 * in access logs or referrers.
 */
export const getWebSocketProtocols = (): string[] => {
    const token = localStorage.getItem('token');
    return token ? ['sonder-auth', token] : [];
};

export default api;
