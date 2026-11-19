import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: { "/api/brain": ["./brain/**/*"], "/api/work": ["./data/**/*"], "/api/stream": ["./data/**/*"] },
};
export default config;
