import type { NextConfig } from "next";
import WebpackLicensePlugin from "webpack-license-plugin";
import { resolveAppConfigEnvironment } from "./src/lib/config/app-config-environment";

const appConfigEnvironment = resolveAppConfigEnvironment(process.env);

const nextConfig: NextConfig = {
  env: {
    APP_CONFIG_ENV: appConfigEnvironment,
  },
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "opening_hours"],
  async headers() {
    return [
      {
        source: "/generated/location-images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nlp.netlearning.co.jp",
        pathname: "/api/v1.0/openbadge/v2/Assertion/**/image",
      },
    ],
  },
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
