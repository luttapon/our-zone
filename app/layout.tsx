import type { Metadata } from "next";
import { Mitr } from "next/font/google";
import "./globals.css";
import { Home } from "lucide-react";

const mitr = Mitr({
  subsets:["thai"],
  weight: ["200","300","400","500","600","700"],
});


export const metadata: Metadata = {
  title: "Proximity Link",
  description: "แพลตฟอร์มชุมชนออนไลน์สำหรับการแบ่งปันความรู้และการเชื่อมต่อในชุมชนของคุณ",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${mitr.className} antialiased`}
      >               
        {children}
      </body>
    </html>
  );
}
