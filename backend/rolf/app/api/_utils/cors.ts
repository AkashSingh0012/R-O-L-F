import type { CorsHeaders } from "./headers";

const allowedOrigins = new Set([
  "http://localhost:5173",   // Vite dev frontend
  "http://localhost:3000",   // Next dev (if used)
  
]);

export function corsHeaders(origin: string | null): CorsHeaders {
  const allowedOrigin =
    origin && allowedOrigins.has(origin)
      ? origin
      : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}