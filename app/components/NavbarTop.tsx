"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { User as UserIcon } from "lucide-react"; // ไอคอนรูปคน

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interface)
// ====================================================================

// โครงสร้างข้อมูลกลุ่ม (สำหรับผลการค้นหา)
interface Group {
  id: string;
  name: string;
}

// ====================================================================
// Component หลัก: แถบนำทางด้านบน (NavbarTop)
// ====================================================================

export const NavbarTop = () => {
  
  // --- 1. การจัดการข้อมูล (State) ---
  const [avatar, setAvatar] = useState<string | null>(null);     // เก็บ URL รูปโปรไฟล์
  const [searchTerm, setSearchTerm] = useState("");              // เก็บคำค้นหาที่พิมพ์
  const [groupResults, setGroupResults] = useState<Group[]>([]); // เก็บรายการกลุ่มที่ค้นเจอ
  
  // ตัวอ้างอิงตำแหน่งกล่องค้นหา (ใช้ตรวจสอบการคลิกพื้นที่อื่นเพื่อปิดผลการค้นหา)
  const searchRef = useRef<HTMLDivElement>(null);

  // --- 2. โหลดรูปโปรไฟล์เมื่อเริ่มใช้งาน (Effect) ---
  useEffect(() => {
    const fetchAvatar = async () => {
      // ดึงข้อมูล User ปัจจุบัน
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      // ค้นหา avatar_url จากฐานข้อมูล
      const { data: profile } = await supabase
        .from("user")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      // ถ้ามีรูป ให้แปลง Path เป็น URL ที่ใช้งานได้จริง
      if (profile?.avatar_url) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(profile.avatar_url);
        setAvatar(data.publicUrl);
      }
    };

    fetchAvatar();
  }, []);

  // --- 3. ปิดผลการค้นหาเมื่อคลิกที่อื่น (Effect) ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // ถ้าคลิกนอกพื้นที่ของกล่องค้นหา (searchRef)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setGroupResults([]); // ปิดผลการค้นหา
      }
    };
    
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler); // ล้าง Event เมื่อเลิกใช้
  }, []);

  // --- 4. ระบบค้นหาแบบ Real-time (Effect) ---
  useEffect(() => {
    const fetchGroups = async () => {
      // ถ้าช่องค้นหาว่างเปล่า ให้เคลียร์ผลลัพธ์
      if (!searchTerm.trim()) {
        setGroupResults([]);
        return;
      }

      // ค้นหาชื่อกลุ่มจาก Supabase (ilike = ไม่สนตัวพิมพ์เล็กใหญ่)
      const { data } = await supabase
        .from("groups")
        .select("id, name")
        .ilike("name", `%${searchTerm}%`)
        .limit(5); // เอาแค่ 5 อันดับแรก

      setGroupResults((data as Group[]) || []);
    };

    // ตั้งเวลาหน่วง 0.3 วินาที (Debounce) เพื่อไม่ให้ยิง Request ถี่เกินไปตอนพิมพ์
    const delay = setTimeout(fetchGroups, 300);
    return () => clearTimeout(delay); // ยกเลิกตัวตั้งเวลาถ้ามีการพิมพ์เพิ่มก่อนครบเวลา

  }, [searchTerm]); // ทำงานทุกครั้งที่ searchTerm เปลี่ยน

  // --- 5. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // Navbar หลัก: ติดด้านบน (fixed)
    <nav className={`
      flex justify-between items-center bg-gray-900 px-4 sm:px-8 py-2 gap-4 
      fixed top-0 left-0 w-full z-50 h-20 shadow-lg
    `}>
      
      {/* ส่วนซ้าย: โลโก้ */}
      <div className="flex-1 flex items-center">
        {/* โลโก้ข้อความ (สำหรับจอใหญ่) */}
        <Link
          href="/dashboard"
          className="sm:flex hidden"
        >
          <span className="text-3xl font-bold text-blue-400 hover:text-white transition-colors">
            Proximity Link
          </span>
        </Link>
        {/* โลโก้ไอคอน (สำหรับมือถือ) */}
        <Link
          href="/dashboard"
          className="sm:hidden flex items-center text-blue-400"
          aria-label="Home"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              d="M3 9.75L12 3l9 6.75V21H3V9.75z"
            />
          </svg>
        </Link>
      </div>

      {/* ส่วนกลาง: เว้นว่างไว้ */}
      <div className="flex-1"></div>

      {/* ส่วนขวา: ค้นหา และ โปรไฟล์ */}
      <div className="flex items-center gap-2 sm:gap-4">
        
        {/* กล่องค้นหา */}
        <div ref={searchRef} className="relative w-40 sm:w-64">
          <input
            type="text"
            placeholder="ค้นหากลุ่ม..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-full bg-white shadow-md text-gray-700 text-sm focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900 outline-none transition-all"
          />
          
          {/* รายการผลลัพธ์การค้นหา (Dropdown) */}
          {groupResults.length > 0 && (
            <ul className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {groupResults.map((g, index) => (
                <li 
                  key={g.id} 
                  className={`hover:bg-blue-50 transition-colors ${index === 0 ? 'rounded-t-lg' : ''} ${index === groupResults.length - 1 ? 'rounded-b-lg' : ''}`}
                >
                  <Link
                    href={`/groups/${g.id}`}
                    className="block px-4 py-2.5 text-gray-700 hover:text-blue-600 text-sm"
                    onClick={() => {
                      setGroupResults([]); // ปิดผลการค้นหาเมื่อเลือก
                      setSearchTerm("");   // ล้างคำค้นหา
                    }}
                  >
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* รูปโปรไฟล์ (ลิงก์ไปหน้า Profile) */}
        <Link href="/profile">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-yellow-400 bg-gray-100 flex items-center justify-center">
            {avatar ? (
              // ถ้ามีรูป ให้แสดงรูป
              <Image
                src={avatar}
                alt="avatar"
                width={40}
                height={40}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              // ถ้าไม่มี ให้แสดงไอคอนคน
              <UserIcon className="w-6 h-6 text-gray-400" />
            )}
          </div>
        </Link>
      </div>
    </nav>
  );
};