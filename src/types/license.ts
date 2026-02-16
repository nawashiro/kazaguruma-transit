export interface ProjectMetadata {
  name: string;
  version: string;
  license: string;
  author: string;
  repository?: string;
  funding?: string[];
  homepage?: string;
  description?: string;
}

export interface OpenDataLicenseEntry {
  id: string;
  name: string;
  provider?: string;
  licenseName: string;
  licenseUrl?: string;
  sourceUrl?: string;
  description?: string;
}

export interface DependencyLicenseEntry {
  packageName: string;
  version: string;
  license: string;
  author?: string;
  repository?: string;
  homepage?: string;
}

export interface LicensePagePayload {
  software: ProjectMetadata;
  openData: OpenDataLicenseEntry[];
  dependencies: DependencyLicenseEntry[];
  generatedAt: string;
}
