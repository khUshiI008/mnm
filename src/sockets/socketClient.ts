import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket: Socket | null = null;

/**
 * One shared socket per app session, authenticated the same way the REST
 * API is (JWT). See backend/src/sockets/index.js for what it emits:
 *   - 'attendance:today'          { swipeCount, lastSwipeAt, needsCheckInSelfie }
 *   - 'attendance:selfie-uploaded' { type: 'checkin' | 'break', breakPunchNumber? }
 */
export function connectSocket(token: string): Socket {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
