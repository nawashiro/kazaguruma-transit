const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gu;
const SENSITIVE_QUERY_PARAMETER_PATTERN =
  /(authorization|credential|key|password|secret|signature|token)/iu;

/**
 * Redacts credential-like query parameter values from URLs embedded in logs.
 */
export function redactSensitiveUrlQueryParameters(message: string): string {
  return message.replace(URL_PATTERN, (urlText) => {
    try {
      const url = new URL(urlText);

      for (const parameterName of url.searchParams.keys()) {
        if (SENSITIVE_QUERY_PARAMETER_PATTERN.test(parameterName)) {
          url.searchParams.set(parameterName, "REDACTED");
        }
      }

      return url.toString();
    } catch {
      return urlText;
    }
  });
}

/**
 * Converts an unknown import error to loggable text without URL credentials.
 */
export function sanitizeGtfsLogError(error: unknown): string {
  const errorText =
    error instanceof Error ? (error.stack ?? error.message) : String(error);

  return redactSensitiveUrlQueryParameters(errorText);
}
