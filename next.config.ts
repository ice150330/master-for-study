import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 为原生模块，需标记为服务端外部包，避免打包报错
  serverExternalPackages: ["better-sqlite3"],
  // 自动化截图不显示开发环境角标，编译与运行时错误仍会正常呈现
  devIndicators: false,
};

export default nextConfig;
