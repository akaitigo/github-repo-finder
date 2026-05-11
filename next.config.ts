import type { NextConfig } from "next";

/**
 * 設計判断:
 * - CSP 最低限設定: 自分由来のスクリプト/コネクトのみ許可、avatar 画像は GitHub から
 * - images.remotePatterns: GitHub avatar の許可（next/image 最適化に必要）
 * - frame-ancestors 'none': クリックジャッキング防止
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' https://avatars.githubusercontent.com",
              "connect-src 'self' https://api.github.com",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
