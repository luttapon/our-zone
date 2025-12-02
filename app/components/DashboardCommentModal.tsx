"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";
// นำเข้า Icon สำหรับ Loading, Send, และ Close
import { Loader2, Send, X } from "lucide-react";
import Image from "next/image";

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูล (Interfaces) ---
// ----------------------------------------------------------------------

/** ข้อมูล User ที่ถูกดึงมาพร้อมกับคอมเมนต์ */
interface CommentUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

/** โครงสร้างคอมเมนต์ที่รวมข้อมูล User (เพื่อใช้ใน State) */
interface CommentWithUser {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: CommentUser;
}

/** Props ที่รับเข้ามาใน Modal */
interface DashboardCommentModalProps {
  postId: string;
  userId: string; // ID ของ User ที่กำลังล็อกอินอยู่
  onClose: () => void;
  // Callback เพื่อแจ้ง Component แม่ให้อัปเดตจำนวนคอมเมนต์
  updateCount: (postId: string) => void; 
}

// --- Helper: ฟังก์ชันดึง Public URL รูปโปรไฟล์จาก Supabase Storage ---
const getAvatarPublicUrl = (path: string | null | undefined) => {
  if (!path) return "https://placehold.co/32"; // URL Placeholder ถ้าไม่มี path
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // ดึง Public URL จาก Bucket 'avatars'
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl || "https://placehold.co/32";
};

// ----------------------------------------------------------------------
// --- Component หลัก: DashboardCommentModal ---
// ----------------------------------------------------------------------
export default function DashboardCommentModal({
  postId,
  userId,
  onClose,
  updateCount,
}: DashboardCommentModalProps) {
  // --- ส่วนจัดการ State ---
  const [comments, setComments] = useState<CommentWithUser[]>([]); // รายการคอมเมนต์ทั้งหมด
  const [commentText, setCommentText] = useState(""); // ข้อความในช่องคอมเมนต์
  const [isLoading, setIsLoading] = useState(true); // สถานะกำลังโหลดคอมเมนต์เริ่มต้น
  const [isSubmitting, setIsSubmitting] = useState(false); // สถานะกำลังส่งคอมเมนต์ใหม่

  // --- Effect: โหลดข้อมูลคอมเมนต์เมื่อเปิด Modal ---
  useEffect(() => {
    const fetchComments = async () => {
      // 1. ดึงข้อมูลจากตาราง comments, พร้อม Join ตาราง user_id
      const { data } = await supabase
        .from("comments")
        .select("*, user:user_id(id, username, avatar_url)") // Join ข้อมูล user
        .eq("post_id", postId)
        .order("created_at", { ascending: true }); // เรียงจากเก่าไปใหม่

      if (data) {
        // 2. แปลงข้อมูลให้ปลอดภัย (Handle Null/Undefined) เพื่อป้องกัน Error
        const safeComments: CommentWithUser[] = data.map((c) => ({
          ...c,
          // หากข้อมูล user เป็น null ให้ใส่ค่า default (เพื่อให้แน่ใจว่าเป็น CommentUser Type)
          user: c.user || { id: c.user_id, username: null, avatar_url: null },
        })) as CommentWithUser[];

        setComments(safeComments);
      }
      setIsLoading(false);
    };
    fetchComments();
  }, [postId]); // Dependency: โหลดใหม่เมื่อ postId เปลี่ยน

  // --- Logic: การส่งคอมเมนต์ (Submit Handler) ---
  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // ตรวจสอบว่ามีข้อความ, และไม่ได้กำลัง Submit อยู่
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 1. บันทึกคอมเมนต์ลงฐานข้อมูล
      const { data: insertedData, error: insertError } = await supabase
        .from("comments")
        .insert([{ post_id: postId, user_id: userId, content: commentText.trim() }])
        // Select เพื่อให้ได้ข้อมูล user ที่เพิ่งบันทึกมาอัปเดต UI ทันที
        .select("*, user:user_id(id, username, avatar_url)") 
        .single();

      if (insertError) throw insertError;

      // 2. อัปเดตข้อมูลในหน้าจอทันที (Optimistic Update)
      setComments((prev) => [...prev, insertedData as CommentWithUser]);
      setCommentText(""); // เคลียร์ช่องคอมเมนต์

      // 3. แจ้ง Component แม่ให้อัปเดตตัวเลขจำนวนคอมเมนต์
      updateCount(postId);
    } catch (err) {
      console.error("Error submitting comment:", err);
      alert("ไม่สามารถเพิ่มความคิดเห็นได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // --- UI: กล่อง Modal (Container) ---
    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
      
      {/* ส่วนหัว: ชื่อและปุ่มปิด */}
      <div className="p-4 border-b flex justify-between items-center shrink-0">
        <h3 className="text-lg font-bold">
          ความคิดเห็นทั้งหมด ({comments.length})
        </h3>
        <button
          onClick={onClose}
          type="button"
          aria-label="ปิดหน้าต่าง"
          className="text-gray-500 hover:text-gray-900 font-bold text-2xl leading-none"
        >
          <X className="w-6 h-6 cursor-pointer" />
        </button>
      </div>

      {/* ส่วนรายการคอมเมนต์ (Scrollable Body) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          // สถานะกำลังโหลด
          <div className="p-4 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-500" />
          </div>
        ) : comments.length === 0 ? (
          // กรณีไม่มีคอมเมนต์
          <p className="text-center text-gray-500 py-10">
            ยังไม่มีใครแสดงความคิดเห็น
          </p>
        ) : (
          // แสดงรายการคอมเมนต์ทั้งหมด
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              {/* รูปโปรไฟล์ */}
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 shrink-0">
                <Image
                  src={getAvatarPublicUrl(c.user?.avatar_url)}
                  alt={c.user?.username || "User"}
                  width={32}
                  height={32}
                  className="object-cover"
                  unoptimized
                />
              </div>
              {/* กล่องข้อความคอมเมนต์ */}
              <div className="flex-1 bg-gray-100 px-3 py-2 rounded-xl text-sm break-words">
                <span className="font-semibold">
                  {c.user?.username || "Unnamed User"}
                </span>
                <p className="text-gray-800 mt-0.5">{c.content}</p>
                {/* วันที่และเวลาของคอมเมนต์ */}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ส่วนฟอร์มส่งคอมเมนต์ (Footer) */}
      <form
        onSubmit={handleCommentSubmit}
        className="p-4 border-t bg-gray-50 flex gap-2 shrink-0"
      >
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="เพิ่มความคิดเห็น..."
          className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:ring-sky-500 focus:border-sky-500 outline-none"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          // ปุ่ม Disabled ถ้าไม่มีข้อความ หรือกำลัง Submit
          disabled={!commentText.trim() || isSubmitting}
          className="bg-sky-600 text-white px-5 py-2 rounded-full font-semibold disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer active:scale-95 hover:bg-sky-700 "
        >
          {/* แสดง Icon Loader หรือ Send ตามสถานะ */}
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          <span>ส่ง</span>
        </button>
      </form>
    </div>
  );
}