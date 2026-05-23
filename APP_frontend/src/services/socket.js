import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// your computer's local ip address
const SOCKET_URL = 'http://10.168.117.221:3000';

class SocketService {
  constructor() {
    this.socket = null;
  }

  // connect to socket, reuse existing if already connected
  async connect() {
    const token = await AsyncStorage.getItem('token');

    if (!token) {
      console.error('No token found');
      return null;
    }

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    return this.socket;
  }

  // disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export default new SocketService();
