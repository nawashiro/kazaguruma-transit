export interface LocationImage {
  uri: string;
  creator: string;
  license: string;
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

export function resolveLocationImage(location: {
  imageUri?: string;
  imageCreator?: string;
  imageLicense?: string;
}): LocationImage | null {
  const { imageUri, imageCreator, imageLicense } = location;
  if (
    !isAbsoluteHttpUrl(imageUri) ||
    typeof imageCreator !== "string" ||
    imageCreator.trim().length === 0 ||
    !isAbsoluteHttpUrl(imageLicense)
  ) {
    return null;
  }
  return {
    uri: imageUri,
    creator: imageCreator.trim(),
    license: imageLicense,
  };
}
