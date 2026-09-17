/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Validate required environment variables at build time.
  // Server-side only vars (no NEXT_PUBLIC_ prefix) are only checked during SSR/API routes.
  env: {
    // These are validated at runtime in API routes; listed here for documentation.
    // SUPABASE_SECRET_KEY  – service_role key for server-side Supabase operations
    // OPENAI_API_KEY       – OpenAI API key for AI chat and OCR features
    // OPENAI_MODEL         – (optional) model name for AI chat, defaults to gpt-4o-mini
    // OPENAI_OCR_MODEL     – (optional) model name for image OCR, defaults to OPENAI_MODEL
  },

  // Prevent ESLint from failing the build on warnings during development.
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Tree-shake large packages for smaller client bundles.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@fullcalendar/react',
      '@fullcalendar/daygrid',
      '@fullcalendar/timegrid',
      '@fullcalendar/interaction',
    ],
  },

  // Allow images from Supabase storage if used.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
