import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 为原生模块，需标记为服务端外部包，避免打包报错
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
