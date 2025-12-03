"use client";

import React, { useState, useEffect, FormEvent } from "react";
// ใช้ Supabase client จริง
import { supabase } from "@/lib/supabase/client";
// นำเข้า Icon สำหรับ Loading, Send, และ Close
import { Loader2, Send, X } from "lucide-react";
import Image from "next/image";

// --- กำหนดโครงสร้างข้อมูล (Interfaces) ---
// ข้อมูล User ที่ถูกดึงมาพร้อมกับคอมเมนต์
interface CommentUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

// โครงสร้างคอมเมนต์ที่รวมข้อมูล User
interface CommentWithUser {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: CommentUser; // ข้อมูล User ที่ Join มา
}

// Props ที่รับเข้ามาใน Modal
interface ProfileCommentModalProps {
  postId: string;
  userId: string; // ID ของ User ที่กำลังล็อกอินอยู่
  onClose: () => void;
  updateCount: (postId: string) => void; // Callback เพื่อแจ้งหน้าหลักให้อัปเดตจำนวนคอมเมนต์
}

// --- Helper: ฟังก์ชันดึง Public URL ของ Avatar จาก Supabase Storage ---
const getAvatarPublicUrl = (path: string | null | undefined) => {
  if (!path) return "https://placehold.co/32"; // URL Placeholder ถ้าไม่มี path
  if (path.startsWith("http://") || path.startsWith("https://")) return path; // ถ้าเป็น URL อยู่แล้วให้ใช้เลย
  // ดึง Public URL จาก Bucket 'avatars'
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl || "https://placehold.co/32";
};

export default function ProfileCommentModal({ postId, userId, onClose, updateCount }: ProfileCommentModalProps) {
  // --- ส่วนจัดการ State ---
  const [comments, setComments] = useState<CommentWithUser[]>([]); // รายการคอมเมนต์ทั้งหมด
  const [commentText, setCommentText] = useState(""); // ข้อความในช่องคอมเมนต์
  const [isLoading, setIsLoading] = useState(true); // สถานะกำลังโหลดคอมเมนต์เริ่มต้น
  const [isSubmitting, setIsSubmitting] = useState(false); // สถานะกำลังส่งคอมเมนต์ใหม่

  // --- Effect: โหลดข้อมูลคอมเมนต์เมื่อเปิด Modal ---
  useEffect(() => {
    const fetchComments = async () => {
      // ดึงข้อมูลจากตาราง comments, พร้อม Join ตาราง user_id
      const { data } = await supabase
        .from("comments")
        .select("*, user:user_id(id, username, avatar_url)") // Join ข้อมูล user
        .eq("post_id", postId)
        .order("created_at", { ascending: true }); // เรียงจากเก่าไปใหม่

      if (data) {
        // แปลงข้อมูลให้ปลอดภัย (Handle Null/Undefined จาก Join)
        const safeComments: CommentWithUser[] = data.map(c => ({
          ...c,
          // หากข้อมูล user เป็น null ให้ใส่ค่า default ป้องกัน Error
          user: c.user || { id: c.user_id, username: null, avatar_url: null },
        })) as CommentWithUser[];

        setComments(safeComments);
      }
      setIsLoading(false);
    };
    fetchComments();
  }, [postId]); // Dependency: โหลดใหม่เมื่อ postId เปลี่ยน

  // --- Logic: การส่งคอมเมนต์ (Submit) ---
  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // ตรวจสอบว่ามีข้อความ, และไม่ได้กำลัง Submit อยู่
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 1. บันทึกคอมเมนต์ลงฐานข้อมูล และดึงข้อมูล User ที่เพิ่งบันทึกกลับมา
      const { data: insertedData, error: insertError } = await supabase
        .from("comments")
        .insert([{ post_id: postId, user_id: userId, content: commentText.trim() }])
        .select("*, user:user_id(id, username, avatar_url)") // ต้อง select เพื่อให้ได้ข้อมูล user มาอัปเดต UI
        .single(); // ดึงข้อมูลกลับมาแค่แถวเดียว

      if (insertError) throw insertError;

      // 2. อัปเดตข้อมูลในหน้าจอทันที (Optimistic Update) โดยเพิ่มคอมเมนต์ใหม่เข้าไปใน State
      setComments((prev) => [...prev, insertedData as CommentWithUser]);
      setCommentText(""); // เคลียร์ช่องคอมเมนต์
      
      // 3. แจ้ง Component แม่ให้อัปเดตตัวเลขจำนวนคอมเมนต์
      updateCount(postId); 

    } catch (err) {
      console.error("Error submitting comment:", err);
      // ใช้ alert() หรือ Modal แจ้งเตือนอื่น ๆ แทน
      alert("ไม่สามารถเพิ่มความคิดเห็นได้"); 
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // --- UI: กล่อง Modal (Container) ---
    <div className="bg-white rounded-2xl w-full max-w-md sm:max-w-lg shadow-2xl flex flex-col max-h-[90vh] mx-2 sm:mx-0">
      
      {/* ส่วนหัว: ชื่อและปุ่มปิด */}
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
      
      {/* ส่วนรายการคอมเมนต์ (Scrollable Body) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-white">
        {isLoading ? (
          // สถานะกำลังโหลด
          <div className="p-6 sm:p-8 text-center">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto text-sky-500" />
            <p className="text-gray-500 text-sm mt-2">กำลังโหลด...</p>
          </div>
        ) : comments.length === 0 ? (
          // กรณีไม่มีคอมเมนต์
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-400 text-sm">📝 ยังไม่มีใครแสดงความคิดเห็น</p>
          </div>
        ) : (
          // แสดงรายการคอมเมนต์ทั้งหมด
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
              {/* กล่องข้อความคอมเมนต์ */}
              <div className="flex-1 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm break-words border border-gray-100 hover:border-gray-200 transition-colors">
                <span className="font-semibold text-gray-800 text-sm">
                  {c.user?.username || "Unnamed User"}
                </span>
                <p className="text-gray-700 mt-1 text-sm leading-relaxed">{c.content}</p>
                {/* วันที่และเวลาของคอมเมนต์ */}
                <p className="text-xs text-gray-400 mt-1.5">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ส่วนฟอร์มส่งคอมเมนต์ (Footer) */}
      <form onSubmit={handleCommentSubmit} className="p-3 sm:p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex gap-2 shrink-0 rounded-b-2xl">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="เพิ่มความคิดเห็น..."
          className="flex-1 px-3 sm:px-4 py-2 text-sm rounded-full border border-gray-300 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none transition-all"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          // ปุ่ม Disabled ถ้าไม่มีข้อความ หรือกำลัง Submit
          disabled={!commentText.trim() || isSubmitting}
          className="bg-sky-600 text-white px-4 sm:px-5 py-2 text-sm rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer active:scale-95 hover:bg-sky-700 shadow-sm hover:shadow-md"
        >
          {/* แสดง Icon Loader หรือ Send ตามสถานะ */}
          {isSubmitting ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
          <span className="hidden sm:inline">ส่ง</span>
        </button>
      </form>
    </div>
  );
};