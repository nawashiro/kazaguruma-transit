import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import { loadDependencyLicenses, parseDependencyLicenses } from "@/lib/license/dependencyLicenses";

describe("parseDependencyLicenses default ingestion", () => {
  it("parses webpack-license-plugin default array output", () => {
    const result = parseDependencyLicenses([
      { name: "react", version: "19.1.0", license: "MIT", repository: "https://github.com/facebook/react" },
      { name: "next", version: "15.3.8", license: "MIT", author: "Vercel" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].packageName).toBe("next");
    expect(result[1].packageName).toBe("react");
  });

  it("sets UNKNOWN when license is missing", () => {
    const result = parseDependencyLicenses([{ name: "pkg", version: "1.0.0" }]);

    expect(result[0].license).toBe("UNKNOWN");
  });

  it("prefers next build output path when multiple candidate files are provided", async () => {
    const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "license-loader-"));
    const firstPath = path.join(tmpRoot, ".next/server/public/licenses/dependencies.json");
    const secondPath = path.join(tmpRoot, "public/licenses/dependencies.json");

    await mkdir(path.dirname(firstPath), { recursive: true });
    await mkdir(path.dirname(secondPath), { recursive: true });
    await writeFile(
      firstPath,
      JSON.stringify([{ name: "from-next", version: "1.0.0", license: "MIT" }]),
      "utf8"
    );
    await writeFile(
      secondPath,
      JSON.stringify([{ name: "from-public", version: "1.0.0", license: "BSD-3-Clause" }]),
      "utf8"
    );

    const result = await loadDependencyLicenses([firstPath, secondPath]);
    expect(result[0].packageName).toBe("from-next");

    await rm(tmpRoot, { recursive: true, force: true });
  });
});
