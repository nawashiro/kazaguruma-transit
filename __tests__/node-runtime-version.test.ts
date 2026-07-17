import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(__dirname, "..");

describe("Node.js runtime version", () => {
  it("uses the Node.js major version supported by nosskey-sdk", () => {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as { engines?: { node?: string } };
    const nodeVersion = readFileSync(join(projectRoot, ".nvmrc"), "utf8").trim();

    expect(packageJson.engines?.node).toBe("22.x");
    expect(nodeVersion).toBe("22");

    for (const dockerfile of ["Dockerfile.dev", "Dockerfile.prod"]) {
      const dockerfileContents = readFileSync(
        join(projectRoot, dockerfile),
        "utf8",
      );

      expect(dockerfileContents).toMatch(/^FROM node:22-slim$/m);
      expect(dockerfileContents).not.toMatch(/^FROM node:20(?:-|$)/m);
    }
  });
});
