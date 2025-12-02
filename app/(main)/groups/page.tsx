'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { UsersRound } from 'lucide-react'

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูลกลุ่ม (Interface) ---
// ----------------------------------------------------------------------
interface Group {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  cover_url: string | null
  owner_id: string
}

// ----------------------------------------------------------------------
// --- Component หลัก: GroupsPage (หน้าแสดงกลุ่มทั้งหมด) ---
// ----------------------------------------------------------------------
export default function GroupsPage() {
  // --- State: จัดการข้อมูลและสถานะ ---
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // --- Effect: โหลดข้อมูลกลุ่มทั้งหมดเมื่อเข้าสู่หน้าเว็บ ---
  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true)
      setError('')

      // Query: ดึงข้อมูลจากตาราง 'groups' ทั้งหมด
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('name', { ascending: true }) // เรียงตามชื่อกลุ่ม

      if (error) {
        console.error('Error fetching groups:', error.message)
        setError('เกิดข้อผิดพลาดในการโหลดกลุ่ม')
      } else {
        // อัปเดต State ด้วยข้อมูลที่ดึงมา
        setGroups((data as Group[]) || [])
      }
      setLoading(false)
    }

    fetchGroups()
  }, []) // ทำงานเมื่อ Component Mount ครั้งเดียว

  // URL Placeholder สำหรับกรณีที่ไม่พบรูปภาพ
  const avatarPlaceholder = "https://placehold.co/150x150?text=No+Avatar";
  const coverPlaceholder = "https://placehold.co/600x400/e2e8f0/94a3b8?text=No+Cover";

  // --- Render (JSX) ---
  return (
    // --- Container หลัก ---
    <div className="min-h-screen bg-gray-50 p-10 flex flex-col items-center">
      
      {/* ส่วนหัว (Header) */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-8 shadow-lg mb-8 w-full max-w-6xl">
        <h1 className="text-4xl font-extrabold text-white tracking-tight text-center">
          👥 กลุ่มทั้งหมด
        </h1>
        <p className="text-sky-100 mt-2 text-sm text-center">
          สำรวจและเข้าร่วมกลุ่มที่คุณสนใจ
        </p>
      </div>

      {/* สถานะ Loading และ Error */}
      {loading && <p className="text-center text-gray-500">กำลังโหลด...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {/* Grid แสดงรายการกลุ่ม */}
      <div className="flex flex-wrap justify-center gap-6 w-full max-w-6xl">
        {groups.map((group) => {
          // 1. เตรียม URL รูปภาพ Avatar
          const { data: avatarData } = supabase.storage.from('groups').getPublicUrl(group.avatar_url || 'no-path');
          const avatarUrl = group.avatar_url ? avatarData.publicUrl : avatarPlaceholder;
          
          // 2. เตรียม URL รูปภาพ Cover
          const { data: coverData } = supabase.storage.from('groups').getPublicUrl(group.cover_url || 'no-path');
          const coverUrl = group.cover_url ? coverData.publicUrl : coverPlaceholder;

          return (
            <div
              key={group.id}
              className="w-52 h-60 rounded-2xl shadow-md overflow-hidden cursor-pointer transform hover:scale-105 transition relative bg-gray-200 group/card"
              style={{
                // กำหนด Cover เป็น Background Image
                backgroundImage: `url('${coverUrl}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* Overlay สีดำจางๆ เพื่อให้อ่านตัวหนังสือชัดขึ้น */}
              <div className="absolute inset-0 bg-black/40 group-hover/card:bg-black/50 transition-colors"></div>
              
              {/* เนื้อหา Card (ใช้ relative เพื่อจัดตำแหน่งเหนือ Overlay) */}
              <div className='relative flex flex-col items-center h-full pt-4'>
                {/* รูปโปรไฟล์กลุ่ม (Avatar Bubble) */}
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg aspect-square shrink-0 bg-white">
                  {group.avatar_url ? (
                    // แสดง Avatar ถ้ามี
                    <img 
                      src={avatarUrl} 
                      alt={group.name} 
                      className="w-full h-full object-cover" 
                      // Fallback: หากโหลดรูปไม่สำเร็จ ให้แสดง Placeholder
                      onError={(e) => { e.currentTarget.src = avatarPlaceholder; }}
                    />
                  ) : (
                    // แสดง Placeholder Icon
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <UsersRound className="w-10 h-10 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* ชื่อกลุ่ม */}
                <h2 className="absolute bottom-16 w-full text-center text-white text-xl sm:text-2xl font-extrabold break-words line-clamp-2 p-2 drop-shadow-md">
                  {group.name}
                </h2>

                {/* ปุ่มดูรายละเอียด (Link) */}
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

      {/* ข้อความแจ้งเตือนเมื่อไม่มีกลุ่ม */}
      {!loading && groups.length === 0 && (
        <p className="text-center text-gray-400 mt-10 text-lg">
          ยังไม่มีกลุ่มในระบบ
        </p>
      )}
    </div>
  )
}