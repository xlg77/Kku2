import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 어떤 저장소 이름으로 올려도 동작하도록 상대 경로 사용
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1000 },
});
