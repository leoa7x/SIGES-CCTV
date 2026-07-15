const KNOWN_WEAK_VALUES = new Set([
  "dev_secret_change_me",
  "change_this_to_a_random_256bit_secret_in_production",
  "change_me_for_camera_stream_credentials",
  "change-me",
  "change-me-in-production",
  "changeme",
  "secret",
  "password",
]);

/**
 * Reads a required environment variable, failing fast at boot if it is missing
 * or still set to one of the placeholder values documented in .env.example.
 * Prevents shipping a build that silently falls back to a secret anyone can
 * read from source control.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (KNOWN_WEAK_VALUES.has(value.toLowerCase())) {
    throw new Error(
      `Environment variable ${name} is still set to the placeholder value from .env.example — set a real secret before starting the API.`,
    );
  }
  return value;
}
