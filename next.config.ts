import type { NextConfig } from "next";
import WebpackLicensePlugin from "webpack-license-plugin";

const nextConfig: NextConfig = {
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
