import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: { "/api/brain": ["./brain/**/*"], "/api/work": ["./data/**/*"], "/api/stream": ["./data/**/*"], "/api/stats": ["./data/**/*"], "/api/system": ["./data/**/*", "./brain/**/*"] },
};
export default config;
