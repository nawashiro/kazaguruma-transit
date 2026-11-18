export interface LocationImageVariant {
  width: number;
  path: string;
}

export interface LocationImageData {
  width: number;
  height: number;
  variants: LocationImageVariant[];
}

export interface LocationImage extends LocationImageData {
  creator: string;
  license: string;
}

export const LOCATION_IMAGE_DIRECTORY = "/generated/location-images";
export const LOCATION_IMAGE_PATH_PATTERN =
  /^\/generated\/location-images\/[0-9a-f]{16}-\d+\.webp$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isLocationImageVariant(
  value: unknown,
): value is LocationImageVariant {
  return (
    isRecord(value) &&
    isPositiveInteger(value.width) &&
    typeof value.path === "string" &&
    LOCATION_IMAGE_PATH_PATTERN.test(value.path)
  );
}

export function isLocationImageData(value: unknown): value is LocationImageData {
  return (
    isRecord(value) &&
    isPositiveInteger(value.width) &&
    isPositiveInteger(value.height) &&
    Array.isArray(value.variants) &&
    value.variants.length > 0 &&
    value.variants.every(isLocationImageVariant)
  );
}

export function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function sortVariants(
  variants: readonly LocationImageVariant[],
): LocationImageVariant[] {
  return [...variants].sort((left, right) => left.width - right.width);
}

export function resolveLocationImage(location: {
  imageUri?: string;
  image?: unknown;
  imageCreator?: string;
  imageLicense?: string;
}): LocationImage | null {
  const { image, imageCreator, imageLicense } = location;
  if (
    !isLocationImageData(image) ||
    typeof imageCreator !== "string" ||
    imageCreator.trim().length === 0 ||
    !isAbsoluteHttpUrl(imageLicense)
  ) {
    return null;
  }
  return {
    creator: imageCreator.trim(),
    license: imageLicense,
    width: image.width,
    height: image.height,
    variants: sortVariants(image.variants),
  };
}

export function toLocationImageSrcSet(image: LocationImageData): string {
  return sortVariants(image.variants)
    .map((variant) => `${variant.path} ${variant.width}w`)
    .join(", ");
}
