import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const ports = { browser: 4170, react: 4171, vue: 4172, svelte: 4173 } as const;
export default defineConfig(({ mode }) => {
  if (!Object.hasOwn(ports, mode)) throw new Error('Choose browser, react, vue, or svelte mode.');
  const app = mode as keyof typeof ports;
  return {
    root: app,
    plugins: app === 'react' ? [react()] : app === 'vue' ? [vue()] : app === 'svelte' ? [svelte()] : [],
    server: { port: ports[app], strictPort: true, fs: { allow: ['..'] } },
    build: { target: 'es2022', outDir: `../dist/${app}`, emptyOutDir: true },
  };
});
