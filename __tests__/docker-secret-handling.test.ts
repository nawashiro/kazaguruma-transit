import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(__dirname, "..");

function readProjectFile(fileName: string): string {
  return readFileSync(join(projectRoot, fileName), "utf8");
}

describe("Docker secret handling", () => {
  it("excludes the transit configuration from image layers", () => {
    const dockerignoreEntries = readProjectFile(".dockerignore")
      .split(/\r?\n/u)
      .map((entry) => entry.trim());

    expect(dockerignoreEntries).toContain("transit-config.json");
  });

  it.each(["Dockerfile.dev", "Dockerfile.prod"])(
    "mounts the transit configuration only for the build step in %s",
    (dockerfile) => {
      const dockerfileContents = readProjectFile(dockerfile);

      expect(dockerfileContents).toContain(
        "RUN --mount=type=secret,id=transit_config,target=/app/transit-config.json,required=true npm run build",
      );
      expect(dockerfileContents).not.toMatch(/^RUN npm run build$/mu);
    },
  );

  it.each(["compose.yml", "compose.prod.yml"])(
    "grants the transit configuration secret at build and runtime in %s",
    (composeFile) => {
      const composeContents = readProjectFile(composeFile);

      expect(composeContents).toMatch(
        /build:[\s\S]*?secrets:\s*\n\s+- transit_config/mu,
      );
      expect(composeContents).toMatch(
        /secrets:\s*\n\s+- source: transit_config\s*\n\s+target: \/app\/transit-config\.json/mu,
      );
      expect(composeContents).toMatch(
        /secrets:\s*\n\s+transit_config:\s*\n\s+file: \.\/transit-config\.json/mu,
      );
    },
  );
});
