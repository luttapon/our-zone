"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import { useState, ChangeEvent } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import type { PostWithUser } from "@/types/supabase"; // นำเข้า Type สำหรับข้อมูลโพสต์

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interface)
// ====================================================================

// ข้อมูลที่ Component นี้ต้องการ (Props)
interface PostInputBarProps {
  groupId: string;      // รหัสกลุ่มที่จะโพสต์
  userId: string;       // รหัสผู้ใช้ที่กำลังล็อกอิน
  onPosted?: (newPost: PostWithUser) => void; // ฟังก์ชันเรียกกลับเมื่อโพสต์สำเร็จ
  
  // ข้อมูลเกี่ยวกับสิทธิ์การใช้งาน
  isGroupOwner: boolean;       // เป็นเจ้าของกลุ่มหรือไม่
  allowMembersToPost: boolean; // กลุ่มอนุญาตให้สมาชิกโพสต์หรือไม่
  isFollowing: boolean;        // เป็นสมาชิก/ผู้ติดตามกลุ่มหรือไม่
}

// ====================================================================
// Component หลัก: แถบเขียนโพสต์ (PostInputBar)
// ====================================================================

export default function PostInputBar({ groupId, userId, onPosted, isGroupOwner, allowMembersToPost, isFollowing }: PostInputBarProps) {
  
  // --- 1. การจัดการข้อมูล (State) ---
  const [text, setText] = useState("");           // ข้อความในโพสต์
  const [files, setFiles] = useState<File[]>([]); // ไฟล์รูป/วิดีโอที่เลือกไว้
  const [previews, setPreviews] = useState<string[]>([]); // URL รูปตัวอย่าง
  const [loading, setLoading] = useState(false);  // สถานะกำลังโหลด

  // --- 2. ตรวจสอบสิทธิ์ (Logic) ---
  
  // ผู้ใช้โพสต์ได้ก็ต่อเมื่อ: (เป็นเจ้าของ) หรือ (เป็นสมาชิก และ กลุ่มอนุญาตให้สมาชิกโพสต์)
  const canUserPost = isGroupOwner || (isFollowing && allowMembersToPost);
  
  // --- 3. การแสดงผลตามเงื่อนไข (Render Control) ---

  // กรณี 1: ถ้ายังไม่ล็อกอิน (ไม่มี userId) -> ไม่แสดงอะไรเลย
  if (!userId) {
    return null; 
  }
  
  // กรณี 2: ถ้าไม่ใช่เจ้าของ และไม่ได้เป็นสมาชิกกลุ่ม -> ไม่แสดงอะไรเลย
  if (!isGroupOwner && !isFollowing) {
    return null;
  }
  
  // --- 4. ฟังก์ชันจัดการไฟล์ (File Handlers) ---

  // เมื่อเลือกไฟล์รูป/วิดีโอ
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // เพิ่มไฟล์ใหม่เข้าไปในรายการเดิม
    setFiles((prev) => [...prev, ...selectedFiles]);
    
    // สร้าง URL ชั่วคราวสำหรับแสดงตัวอย่าง
    const newPreviews = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  // ลบไฟล์ที่เลือกไว้ออก
  const removeMedia = (index: number) => {
    // คืนหน่วยความจำของ Browser
    URL.revokeObjectURL(previews[index]); 
    
    // ลบไฟล์และตัวอย่างออกจากรายการตาม Index
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // อัปโหลดไฟล์ไปยัง Supabase Storage
  const uploadMedia = async (): Promise<string[]> => {
    const urls: string[] = [];
    
    for (const file of files) {
      // ตั้งชื่อไฟล์ใหม่ให้ไม่ซ้ำกัน
      const fileExt = file.name.split('.').pop();
      const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `posts/${uniqueName}`;

      // ตั้งค่า Metadata เพื่อใช้ตรวจสอบสิทธิ์ (RLS Policy)
      const fileOptions = {
        cacheControl: '3600',
        upsert: false,
        metadata: {
          user_id: userId // แนบ ID ผู้ใช้ไปกับไฟล์
        }
      };

      // อัปโหลดไฟล์
      const { error } = await supabase.storage
        .from("post_media")
        .upload(filePath, file, fileOptions);

      if (!error) {
        // ถ้าสำเร็จ ให้ดึง URL สาธารณะของไฟล์ออกมาเก็บไว้
        const { data } = supabase.storage.from("post_media").getPublicUrl(filePath);
        if (data.publicUrl) urls.push(data.publicUrl);
      } else {
        console.error("Error uploading file:", error.message);
      }
    }
    return urls; // ส่งกลับรายการ URL ทั้งหมดที่อัปโหลดได้
  };

  // --- 5. ฟังก์ชันส่งโพสต์ (Submit Handler) ---

  const handleSubmit = async () => {
    // ตรวจสอบความถูกต้อง: ต้องมีสิทธิ์ และ (ต้องมีข้อความ หรือ มีไฟล์)
    if (!canUserPost || (!text.trim() && files.length === 0)) return;
    
    setLoading(true); // เริ่มโหลด

    // ขั้นตอนที่ 1: อัปโหลดรูป/วิดีโอก่อน
    const mediaUrls = await uploadMedia();

    // ขั้นตอนที่ 2: บันทึกข้อมูลโพสต์ลงฐานข้อมูล
    const { data, error } = await supabase
      .from("posts")
      .insert({
        group_id: groupId,
        user_id: userId,
        content: text.trim(),
        media_urls: mediaUrls,
      })
      // ดึงข้อมูลผู้โพสต์กลับมาด้วยเลย เพื่อให้หน้าจอแสดงผลได้ทันที
      .select("*, user:user_id(id, username, avatar_url, created_at)") 
      .single();

    setLoading(false); // หยุดโหลด

    if (error) {
      console.error("Error inserting post:", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
      return;
    }

    // ขั้นตอนที่ 3: ล้างค่าในฟอร์ม
    setText("");
    setFiles([]);
    previews.forEach(URL.revokeObjectURL); // ล้างหน่วยความจำ URL
    setPreviews([]);

    // ขั้นตอนที่ 4: แจ้ง Component แม่ว่ามีโพสต์ใหม่แล้ว
    if (onPosted && data) {
      // จัดเตรียมข้อมูลโพสต์ใหม่ให้ครบถ้วนตาม Type
      const newPost: PostWithUser = {
        ...data,
        media_urls: data.media_urls || [],
        likes_count: 0,
        liked_by_user: false,
        comments: [], // โพสต์ใหม่ยังไม่มีคอมเมนต์
        user: data.user || {
          id: userId,
          username: "Unknown",
          avatar_url: null,
          created_at: null,
        }
      };
      onPosted(newPost);
    }
  };

  // --- 6. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    <div className="bg-white p-5 rounded-3xl shadow-md mb-5 border border-gray-200 flex flex-col gap-4 transition-all hover:shadow-lg">
      
      {/* ส่วนแจ้งเตือน: กรณีเห็นกล่องแต่ไม่มีสิทธิ์โพสต์ */}
      {!canUserPost && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          กลุ่มนี้ถูกตั้งค่าให้มีเฉพาะเจ้าของเท่านั้นที่สามารถโพสต์ได้
        </div>
      )}

      {/* ช่องพิมพ์ข้อความ */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="💭 เขียนอะไรสักอย่าง..."
        className="w-full border border-gray-300 rounded-2xl p-4 outline-none resize-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
        rows={4}
        disabled={!canUserPost || loading} // ปิดการใช้งานถ้าไม่มีสิทธิ์ หรือกำลังโหลด
      />

      {/* ส่วนแสดงตัวอย่างรูป/วิดีโอที่เลือกไว้ */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {previews.map((url, i) => (
            <div key={i} className="relative w-32 h-32 rounded-xl overflow-hidden shadow-sm border border-gray-200">
              
              {/* ปุ่มกากบาทมุมขวาบนเพื่อลบรูป */}
              <button
                type="button"
                onClick={() => removeMedia(i)}
                className="absolute top-1 right-1 bg-gray-800 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-gray-900 z-10"
                title="ลบสื่อ"
              >
                ×
              </button>

              {/* แสดงผลตามประเภทไฟล์ (วิดีโอ หรือ รูปภาพ) */}
              {files[i].type.startsWith("video") ? (
                <video src={url} controls className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Image src={url} alt="Preview" fill className="object-cover rounded-xl" unoptimized />
              )}
            </div>
          ))}
        </div>
      )}

      {/* แถบเครื่องมือด้านล่าง */}
      <div className="flex justify-between items-center mt-3">
        
        {/* ปุ่มเพิ่มรูป/วิดีโอ */}
        <label
          className={`cursor-pointer flex items-center gap-1 text-blue-600 font-semibold transition-all active:scale-95 ${
            canUserPost ? 'hover:text-blue-700 hover:underline' : 'opacity-50 cursor-not-allowed'
          }`}
        >
          📸 เพิ่มรูป / 🎬 วิดีโอ
          {/* Input file ถูกซ่อนไว้ แต่ทำงานเมื่อกด Label */}
          <input
            type="file"
            className="hidden"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            disabled={!canUserPost || loading}
          />
        </label>

        {/* ปุ่มโพสต์ */}
        <button
          type="button"
          onClick={handleSubmit}
          // ปิดปุ่มถ้า: กำลังโหลด, ไม่มีข้อมูลจะส่ง, หรือไม่มีสิทธิ์โพสต์
          disabled={loading || (!text.trim() && files.length === 0) || !canUserPost}
          className="bg-blue-600 text-white px-5 py-2 rounded-2xl disabled:opacity-50 hover:bg-blue-700 transition hover:scale-105 flex items-center gap-2 font-medium"
        >
          {loading ? "⏳ กำลังโพสต์..." : "🚀 โพสต์"}
        </button>
      </div>
    </div>
  );
}