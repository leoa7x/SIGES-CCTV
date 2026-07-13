type CorsDecision = (error: Error | null, allow?: boolean) => void;

function expandLoopbackAliases(origin: string): string[] {
  const url = new URL(origin);
  const origins = new Set([origin]);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    const alias = new URL(origin);
    alias.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.add(alias.toString().replace(/\/$/, ""));
  }

  return [...origins];
}

export function getAllowedCorsOrigins(configuredOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3001"): string[] {
  const values = configuredOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const allowed = new Set<string>();

  for (const value of values) {
    for (const expanded of expandLoopbackAliases(value)) {
      allowed.add(expanded);
    }
  }

  return [...allowed];
}

export function isAllowedCorsOrigin(origin?: string, configuredOrigin?: string): boolean {
  if (!origin) return true;
  return new Set(getAllowedCorsOrigins(configuredOrigin)).has(origin);
}

export function createCorsOriginResolver(configuredOrigin?: string) {
  return (origin: string | undefined, callback: CorsDecision) => {
    if (isAllowedCorsOrigin(origin, configuredOrigin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin ?? "<empty>"} not allowed by CORS`), false);
  };
}
