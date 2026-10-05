import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

// Explicit opt-in via npm run eval:ai. Uses Groq, never Firebase or expense writes.
const env = loadEnv('development', process.cwd(), 'GROQ_API_KEY');

export default defineConfig({
  test: {
    environment: 'node',
    env: { GROQ_API_KEY: process.env.GROQ_API_KEY ?? env.GROQ_API_KEY ?? '' },
    include: ['ai-evals/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
