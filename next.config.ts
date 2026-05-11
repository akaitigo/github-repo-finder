import type { NextConfig } from "next";

/**
 * 設計判断:
 * - CSP 最低限設定: 自分由来のスクリプト/コネクトのみ許可、avatar 画像は GitHub から
 * - images.remotePatterns: GitHub avatar の許可（next/image 最適化に必要）
 * - frame-ancestors 'none': クリックジャッキング防止
 * - dev mode のみ `'unsafe-eval'` 許可 (React Hot Reload / SourceMap が eval 使用)
 *   production は eval 不要、`'unsafe-eval'` を含めない
 */
const isDev = process.env.NODE_ENV === "development";

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

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
              scriptSrc,
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
