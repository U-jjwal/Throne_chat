import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// load backend url dynamically from .env or default to local development ip address
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.168.117.221:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// handle 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
