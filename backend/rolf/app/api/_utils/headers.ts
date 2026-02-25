export type CorsHeaders = Record<
  | "Access-Control-Allow-Origin"
  | "Access-Control-Allow-Methods"
  | "Access-Control-Allow-Headers"
  | "Access-Control-Allow-Credentials"
  | "Vary",
  string
>;