import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /results reads eval/results.json from disk at request time (force-dynamic);
  // make sure the file is traced into the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/results": ["./eval/results.json"],
  },
};

export default nextConfig;
