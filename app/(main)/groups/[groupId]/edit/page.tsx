'use client' // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation' // เครื่องมือสำหรับจัดการ URL และการนำทาง
import { supabase } from '@/lib/supabase/client' // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { Check } from 'lucide-react' // ไอคอนเครื่องหมายถูก

// ====================================================================
// Component หลัก: หน้าแก้ไขข้อมูลกลุ่ม (EditGroupPage)
// ====================================================================

export default function EditGroupPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string // ดึง ID กลุ่มจาก URL

  // --- 1. การจัดการข้อมูล (State) ---
  
  // ข้อมูลฟอร์มพื้นฐาน
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [allowMembersToPost, setAllowMembersToPost] = useState(true) // สิทธิ์การโพสต์ของสมาชิก
  
  // ข้อมูลรูปภาพ (ไฟล์ใหม่ และ URL สำหรับแสดงตัวอย่าง)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  
  // สถานะการทำงาน
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // --- 2. โหลดข้อมูลเดิมมาแสดง (Effect) ---
  useEffect(() => {
    const fetchGroup = async () => {
      if (!groupId) return
      setLoading(true)

      // ดึงข้อมูลกลุ่มจากฐานข้อมูลตาม ID
      const { data, error } = await supabase
        .from('groups')
        .select('*, allow_members_to_post')
        .eq('id', groupId)
        .single()

      if (error) {
        console.error(error)
        setError('ไม่สามารถโหลดข้อมูลกลุ่มได้')
      } else if (data) {
        // นำข้อมูลเดิมมาใส่ใน State เพื่อแสดงในฟอร์ม
        setName(data.name)
        setDescription(data.description || '')
        setAllowMembersToPost(data.allow_members_to_post ?? true)

        // แปลง Path รูปภาพเดิมให้เป็น URL ที่แสดงผลได้
        if (data.avatar_url) setAvatarPreview(supabase.storage.from('groups').getPublicUrl(data.avatar_url).data.publicUrl)
        if (data.cover_url) setCoverPreview(supabase.storage.from('groups').getPublicUrl(data.cover_url).data.publicUrl)
      }

      setLoading(false)
    }

    fetchGroup()
  }, [groupId]) // ทำงานเมื่อ ID กลุ่มเปลี่ยน

  // --- 3. ฟังก์ชันจัดการไฟล์รูปภาพ (Handlers) ---

  // เมื่อเลือกรูปโปรไฟล์ใหม่
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAvatarFile(file)
    // สร้าง URL ชั่วคราวเพื่อแสดงรูปทันที
    setAvatarPreview(file ? URL.createObjectURL(file) : null)
  }

  // เมื่อเลือกรูปปกใหม่
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setCoverFile(file)
    // สร้าง URL ชั่วคราวเพื่อแสดงรูปทันที
    setCoverPreview(file ? URL.createObjectURL(file) : null)
  }

  // ฟังก์ชันกลางสำหรับอัปโหลดไฟล์ไป Storage
  const handleUploadFile = async (file: File, type: 'avatar' | 'cover'): Promise<string | undefined> => {
    if (!file) return undefined
    
    const folder = type === 'avatar' ? 'avatars' : 'covers'
    // ตั้งชื่อไฟล์ให้ไม่ซ้ำกันด้วย Timestamp
    const filePath = `${folder}/${Date.now()}_${file.name}`

    // อัปโหลดไฟล์
    const { error } = await supabase.storage.from('groups').upload(filePath, file)
    if (error) {
      console.error('Upload error:', error.message)
      return undefined
    }

    return filePath // คืนค่า Path ที่อัปโหลดสำเร็จ
  }

  // --- 4. ฟังก์ชันบันทึกข้อมูล (Submit) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // ห้ามรีเฟรชหน้า
    setLoading(true)
    setError('')

    try {
      // ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('กรุณาล็อกอินก่อนแก้ไขกลุ่ม')

      // ดึงข้อมูลกลุ่มปัจจุบันเพื่อดู Path รูปเดิม (สำหรับลบ)
      const { data: currentGroup } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (!currentGroup) throw new Error('ไม่พบข้อมูลกลุ่ม')

      let avatarPath: string | undefined = undefined
      let coverPath: string | undefined = undefined

      // ถ้ามีการเปลี่ยนรูปโปรไฟล์ -> ลบรูปเก่า และอัปโหลดรูปใหม่
      if (avatarFile) {
        if (currentGroup.avatar_url) {
          await supabase.storage.from('groups').remove([currentGroup.avatar_url])
        }
        avatarPath = await handleUploadFile(avatarFile, 'avatar')
      }

      // ถ้ามีการเปลี่ยนรูปปก -> ลบรูปเก่า และอัปโหลดรูปใหม่
      if (coverFile) {
        if (currentGroup.cover_url) {
          await supabase.storage.from('groups').remove([currentGroup.cover_url])
        }
        coverPath = await handleUploadFile(coverFile, 'cover')
      }

      // อัปเดตข้อมูลทั้งหมดลงฐานข้อมูล
      const { error } = await supabase
        .from('groups')
        .update({
          name,
          description,
          allow_members_to_post: allowMembersToPost,
          // อัปเดต Path รูปภาพเฉพาะเมื่อมีการเปลี่ยนแปลง (มีค่า avatarPath/coverPath)
          ...(avatarPath ? { avatar_url: avatarPath } : {}), 
          ...(coverPath ? { cover_url: coverPath } : {})
        })
        .eq('id', groupId)

      if (error) throw error

      // สำเร็จ: กลับไปหน้ากลุ่ม
      router.push(`/groups/${groupId}`)
      
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('เกิดข้อผิดพลาดไม่ทราบสาเหตุ')
    } finally {
      setLoading(false)
    }
  }

  // --- 5. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* ส่วนที่ 1: พื้นที่แก้ไขรูปปก (Cover) */}
        <div className="relative w-full h-56 bg-gray-200 cursor-pointer group">
          <label className="w-full h-full block relative">
            {coverPreview ? (
              // แสดงรูปตัวอย่าง
              <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              // แสดงข้อความเมื่อไม่มีรูป
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg cursor-pointer">
                รูปหน้าปก
              </div>
            )}
            
            {/* เอฟเฟกต์สีดำจางๆ เมื่อเอาเมาส์ชี้ */}
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none"></div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm font-semibold">
                คลิกเพื่อแก้ไขรูป
              </span>
            </div>
            
            {/* Input รับไฟล์ที่ซ่อนอยู่ */}
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
          </label>
        </div>

        {/* ส่วนที่ 2: พื้นที่แก้ไขรูปโปรไฟล์ (Avatar) */}
        <div className="relative -mt-12 flex justify-center cursor-pointer">
          <label className="relative group">
            {avatarPreview ? (
              // แสดงรูปตัวอย่าง
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-28 h-28 rounded-full border-4 border-white object-cover shadow-lg"
              />
            ) : (
              // แสดงข้อความเมื่อไม่มีรูป
              <div className="w-28 h-28 bg-gray-300 rounded-full border-4 border-white flex items-center justify-center shadow-lg text-gray-400 cursor-pointer">
                รูปโปรไฟล์
              </div>
            )}
            
            {/* เอฟเฟกต์สีดำจางๆ เมื่อเอาเมาส์ชี้ */}
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none rounded-full"></div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-full">
              <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs font-semibold">
                แก้ไข
              </span>
            </div>
            
            {/* Input รับไฟล์ที่ซ่อนอยู่ */}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </label>
        </div>

        {/* ส่วนที่ 3: ฟอร์มแก้ไขข้อมูล */}
        <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-5">
          {error && <p className="text-red-500 text-center">{error}</p>}

          {/* ช่องแก้ไขชื่อกลุ่ม */}
          <input
            type="text"
            placeholder="ชื่อกลุ่ม"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-3xl px-5 py-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
            required
            disabled={loading}
          />

          {/* ช่องแก้ไขคำอธิบาย */}
          <textarea
            placeholder="คำอธิบายกลุ่ม"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-3xl px-5 py-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none transition"
            rows={4}
            disabled={loading}
          />
          
          {/* ตัวเลือกกำหนดสิทธิ์การโพสต์ */}
          <div 
            className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl transition hover:bg-gray-50"
            onClick={() => setAllowMembersToPost(prev => !prev)}
          >
            {/* วงกลม Checkbox */}
            <div 
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                allowMembersToPost 
                  ? 'bg-sky-600 border-sky-600' 
                  : 'bg-white border-gray-400'
              }`}
            >
              {allowMembersToPost && <Check className="w-4 h-4 text-white" />}
            </div>
            <label className="text-gray-800 text-sm font-medium cursor-pointer select-none">
              อนุญาตให้สมาชิกกลุ่มสามารถโพสต์ได้
            </label>
          </div>

          {/* ปุ่มบันทึกและยกเลิก */}
          <div className="flex justify-between gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-gray-400 text-white py-3 rounded-2xl font-semibold shadow-md hover:bg-gray-500 transition flex-1 cursor-pointer hover:scale-105 active:scale-95"
              disabled={loading}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-sky-600 text-white py-3 rounded-2xl font-semibold shadow-md hover:bg-sky-700 transition flex-1 cursor-pointer hover:scale-105 active:scale-95 disabled:bg-sky-300"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}