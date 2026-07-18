import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // 어드민 기준 사진 업로드가 Server Action(FormData)을 그대로 쓰는데, 기본 본문
  // 크기 제한이 1MB라 폰카메라 사진(보통 수 MB)이 쉽게 넘어감 — 여유 있게 늘려둔다.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
