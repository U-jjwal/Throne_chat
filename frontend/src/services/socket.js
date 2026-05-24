import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

export const initSocket = (token) => {
  return io(SOCKET_URL, {
    auth: { token },
    autoConnect: false,
    transports: ["websocket"],
  });
};