import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// NEXT_PUBLIC_API_BASE is inlined by Next automatically; its default lives in
// one place, src/lib/api.ts.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
