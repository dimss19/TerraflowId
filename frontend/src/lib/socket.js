// Satu koneksi Socket.IO bersama untuk seluruh aplikasi.
// Sebelumnya halaman detail perangkat membuka 3 koneksi terpisah
// (App global, wrapper detail, TestModeTab).
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

/**
 * Daftarkan listener pada socket bersama dan lepaskan semuanya sekaligus.
 * Pakai di useEffect:
 *   const { on, offAll } = listenSocket();
 *   on('sensor:data', handler);
 *   return offAll;
 * Koneksi tidak diputus saat komponen unmount, hanya listener-nya.
 */
export function listenSocket() {
  const s = getSocket();
  const listeners = [];
  return {
    socket: s,
    on(event, handler) {
      s.on(event, handler);
      listeners.push([event, handler]);
    },
    offAll() {
      for (const [event, handler] of listeners) s.off(event, handler);
      listeners.length = 0;
    }
  };
}
