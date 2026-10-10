import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Meredam log saat backend restart atau tab browser di-refresh
            if (['ECONNREFUSED', 'ECONNABORTED', 'ECONNRESET'].includes(err.code)) {
              return;
            }
            console.error('[vite ws proxy error]:', err.message);
          });
          proxy.on('proxySocket', (proxySocket) => {
            proxySocket.on('error', (err) => {
              if (['ECONNREFUSED', 'ECONNABORTED', 'ECONNRESET'].includes(err.code)) return;
            });
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            socket.on('error', (err) => {
              if (['ECONNREFUSED', 'ECONNABORTED', 'ECONNRESET'].includes(err.code)) return;
            });
          });
        },
      },
    },
  },
});
