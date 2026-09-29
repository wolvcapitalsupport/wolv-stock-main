import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace files from the project folder (works on the phone and on Vercel)
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
