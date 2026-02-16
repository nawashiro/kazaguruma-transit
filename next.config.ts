import type { NextConfig } from "next";
import WebpackLicensePlugin from "webpack-license-plugin";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push(
        new WebpackLicensePlugin({
          outputFilename: "../public/licenses/dependencies.json",
        })
      );
    }
    return config;
  },
};

export default nextConfig;
