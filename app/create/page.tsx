'use client' // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side) เพราะมีการใช้ Hooks (useState)

import { useState } from 'react'
import { useRouter } from 'next/navigation' // เครื่องมือสำหรับเปลี่ยนหน้าเว็บ
import { supabase } from '@/lib/supabase/client' // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { Check, UploadCloud } from 'lucide-react' // ไอคอนสวยๆ จาก Lucide

export default function CreateGroupPage() {
  const router = useRouter() // ตัวช่วยเปลี่ยนหน้า

  // --- 1. ส่วนจัดการข้อมูลฟอร์ม (State) ---
  const [name, setName] = useState('') // เก็บชื่อกลุ่ม
  const [description, setDescription] = useState('') // เก็บคำอธิบายกลุ่ม
  const [allowMembersToPost, setAllowMembersToPost] = useState(true) // เก็บค่าอนุญาตให้สมาชิกโพสต์ (เริ่มต้นเป็นจริง)
  
  // --- 2. ส่วนจัดการรูปภาพ (State) ---
  // เก็บไฟล์รูปโปรไฟล์และรูปปก (สำหรับส่งไปอัปโหลด)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  
  // เก็บ URL รูปตัวอย่าง (สำหรับแสดงบนหน้าจอทันทีที่เลือกไฟล์)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)  

  // --- 3. ส่วนจัดการสถานะการทำงาน (State) ---
  const [loading, setLoading] = useState(false) // กำลังโหลด/บันทึกข้อมูลอยู่ไหม
  const [error, setError] = useState('')        // ข้อความแจ้งเตือนเมื่อเกิดข้อผิดพลาด

  // --- 4. ฟังก์ชันเลือกรูปโปรไฟล์ (Avatar) ---
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ดึงไฟล์แรกที่ถูกเลือก (ถ้าไม่มีให้เป็น null)
    const file = e.target.files?.[0] ?? null
    if (file) {
      setAvatarFile(file) // เก็บไฟล์ไว้เตรียมอัปโหลด
      setAvatarPreview(URL.createObjectURL(file)) // สร้าง URL ชั่วคราวเพื่อแสดงรูปตัวอย่าง
    }
  }

  // --- 5. ฟังก์ชันเลือกรูปปก (Cover) ---
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file) {
      setCoverFile(file) // เก็บไฟล์ไว้เตรียมอัปโหลด
      setCoverPreview(URL.createObjectURL(file)) // สร้าง URL ชั่วคราวเพื่อแสดงรูปตัวอย่าง
    }
  }

  // --- 6. ฟังก์ชันช่วยอัปโหลดไฟล์ไปที่ Supabase ---
  const handleUploadFile = async (file: File, type: 'avatar' | 'cover') => {
    if (!file) return null // ถ้าไม่มีไฟล์ ก็ไม่ต้องทำอะไร

    // เลือกโฟลเดอร์เก็บตามประเภทรูป
    const folder = type === 'avatar' ? 'avatars' : 'covers'
    
    // ตั้งชื่อไฟล์ใหม่เพื่อไม่ให้ซ้ำ: ใช้ เวลาปัจจุบัน.นามสกุลไฟล์เดิม
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    // สั่งอัปโหลดไปยัง Bucket ที่ชื่อว่า 'groups'
    const { error } = await supabase.storage.from('groups').upload(filePath, file)
    
    // ถ้าอัปโหลดไม่สำเร็จ ให้แจ้ง Error
    if (error) {
      console.error(`Error uploading ${type}:`, error.message)
      throw new Error(`อัปโหลดรูป ${type} ไม่สำเร็จ: ${error.message}`)
    }

    // ส่งคืน Path ของไฟล์ที่อัปโหลดสำเร็จ
    return filePath 
  }

  // --- 7. ฟังก์ชันบันทึกข้อมูลเมื่อกดปุ่ม "สร้างกลุ่ม" ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // ป้องกันไม่ให้หน้าเว็บรีเฟรช
    setLoading(true)   // เริ่มสถานะกำลังโหลด
    setError('')       // ล้างข้อความ Error เก่า

    try {
      // ขั้นตอนที่ 1: ตรวจสอบว่าผู้ใช้ล็อกอินอยู่ไหม
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('กรุณาล็อกอินก่อนสร้างกลุ่ม')

      // ขั้นตอนที่ 2: อัปโหลดรูปภาพ (ถ้าผู้ใช้เลือกมา)
      let avatarPath = null
      let coverPath = null

      if (avatarFile) {
        avatarPath = await handleUploadFile(avatarFile, 'avatar')
      }
      if (coverFile) {
        coverPath = await handleUploadFile(coverFile, 'cover')
      }

      // ขั้นตอนที่ 3: บันทึกข้อมูลกลุ่มลงในฐานข้อมูล (Table: groups)
      const { error: insertError } = await supabase
        .from('groups')
        .insert([{
          name,                          // ชื่อกลุ่ม
          description,                   // คำอธิบาย
          avatar_url: avatarPath,        // ที่อยู่รูปโปรไฟล์
          cover_url: coverPath,          // ที่อยู่รูปปก
          owner_id: user.id,             // ID เจ้าของกลุ่ม (ผู้สร้าง)
          allow_members_to_post: allowMembersToPost // การตั้งค่าการโพสต์
        }])

      if (insertError) throw insertError

      // ขั้นตอนที่ 4: ถ้าสำเร็จ ให้ย้ายไปหน้าแสดงรายชื่อกลุ่ม
      router.push('/groups')
      
    } catch (err: unknown) {
      // จัดการ Error ที่เกิดขึ้น
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('เกิดข้อผิดพลาดไม่ทราบสาเหตุ')
      }
    } finally {
      // จบการทำงาน (ไม่ว่าจะสำเร็จหรือล้มเหลว) ให้หยุดสถานะโหลด
      setLoading(false)
    }
  }

  // ฟังก์ชันเมื่อกดปุ่มยกเลิก
  const handleCancel = () => {
    router.push('/myGroups') // กลับไปหน้ากลุ่มของฉัน
  }

  // --- 8. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* ส่วนรูปปก (Cover Image) */}
        <div className="relative w-full h-56 bg-gray-200 cursor-pointer group hover:bg-gray-300 transition">
          <label className="w-full h-full flex items-center justify-center relative">
            {coverPreview ? (
              // ถ้ามีรูปตัวอย่าง ให้แสดงรูป
              <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              // ถ้าไม่มี ให้แสดงไอคอนอัปโหลด
              <div className="flex flex-col items-center text-gray-400">
                <UploadCloud className="w-10 h-10 mb-2" />
                <span>เพิ่มรูปหน้าปก</span>
              </div>
            )}
            {/* เอฟเฟกต์สีดำจางๆ เมื่อเอาเมาส์ชี้ */}
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {/* Input รับไฟล์ที่ซ่อนอยู่ */}
            <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
          </label>
        </div>

        {/* ส่วนรูปโปรไฟล์ (Avatar) - วางซ้อนขึ้นมาด้านบนรูปปก */}
        <div className="relative -mt-12 flex justify-center cursor-pointer">
          <label className="relative group">
            <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-300 flex items-center justify-center hover:bg-gray-400 transition">
                {avatarPreview ? (
                  // ถ้ามีรูปตัวอย่าง
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  // ถ้าไม่มี
                  <span className="text-gray-500 text-xs">รูปโปรไฟล์</span>
                )}
            </div>
            {/* Input รับไฟล์ที่ซ่อนอยู่ */}
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>

        {/* ฟอร์มกรอกข้อมูล */}
        <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-5">
          
          {/* แสดง Error ถ้ามี */}
          {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-center text-sm">{error}</div>}

          {/* ช่องกรอกชื่อกลุ่ม */}
          <input
            type="text"
            placeholder="ชื่อกลุ่ม"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-sky-500 outline-none"
            required
          />

          {/* ช่องกรอกคำอธิบาย */}
          <textarea
            placeholder="คำอธิบายกลุ่ม..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-sky-500 outline-none resize-none"
            rows={4}
          />

          {/* ตัวเลือกอนุญาตให้สมาชิกโพสต์ (Custom Checkbox) */}
          <div 
            className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            onClick={() => setAllowMembersToPost(!allowMembersToPost)}
          >
            {/* วงกลม Checkbox */}
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${allowMembersToPost ? 'bg-sky-600 border-sky-600' : 'bg-white border-gray-300'}`}>
              {allowMembersToPost && <Check className="w-4 h-4 text-white" />}
            </div>
            <span className="text-gray-700 select-none">สมาชิกสามารถโพสต์ได้</span>
          </div>

          {/* ปุ่มกดดำเนินการ */}
          <div className="flex gap-4 pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()} // กดไม่ได้ถ้ากำลังโหลด หรือยังไม่ใส่ชื่อ
              className="flex-1 bg-sky-600 text-white py-3 rounded-2xl font-semibold shadow hover:bg-sky-700 disabled:bg-sky-300 transition"
            >
              {loading ? 'กำลังบันทึก...' : 'สร้างกลุ่ม'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-semibold hover:bg-gray-200 transition"
            >
              ยกเลิก
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}