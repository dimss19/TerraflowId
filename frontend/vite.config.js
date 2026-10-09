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
            // Meredam log berisik saat backend belum siap atau klien memutus koneksi
            if (['ECONNREFUSED', 'ECONNABORTED', 'ECONNRESET'].includes(err.code)) {
              return;
            }
            console.error('[vite ws proxy error]:', err.message);
          });
        },
      },
    },
  },
});
