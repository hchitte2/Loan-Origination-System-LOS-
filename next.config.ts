import type { NextConfig } from "next";

/**
 * Two headers on every response (PLAN.md §5 "Security headers and noindex").
 *
 * `X-Robots-Tag: noindex` rather than a `robots.txt` `Disallow`: a crawler that is not
 * allowed to fetch the page never sees a directive on it, so disallowing is how demo
 * URLs end up indexed from inbound links anyway. Letting it fetch and telling it not to
 * index is the pair that actually keeps this out of search results — and the header
 * covers the API routes and file downloads a `<meta>` tag cannot reach.
 *
 * `frame-ancestors 'none'` is the modern `X-Frame-Options: DENY`, and is sent alone
 * rather than inside a full content policy: a real CSP for this app needs a nonce per
 * request, which belongs in `proxy.ts` and is out of scope for the demo.
 */
const nextConfig: NextConfig = {
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      },
    ]);
  },
};

export default nextConfig;
