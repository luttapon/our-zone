import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // --- ส่วนตั้งค่ารูปภาพ (Images Configuration) ---
  images: {
    // กำหนด List ของ Hostname ภายนอกที่ Next.js อนุญาตให้ดึงรูปภาพได้
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qszumcgdfsttpizjheph.supabase.co',
        port: '',
        // Path สำหรับรูปโปรไฟล์ (avatars) ที่เป็น Public (เช่น รูปโปรไฟล์ของผู้ใช้)
        pathname: '/storage/v1/object/public/avatars/**', 
      },
      {
        protocol: 'https',
        hostname: 'qszumcgdfsttpizjheph.supabase.co',
        port: '',
        // Path สำหรับรูปภาพของกลุ่ม (groups) ที่เป็น Public (เช่น รูปปกกลุ่ม/Avatar กลุ่ม)
        pathname: '/storage/v1/object/public/groups/**',
      },
      {
        protocol: 'https',
        hostname: 'qszumcgdfsttpizjheph.supabase.co',
        port: '',
        // Path สำหรับสื่อโพสต์ (post_media) ที่เข้าถึงผ่าน Signed URL (เช่น สื่อจากกลุ่มปิด)
        pathname: '/storage/v1/object/sign/post_media/**',
      },
      {
        protocol: 'https',
        hostname: 'qszumcgdfsttpizjheph.supabase.co',
        port: '',
        // Path สำหรับสื่อโพสต์ (post_media) ที่เข้าถึงแบบ Public (เช่น สื่อจากโพสต์สาธารณะ)
        pathname: '/storage/v1/object/public/post_media/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        // Path สำหรับรูปภาพ Placeholder ทั่วไป (เช่น เมื่อรูปจริงโหลดไม่ได้)
        pathname: '/**', 
      },
    ],
  },
};

export default nextConfig;