import nextConfig from "../next.config";

describe("next config license plugin wiring", () => {
  it("registers webpack-license-plugin for server build", () => {
    const config = { plugins: [] as unknown[] };
    const webpack = nextConfig.webpack;
    if (!webpack) {
      throw new Error("webpack config hook is not defined");
    }

    const updated = webpack(config, { isServer: true } as never);
    const hasPlugin = (updated.plugins ?? []).some((plugin: unknown) => {
      return (
        !!plugin &&
        (plugin as { constructor?: { name?: string } }).constructor?.name === "WebpackLicensePlugin"
      );
    });

    expect(hasPlugin).toBe(true);
  });
});
