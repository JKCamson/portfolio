import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  envDir: '..',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        project: resolve(__dirname, 'project.html'),
        projects: resolve(__dirname, 'projects.html'),
      },
    },
  },
});
