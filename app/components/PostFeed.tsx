"use client";

import type { PostWithUser, CommentWithUser } from "@/types/supabase";
// นำเข้า Component PostCard สำหรับแสดงผลโพสต์แต่ละรายการ
import PostCard from "./PostCard"; 

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูล Props สำหรับ Component PostFeed ---
// ----------------------------------------------------------------------
export interface PostFeedProps {
  // รายการโพสต์ทั้งหมด (รวมข้อมูล Likes, Comments, และ User)
  posts?: (PostWithUser & {
    media_urls: string[];
    likes_count?: number;
    comments_count?: number;
    liked_by_user?: boolean;
    comments?: CommentWithUser[];
  })[];
  groupName: string;
  groupAvatar?: string | null;
  userId?: string | null; // ID ของผู้ใช้งานปัจจุบัน
  onPostDeleted?: (postId: string) => void; // Callback เมื่อลบโพสต์สำเร็จ
  onPostUpdated?: (updatedPost: PostWithUser) => void; // Callback เมื่ออัปเดตโพสต์สำเร็จ
  groupOwnerId: string; // ID เจ้าของกลุ่ม (ใช้ในการตรวจสอบสิทธิ์)
  isGroupOwner: boolean; // สถานะว่าเป็นเจ้าของกลุ่มหรือไม่
}

// ----------------------------------------------------------------------
// --- Component หลัก: PostFeed (Container สำหรับแสดงรายการโพสต์) ---
// ----------------------------------------------------------------------
export default function PostFeed({
  posts = [], // กำหนดค่าเริ่มต้นเป็น Array ว่าง
  groupName,
  groupAvatar,
  userId,
  onPostDeleted,
  onPostUpdated,
  groupOwnerId,
  isGroupOwner, // รับ Prop สถานะเจ้าของ
}: PostFeedProps) {
  // --- Logic: กรณีไม่มีโพสต์ให้แสดงข้อความว่างเปล่า (Empty State) ---
  if (!posts.length)
    return (
      <div className="p-12 text-center bg-white rounded-xl shadow-md border border-gray-200">
        {isGroupOwner ? (
          // Empty State สำหรับเจ้าของกลุ่ม (Owner)
          <>
            <p className="text-xl font-semibold text-gray-900 mb-2">
              ยินดีต้อนรับสู่ **{groupName}**! 🎉
            </p>
            <p className="text-gray-600">
              กลุ่มของคุณยังไม่มีโพสต์แรก! เริ่มต้นสร้างเนื้อหาหรือกิจกรรมเพื่อดึงดูดสมาชิก
            </p>
          </>
        ) : (
          // Empty State สำหรับผู้ติดตาม/คนทั่วไป (Member/Guest)
          <>
            <p className="text-xl font-semibold text-gray-500 mb-2">
              🎉 ยินดีต้อนรับเข้าสู่กลุ่ม!
            </p>
            <p className="text-gray-600">
              ติดตามกลุ่ม เพื่อเข้าดูโพสและกิจกรรมต่างๆ ที่น่าสนใจ
            </p>
          </>
        )}
      </div>
    );

  // --- Logic: แปลงข้อมูลโพสต์ให้ปลอดภัย (Sanitize Data) ---
  // การรับประกันว่า fields ที่เป็น Optional จะไม่เป็น null ก่อนส่งไป PostCard
  const safePosts = posts.map((post) => {
    // เตรียมรายการคอมเมนต์ (ถ้าเป็น null ให้ใช้ array ว่าง)
    const commentsToShow = post.comments || [];

    return {
      // ข้อมูลโพสต์เดิม
      ...post,
      // รับประกันว่าเป็น Array ว่างถ้าไม่มี Media
      media_urls: post.media_urls || [],
      // รับประกันว่าเป็น Array ว่างถ้าไม่มี Comments
      comments: commentsToShow,
    };
  });

  return (
    // --- แสดงรายการโพสต์ทั้งหมด (Render Loop) ---
    // Container สำหรับ Feed, จัดเรียงโพสต์ในแนวตั้งด้วยช่องว่าง 4 หน่วย
    <div className="flex flex-col space-y-4">
      {safePosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          groupName={groupName}
          groupAvatar={groupAvatar}
          userId={userId}
          onPostDeleted={onPostDeleted}
          onPostUpdated={onPostUpdated}
          groupOwnerId={groupOwnerId}
        />
      ))}
    </div>
  );
}