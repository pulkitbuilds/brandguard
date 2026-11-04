import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = { title: "BrandGuard AI", description: "Checks content against your brand rules before it is published" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
