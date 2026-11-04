/** @type {import('next').NextConfig} */
module.exports = {
  // /api/py/* is served by the Python (FastAPI) backend in api/index.py
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/api/py/:path*"
            : "/api/",
      },
    ];
  },
};
