/** @type {import('next').NextConfig} */
module.exports = {
  // Local `npm run dev` only: forward /api/py/* to the review service on :8000.
  // On Vercel, vercel.json routes /api/py/review to the "review" service instead.
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [{ source: "/api/py/:path*", destination: "http://127.0.0.1:8000/api/py/:path*" }]
      : [];
  },
};
