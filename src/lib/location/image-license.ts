const CREATIVE_COMMONS_PATTERN =
  /creativecommons\.org\/(?:licenses\/([a-z-]+)\/([0-9.]+)|publicdomain\/(zero|mark)\/([0-9.]+))/iu;

export function imageLicenseLabel(uri: string): string {
  const match = CREATIVE_COMMONS_PATTERN.exec(uri);
  if (match === null) {
    return uri;
  }
  if (match[1] !== undefined && match[2] !== undefined) {
    return `CC ${match[1].toUpperCase()} ${match[2]}`;
  }
  return match[3]?.toLowerCase() === "zero" ? "CC0 1.0" : "Public Domain Mark";
}
