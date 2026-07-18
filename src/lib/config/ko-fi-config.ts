const DISABLED_YAML_VALUES = new Set(["", "false", "null", "~", "[]"]);
const KO_FI_USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * GitHub FUNDING.ymlからKo-fiのユーザー名を取り出す。
 */
export function parseKoFiUsername(fundingYaml: string): string | null {
  const koFiLine = fundingYaml
    .split(/\r?\n/)
    .find((line) => /^\s*ko_fi\s*:/.test(line));

  if (!koFiLine) {
    return null;
  }

  const valueMatch = koFiLine.match(
    /^\s*ko_fi\s*:\s*(?:"([^"]*)"|'([^']*)'|([^#]*?))\s*(?:#.*)?$/,
  );
  const username = (
    valueMatch?.[1] ??
    valueMatch?.[2] ??
    valueMatch?.[3] ??
    ""
  ).trim();

  if (
    DISABLED_YAML_VALUES.has(username.toLowerCase()) ||
    !KO_FI_USERNAME_PATTERN.test(username)
  ) {
    return null;
  }

  return username;
}

/**
 * Ko-fiユーザー名から公式ウィジェットの埋め込みURLを作る。
 */
export function buildKoFiWidgetUrl(username: string): string {
  return `https://ko-fi.com/${encodeURIComponent(username)}/?hidefeed=true&widget=true&embed=true&preview=true`;
}

/**
 * Ko-fiユーザー名から支援プランページのURLを作る。
 */
export function buildKoFiTierPageUrl(username: string): string {
  return `https://ko-fi.com/${encodeURIComponent(username)}/tiers`;
}
