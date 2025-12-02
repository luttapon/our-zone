'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { PlusCircle, UsersRound } from 'lucide-react'

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูลกลุ่ม (Interface) ---
// ----------------------------------------------------------------------
interface Group {
  id: string
  name: string
  description: string | null
  avatar_url: string | null // Path ใน Storage
  cover_url: string | null // Path ใน Storage
  owner_id: string
}

// ----------------------------------------------------------------------
// --- Component หลัก: MyGroupsPage (หน้าแสดงกลุ่มที่ฉันเป็นเจ้าของ) ---
// ----------------------------------------------------------------------
export default function MyGroupsPage() {
  // --- State: จัดการข้อมูลและสถานะ ---
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null) // ID ผู้ใช้ปัจจุบัน

  // --- Effect: โหลดข้อมูลเมื่อเข้าสู่หน้าเว็บ ---
  useEffect(() => {
    const fetchUserAndGroups = async () => {
      setLoading(true)
      setError('')
      
      // 1. ตรวจสอบข้อมูลผู้ใช้ปัจจุบัน (Auth)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('คุณยังไม่ได้ล็อกอิน')
        setLoading(false)
        return
      }

      setUserId(user.id)

      // 2. ดึงข้อมูลกลุ่มที่ผู้ใช้นี้เป็นเจ้าของ (owner_id = user.id)
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('owner_id', user.id) // กรองเฉพาะกลุ่มที่ฉันเป็นเจ้าของ
        .order('name', { ascending: true }) // เรียงตามชื่อกลุ่ม

      if (error) {
        console.error('Error fetching my groups:', error.message)
        setError('เกิดข้อผิดพลาดในการโหลดกลุ่มของฉัน')
      } else {
        setGroups((data as Group[]) || [])
      }

      setLoading(false)
    }

    fetchUserAndGroups()
  }, []) // ทำงานเมื่อ Component Mount ครั้งเดียว

  // ตัวแปรสำหรับรูปภาพเริ่มต้น (Placeholder)
  const avatarPlaceholder = '/default-avatar.png'
  const coverPlaceholder = '/default-cover.png'

  // --- Render (JSX) ---
  return (
    // --- Container หลัก ---
    <div className="min-h-screen bg-gray-50 p-10 flex flex-col items-center">
      
      {/* ส่วนหัว (Header) */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-8 shadow-lg mb-8 w-full max-w-6xl">
        <h1 className="text-4xl font-extrabold text-white tracking-tight text-center">
          🏠 กลุ่มของฉัน
        </h1>
        <p className="text-sky-100 mt-2 text-sm text-center">
          จัดการและดูแลกลุ่มที่คุณเป็นเจ้าของ
        </p>
      </div>

      {/* สถานะ Loading และ Error */}
      {loading && <p className="text-center text-gray-500">กำลังโหลด...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {/* Grid แสดงรายการกลุ่ม */}
      <div className="flex flex-wrap justify-center gap-6 w-full max-w-6xl">
        
        {/* ปุ่มสร้างกลุ่มใหม่ (Create Card) */}
        <Link
          href="/create"
          className="w-52 h-60 rounded-2xl shadow-md flex flex-col items-center justify-center border-2 border-dashed border-sky-400 hover:border-sky-600 hover:scale-105 transform transition cursor-pointer bg-white"
        >
          <PlusCircle className="w-12 h-12 text-sky-500" />
          <span className="mt-4 text-lg font-semibold text-sky-700 text-center">
            สร้างกลุ่มใหม่
          </span>
        </Link>

        {/* วนลูปแสดงการ์ดกลุ่ม (Group Cards) */}
        {!loading && groups.map((group) => {
          // 1. เตรียม URL รูปภาพ Avatar (ดึง Public URL จาก Supabase Storage)
          const { data: avatarData } = supabase.storage.from('groups').getPublicUrl(group.avatar_url || 'no-path');
          const avatarUrl = group.avatar_url ? avatarData.publicUrl : avatarPlaceholder;

          // 2. เตรียม URL รูปภาพ Cover (ดึง Public URL จาก Supabase Storage)
          const { data: coverData } = supabase.storage.from('groups').getPublicUrl(group.cover_url || 'no-path');
          const coverUrl = group.cover_url ? coverData.publicUrl : coverPlaceholder;

          return (
            // Card Container (ใช้ div แทน Link เพื่อให้ลิงก์อยู่ภายในอย่างเดียว)
            <div
              key={group.id}
              className="w-52 h-60 rounded-2xl shadow-md overflow-hidden transform hover:scale-105 transition relative group/card"
            >
              {/* Cover Background */}
              <div
                className="absolute inset-0 bg-no-repeat bg-center transition-opacity duration-300 group-hover/card:opacity-80"
                style={{
                  // ใช้ Cover URL สำหรับพื้นหลัง Card
                  backgroundImage: `url(${coverUrl})`,
                  backgroundSize: 'cover',
                }}
              ></div>
              
              {/* Overlay สีดำจางๆ เพื่อให้อ่านตัวหนังสือชัดขึ้น */}
              <div className="absolute inset-0 bg-black/40"></div>
              
              {/* เนื้อหา Card (ต้องใช้ relative/z-index เพื่อให้ซ้อนทับ Overlay) */}
              <div className='relative flex flex-col items-center h-full pt-4'>
                {/* รูปโปรไฟล์กลุ่ม (Avatar) */}
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg">
                  {group.avatar_url ? (
                    // แสดง Avatar ถ้ามี
                    // ใช้องค์ประกอบ <img> ปกติ เนื่องจาก Next/Image ไม่รองรับการกำหนด fill ในองค์ประกอบที่ไม่ใช่ Root
                    // (และใช้เป็น Background Image ใน Card Container แล้ว)
                    <img src={avatarUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    // แสดง Placeholder ถ้าไม่มี Avatar
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <UsersRound className="w-10 h-10 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* ชื่อกลุ่ม */}
                <h2 className="mt-2 text-center text-white text-xl sm:text-2xl font-extrabold break-words line-clamp-2 p-2">
                  {group.name}
                </h2>

                {/* ปุ่มดูรายละเอียด (Link) */}
                <Link
                  href={`/groups/${group.id}`}
                  className="absolute bottom-4 w-40 text-center bg-sky-600 text-white py-2 rounded-xl font-medium hover:bg-sky-700 transition"
                >
                  ดูรายละเอียด
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* ข้อความแจ้งเตือนเมื่อไม่มีกลุ่ม */}
      {!loading && groups.length === 0 && !error && (
        <p className="text-center text-gray-400 mt-10 text-lg">
          คุณยังไม่มีกลุ่มในระบบ
        </p>
      )}
    </div>
  )
}