import { readFile } from "fs/promises";
import path from "path";
import { ProjectMetadata } from "@/types/license";

function asNonEmptyString(value: unknown, fallback = "不明"): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function normalizeAuthor(author: unknown): string {
  if (typeof author === "string") {
    return asNonEmptyString(author);
  }
  if (author && typeof author === "object") {
    const name = (author as { name?: unknown }).name;
    return asNonEmptyString(name);
  }
  return "不明";
}

function normalizeRepository(repository: unknown): string | undefined {
  if (typeof repository === "string" && repository.trim()) {
    return repository.trim();
  }
  if (repository && typeof repository === "object") {
    const url = (repository as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) {
      return url.trim();
    }
  }
  return undefined;
}

function normalizeFunding(funding: unknown): string[] | undefined {
  const urls = new Set<string>();
  const pushUrl = (url: unknown) => {
    if (typeof url === "string" && url.trim()) {
      urls.add(url.trim());
    }
  };

  if (typeof funding === "string") {
    pushUrl(funding);
  } else if (Array.isArray(funding)) {
    for (const entry of funding) {
      if (typeof entry === "string") {
        pushUrl(entry);
      } else if (entry && typeof entry === "object") {
        pushUrl((entry as { url?: unknown }).url);
      }
    }
  } else if (funding && typeof funding === "object") {
    pushUrl((funding as { url?: unknown }).url);
  }

  return urls.size > 0 ? Array.from(urls) : undefined;
}

export function parseProjectMetadata(raw: unknown): ProjectMetadata {
  const pkg = (raw ?? {}) as Record<string, unknown>;

  return {
    name: asNonEmptyString(pkg.name),
    version: asNonEmptyString(pkg.version),
    license: asNonEmptyString(pkg.license),
    author: normalizeAuthor(pkg.author),
    repository: normalizeRepository(pkg.repository),
    funding: normalizeFunding(pkg.funding),
    homepage:
      typeof pkg.homepage === "string" && pkg.homepage.trim()
        ? pkg.homepage.trim()
        : undefined,
    description:
      typeof pkg.description === "string" && pkg.description.trim()
        ? pkg.description.trim()
        : undefined,
  };
}

export async function loadProjectMetadata(
  packageJsonPath = path.join(process.cwd(), "package.json")
): Promise<ProjectMetadata> {
  const raw = await readFile(packageJsonPath, "utf8");
  return parseProjectMetadata(JSON.parse(raw));
}
