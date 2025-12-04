'use client' // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client' // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { UsersRound } from 'lucide-react' // ไอคอนต่างๆ

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interface)
// ====================================================================

// โครงสร้างข้อมูลของ "กลุ่ม" ที่ดึงมาจากฐานข้อมูล
interface Group {
  id: string
  name: string
  description: string | null
  avatar_url: string | null // ที่อยู่ไฟล์รูปโปรไฟล์
  cover_url: string | null  // ที่อยู่ไฟล์รูปปก
  owner_id: string
}

// ====================================================================
// Component หลัก: หน้าแสดงกลุ่มทั้งหมด (GroupsPage)
// ====================================================================

export default function GroupsPage() {
  
  // --- 1. การจัดการข้อมูล (State) ---
  const [groups, setGroups] = useState<Group[]>([]) // เก็บรายการกลุ่มทั้งหมด
  const [loading, setLoading] = useState(true)      // สถานะกำลังโหลด
  const [error, setError] = useState('')            // ข้อความ Error

  // --- 2. โหลดข้อมูลเมื่อเข้าสู่หน้าเว็บ (Effect) ---
  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true) // เริ่มโหลด
      setError('')     // ล้าง Error เก่า

      // ดึงข้อมูลจากตาราง 'groups' ทั้งหมด
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('name', { ascending: true }) // เรียงตามชื่อ ก-ฮ

      if (error) {
        console.error('Error fetching groups:', error.message)
        setError('เกิดข้อผิดพลาดในการโหลดกลุ่ม')
      } else {
        // บันทึกข้อมูลลง State (ถ้าไม่มีข้อมูลให้เป็น Array ว่าง)
        setGroups((data as Group[]) || [])
      }
      setLoading(false) // โหลดเสร็จสิ้น
    }

    fetchGroups()
  }, []) // ทำงานแค่ครั้งเดียวตอนเปิดหน้านี้

  // กำหนดรูปภาพเริ่มต้น (กรณีไม่มีรูป)
  const avatarPlaceholder = "https://placehold.co/150x150?text=No+Avatar";
  const coverPlaceholder = "https://placehold.co/600x400/e2e8f0/94a3b8?text=No+Cover";

  // --- 3. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    <div className="min-h-screen bg-gray-50 p-10 flex flex-col items-center mt-20">
      
      {/* ส่วนหัวข้อหน้าเว็บ */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-8 shadow-lg mb-8 w-full max-w-6xl">
        <h1 className="text-4xl font-extrabold text-white tracking-tight text-center">
          👥 กลุ่มทั้งหมด
        </h1>
        <p className="text-sky-100 mt-2 text-sm text-center">
          สำรวจและเข้าร่วมกลุ่มที่คุณสนใจ
        </p>
      </div>

      {/* แสดงสถานะ Loading หรือ Error */}
      {loading && <p className="text-center text-gray-500">กำลังโหลด...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {/* ตารางแสดงรายการกลุ่ม (Grid Layout) */}
      <div className="flex flex-wrap justify-center gap-6 w-full max-w-6xl">
        {groups.map((group) => {
          
          // แปลง Path รูปโปรไฟล์เป็น URL ที่ใช้งานได้
          const { data: avatarData } = supabase.storage.from('groups').getPublicUrl(group.avatar_url || 'no-path');
          const avatarUrl = group.avatar_url ? avatarData.publicUrl : avatarPlaceholder;
          
          // แปลง Path รูปปกเป็น URL ที่ใช้งานได้
          const { data: coverData } = supabase.storage.from('groups').getPublicUrl(group.cover_url || 'no-path');
          const coverUrl = group.cover_url ? coverData.publicUrl : coverPlaceholder;

          return (
            <div
              key={group.id}
              className="w-52 h-60 rounded-2xl shadow-md overflow-hidden cursor-pointer transform hover:scale-105 transition relative bg-gray-200 group/card"
              style={{
                // ใช้รูปปกเป็นพื้นหลังของการ์ด
                backgroundImage: `url('${coverUrl}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* เลเยอร์สีดำจางๆ ทับพื้นหลังเพื่อให้ตัวหนังสือเด่นขึ้น */}
              <div className="absolute inset-0 bg-black/40 group-hover/card:bg-black/50 transition-colors"></div>
              
              {/* เนื้อหาภายในการ์ด */}
              <div className='relative flex flex-col items-center h-full pt-4'>
                
                {/* รูปโปรไฟล์กลุ่ม (วงกลม) */}
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg aspect-square shrink-0 bg-white">
                  {group.avatar_url ? (
                    <img 
                      src={avatarUrl} 
                      alt={group.name} 
                      className="w-full h-full object-cover" 
                      // ถ้าโหลดรูปไม่สำเร็จ ให้ใช้รูป Placeholder แทน
                      onError={(e) => { e.currentTarget.src = avatarPlaceholder; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <UsersRound className="w-10 h-10 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* ชื่อกลุ่ม */}
                <h2 className="absolute bottom-16 w-full text-center text-white text-xl sm:text-2xl font-extrabold break-words line-clamp-2 p-2 drop-shadow-md">
                  {group.name}
                </h2>

                {/* ปุ่มกดดูรายละเอียด */}
                <Link
                  href={`/groups/${group.id}`}
                  className="absolute bottom-4 w-40 text-center bg-sky-600 text-white py-2 rounded-xl font-medium hover:bg-sky-700 transition shadow-lg"
                >
                  ดูรายละเอียด
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}