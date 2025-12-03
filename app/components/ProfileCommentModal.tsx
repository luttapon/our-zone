"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import React, { useState, useEffect, FormEvent } from "react";
import Image from "next/image";
import { Loader2, Send, X } from "lucide-react"; // ไอคอนต่างๆ
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interfaces)
// ====================================================================

// ข้อมูลผู้ใช้ที่จะนำมาแสดงคู่กับคอมเมนต์
interface CommentUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

// ข้อมูลคอมเมนต์ (รวมข้อมูลผู้ใช้ด้วย)
interface CommentWithUser {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: CommentUser; // ข้อมูลผู้ใช้ที่ถูก Join มา
}

// ข้อมูลที่ Component นี้ต้องการ (Props)
interface ProfileCommentModalProps {
  postId: string;       // รหัสโพสต์
  userId: string;       // รหัสผู้ใช้ที่กำลังใช้งาน
  onClose: () => void;  // ฟังก์ชันปิดหน้าต่าง
  updateCount: (postId: string) => void; // ฟังก์ชันอัปเดตจำนวนคอมเมนต์ที่หน้าหลัก
}

// ====================================================================
// ฟังก์ชันช่วย (Helper Function)
// ====================================================================

// แปลง Path ของรูปภาพให้เป็น URL ที่ใช้งานได้จริง
const getAvatarPublicUrl = (path: string | null | undefined) => {
  if (!path) return "https://placehold.co/32"; // ถ้าไม่มีรูป ใช้รูปตัวอย่างแทน
  if (path.startsWith("http://") || path.startsWith("https://")) return path; // ถ้าเป็น URL อยู่แล้ว ใช้ได้เลย
  
  // ดึง URL จริงจาก Supabase Storage
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl || "https://placehold.co/32";
};

// ====================================================================
// Component หลัก: หน้าต่างแสดงความคิดเห็น (ProfileCommentModal)
// ====================================================================

export default function ProfileCommentModal({ postId, userId, onClose, updateCount }: ProfileCommentModalProps) {
  
  // --- 1. การจัดการข้อมูล (State) ---
  const [comments, setComments] = useState<CommentWithUser[]>([]); // รายการคอมเมนต์ทั้งหมด
  const [commentText, setCommentText] = useState("");              // ข้อความที่พิมพ์ในช่อง
  const [isLoading, setIsLoading] = useState(true);                // กำลังโหลดคอมเมนต์หรือไม่
  const [isSubmitting, setIsSubmitting] = useState(false);         // กำลังส่งคอมเมนต์หรือไม่

  // --- 2. โหลดข้อมูลเมื่อเปิดหน้าต่าง (Effect) ---
  useEffect(() => {
    const fetchComments = async () => {
      // ดึงคอมเมนต์จากตาราง comments และดึงข้อมูลผู้ใช้ (user) มาด้วย
      const { data } = await supabase
        .from("comments")
        .select("*, user:user_id(id, username, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true }); // เรียงจากเก่าไปใหม่

      if (data) {
        // แปลงข้อมูลให้ปลอดภัย (กันกรณีข้อมูลผู้ใช้เป็น null)
        const safeComments: CommentWithUser[] = data.map(c => ({
          ...c,
          user: c.user || { id: c.user_id, username: null, avatar_url: null },
        })) as CommentWithUser[];

        setComments(safeComments);
      }
      setIsLoading(false); // โหลดเสร็จแล้ว
    };
    
    fetchComments();
  }, [postId]); // ทำงานใหม่ทุกครั้งที่เปลี่ยนโพสต์ (postId เปลี่ยน)

  // --- 3. ฟังก์ชันส่งคอมเมนต์ (Handler) ---
  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault(); // ห้ามรีเฟรชหน้า
    
    // ตรวจสอบ: ต้องมีข้อความ และไม่ได้กำลังส่งอยู่
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true); // เริ่มส่งข้อมูล
    
    try {
      // บันทึกคอมเมนต์ลงฐานข้อมูล
      const { data: insertedData, error: insertError } = await supabase
        .from("comments")
        .insert([{ post_id: postId, user_id: userId, content: commentText.trim() }])
        .select("*, user:user_id(id, username, avatar_url)") // ดึงข้อมูลกลับมาแสดงผลทันที
        .single();

      if (insertError) throw insertError;

      // อัปเดตหน้าจอทันทีโดยไม่ต้องโหลดใหม่
      setComments((prev) => [...prev, insertedData as CommentWithUser]);
      setCommentText(""); // ล้างช่องพิมพ์
      
      // แจ้งหน้าหลักให้อัปเดตตัวเลขจำนวนคอมเมนต์
      updateCount(postId); 

    } catch (err) {
      console.error("Error submitting comment:", err);
      alert("ไม่สามารถเพิ่มความคิดเห็นได้"); 
    } finally {
      setIsSubmitting(false); // จบการทำงาน
    }
  };

  // --- 4. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // กรอบหน้าต่าง Modal
    <div className="bg-white rounded-2xl w-full max-w-md sm:max-w-lg shadow-2xl flex flex-col max-h-[90vh] mx-2 sm:mx-0">
      
      {/* ส่วนหัว: ชื่อหน้าต่างและปุ่มปิด */}
      <div className="p-4 sm:p-5 border-b border-gray-200 flex justify-between items-center shrink-0 bg-gradient-to-r from-sky-50 to-blue-50 rounded-t-2xl">
        <h3 className="text-base sm:text-lg font-bold text-gray-800">
          💬 ความคิดเห็นทั้งหมด ({comments.length})
        </h3>
        <button
          onClick={onClose}
          type="button"
          aria-label="ปิดหน้าต่าง"
          className="text-gray-400 hover:text-gray-700 p-1 hover:bg-white rounded-lg transition-colors"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer" />
        </button>
      </div>
      
      {/* ส่วนเนื้อหา: รายการคอมเมนต์ (เลื่อนขึ้นลงได้) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-white">
        {isLoading ? (
          // แสดงตอนกำลังโหลด
          <div className="p-6 sm:p-8 text-center">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto text-sky-500" />
            <p className="text-gray-500 text-sm mt-2">กำลังโหลด...</p>
          </div>
        ) : comments.length === 0 ? (
          // แสดงเมื่อไม่มีคอมเมนต์
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-400 text-sm">📝 ยังไม่มีใครแสดงความคิดเห็น</p>
          </div>
        ) : (
          // แสดงรายการคอมเมนต์
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 sm:gap-3 hover:bg-gray-50 p-2 sm:p-3 rounded-lg transition-colors">
              
              {/* รูปโปรไฟล์ */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-gradient-to-br from-sky-400 to-blue-500 shrink-0 border border-gray-200">
                <Image 
                  src={getAvatarPublicUrl(c.user?.avatar_url)} 
                  alt={c.user?.username || "User"} 
                  width={36} height={36} 
                  className="object-cover" 
                  unoptimized 
                />
              </div>
              
              {/* กล่องข้อความ */}
              <div className="flex-1 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm break-words border border-gray-100 hover:border-gray-200 transition-colors">
                <span className="font-semibold text-gray-800 text-sm">
                  {c.user?.username || "Unnamed User"}
                </span>
                <p className="text-gray-700 mt-1 text-sm leading-relaxed">{c.content}</p>
                
                {/* วันที่เวลา */}
                <p className="text-xs text-gray-400 mt-1.5">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ส่วนท้าย: ฟอร์มพิมพ์คอมเมนต์ */}
      <form onSubmit={handleCommentSubmit} className="p-3 sm:p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex gap-2 shrink-0 rounded-b-2xl">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="เพิ่มความคิดเห็น..."
          className="flex-1 px-3 sm:px-4 py-2 text-sm rounded-full border border-gray-300 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none transition-all"
          disabled={isSubmitting} // ปิดช่องพิมพ์ตอนกำลังส่ง
        />
        <button
          type="submit"
          disabled={!commentText.trim() || isSubmitting} // ปุ่มกดไม่ได้ถ้าช่องว่าง หรือกำลังส่ง
          className="bg-sky-600 text-white px-4 sm:px-5 py-2 text-sm rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer active:scale-95 hover:bg-sky-700 shadow-sm hover:shadow-md"
        >
          {/* เปลี่ยนไอคอนตามสถานะ */}
          {isSubmitting ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
          <span className="hidden sm:inline">ส่ง</span>
        </button>
      </form>
    </div>
  );
}