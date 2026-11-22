export type AppConfigEnvironment = "local" | "production";

export interface AppConfigEnvironmentSource {
  APP_CONFIG_ENV?: string;
  NODE_ENV?: string;
}

export function parseAppConfigEnvironment(value: string): AppConfigEnvironment {
  if (value === "local" || value === "production") {
    return value;
  }
  throw new Error(
    `APP_CONFIG_ENVの値が不正です: ${value}（local または production を指定してください）`,
  );
}

export function resolveAppConfigEnvironment(
  source: AppConfigEnvironmentSource,
): AppConfigEnvironment {
  if (typeof source.APP_CONFIG_ENV === "string") {
    return parseAppConfigEnvironment(source.APP_CONFIG_ENV);
  }
  return source.NODE_ENV === "production" ? "production" : "local";
}

export function appConfigFileName(
  environment: AppConfigEnvironment,
): "app-config.local.json" | "app-config.json" {
  return environment === "production"
    ? "app-config.json"
    : "app-config.local.json";
}
