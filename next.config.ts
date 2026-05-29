import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exFAT ボリュームでは macOS が `._` (AppleDouble) ファイルを生成し、
  // Next の画像最適化キャッシュ(.next/cache/images)がそれを拾って壊れる。
  // 元の静的ファイルを直接配信し、最適化を無効化して回避する。
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
