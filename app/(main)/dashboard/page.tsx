"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import React, { useState, useEffect } from "react";
import Image from "next/image";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { useRouter } from "next/navigation"; // เครื่องมือเปลี่ยนหน้า
import { Loader2, Heart, MessageSquare } from "lucide-react"; // ไอคอนต่างๆ
import DashboardCommentModal from "@/app/components/DashboardCommentModal"; // Modal คอมเมนต์
import Link from "next/link";

// ====================================================================
// Component ย่อย: MediaModal (แสดงรูปภาพ/วิดีโอขนาดใหญ่)
// ====================================================================

const MediaModal = ({
  mediaUrl,
  onClose,
}: {
  mediaUrl: string;
  onClose: () => void;
}) => {
  if (!mediaUrl) return null;

  // ตรวจสอบว่าเป็นไฟล์วิดีโอหรือไม่
  const isVideo =
    mediaUrl.endsWith(".mp4") ||
    mediaUrl.endsWith(".webm") ||
    mediaUrl.endsWith(".ogg");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={onClose} // ปิดเมื่อคลิกพื้นหลัง
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // คลิกที่เนื้อหาไม่ปิด Modal
      >
        {isVideo ? (
          // แสดงวิดีโอ
          <video
            src={mediaUrl}
            controls
            className="w-full h-full max-h-[90vh] object-contain rounded-xl"
            autoPlay
          />
        ) : (
          // แสดงรูปภาพ
          <div className="relative w-full h-full max-h-[90vh]">
            <Image
              src={mediaUrl}
              alt="Full size media"
              className="object-contain"
              fill
              sizes="90vw"
              unoptimized
            />
          </div>
        )}
      </div>
      {/* ปุ่มปิด */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition z-50 leading-none"
        aria-label="ปิด"
      >
        &times;
      </button>
    </div>
  );
};

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interfaces & Helpers)
// ====================================================================

interface FollowedGroup {
  group_id: string;
}
interface OwnedGroup {
  id: string;
}

// ฟังก์ชันดึง URL รูปโปรไฟล์กลุ่ม
const getGroupAvatarUrl = (avatarPath: string | null | undefined) => {
  const defaultUrl = "https://placehold.co/40x40?text=G";
  if (!avatarPath) return defaultUrl;
  if (avatarPath.startsWith("http")) return avatarPath;

  const { data } = supabase.storage.from("groups").getPublicUrl(avatarPath);
  return data.publicUrl || defaultUrl;
};

// ฟังก์ชันดึง URL รูปโปรไฟล์ผู้ใช้
const getProfileAvatarUrl = (avatarPath: string | null | undefined) => {
  const defaultUrl = "https://placehold.co/40x40?text=U";
  if (!avatarPath) return defaultUrl;
  if (avatarPath.startsWith("http")) return avatarPath;

  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
  return data.publicUrl || defaultUrl;
};

// ข้อมูลโพสต์ดิบจาก Supabase
interface PostFromSupabase {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  group_id: string;
  media_urls: string[] | null;
  likes: { user_id: string }[] | null;
  comments: { id: string }[] | null;
  groups: { name: string; avatar_url: string | null; owner_id: string } | null;
  user: { username: string; avatar_url: string | null } | null;
}

// ข้อมูลโพสต์ที่พร้อมใช้งานในหน้าจอ
interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  group_id: string;
  media_urls: string[] | null;
  likesCount: number;
  commentsCount: number;
  likedByUser: boolean;
  group_name: string;
  group_avatar_url: string;
  post_username: string;
  post_user_avatar_url: string;
  group_owner_id: string; // ID เจ้าของกลุ่ม
}

// ====================================================================
// Component หลัก: หน้าแดชบอร์ด (DashboardPage)
// ====================================================================

export default function DashboardPage() {
  const router = useRouter();

  // --- 1. การจัดการข้อมูล (State) ---
  const [user, setUser] = useState<SupabaseUser | null>(null); // ข้อมูลผู้ใช้ปัจจุบัน
  const [posts, setPosts] = useState<Post[]>([]);              // รายการโพสต์ที่จะแสดง
  const [loading, setLoading] = useState(true);                // สถานะโหลดหน้าเว็บ
  const [activePostIdForComments, setActivePostIdForComments] = useState<string | null>(null); // โพสต์ที่เปิดคอมเมนต์อยู่

  // จัดการ Modal รูปภาพ
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");

  // ฟังก์ชันแปลง Path รูปโพสต์เป็น URL
  const getPublicMediaUrl = (urlOrPath: string) => {
    if (!urlOrPath) return "https://placehold.co/128x128?text=No+Image";
    if (urlOrPath.startsWith("http")) return urlOrPath;

    const { data } = supabase.storage.from("post_media").getPublicUrl(urlOrPath);
    return data.publicUrl || "https://placehold.co/128x128?text=No+Image";
  };

  // เปิดดูรูปขนาดใหญ่
  const handleImageClick = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };

  // --- 2. ตรวจสอบการล็อกอิน (Effect) ---
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login"); // ถ้ายังไม่ล็อกอิน ให้ไปหน้า Login
        return;
      }

      setUser(user as SupabaseUser);
    };

    getUser();
  }, [router]);

  // --- 3. ดึงข้อมูลโพสต์ (Effect) ---
  useEffect(() => {
    if (!user) return; // รอข้อมูล User ก่อน

    const fetchPosts = async () => {
      try {
        // 3.1 หา ID กลุ่มที่ผู้ใช้ติดตาม หรือเป็นเจ้าของ
        const { data: followedGroups } = (await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)) as { data: FollowedGroup[] | null };
        
        const { data: ownedGroups } = (await supabase
          .from("groups")
          .select("id")
          .eq("owner_id", user.id)) as { data: OwnedGroup[] | null };
        
        // รวม ID ทั้งหมดและตัดตัวซ้ำ
        const allGroupIds = [
          ...new Set([
            ...(followedGroups?.map((g) => g.group_id) || []),
            ...(ownedGroups?.map((g) => g.id) || []),
          ]),
        ];

        if (allGroupIds.length === 0) {
          setPosts([]);
          setLoading(false);
          return;
        }

        // 3.2 ดึงโพสต์จากกลุ่มเหล่านั้น
        const { data: postsData } = (await supabase
          .from("posts")
          .select(
            `id, content, created_at, user_id, group_id, media_urls,
             likes(user_id), comments(id), groups(name, avatar_url, owner_id),
             user(username, avatar_url)`
          )
          .in("group_id", allGroupIds) // เงื่อนไข: อยู่ในกลุ่มที่เกี่ยวข้อง
          .order("created_at", { ascending: false })) as {
          data: PostFromSupabase[] | null;
        };

        // 3.3 แปลงข้อมูลให้พร้อมแสดงผล
        const formattedPosts: Post[] =
          postsData?.map((post) => {
            return {
              id: post.id,
              content: post.content,
              created_at: post.created_at,
              user_id: post.user_id,
              group_id: post.group_id,
              media_urls: post.media_urls,
              likesCount: post.likes?.length || 0,
              commentsCount: post.comments?.length || 0,
              likedByUser: post.likes?.some((like) => like.user_id === user.id) || false,
              group_name: post.groups?.name || "กลุ่มไม่ทราบชื่อ",
              group_avatar_url: getGroupAvatarUrl(post.groups?.avatar_url),
              post_username: post.user?.username || "Unnamed User",
              post_user_avatar_url: getProfileAvatarUrl(post.user?.avatar_url),
              group_owner_id: post.groups?.owner_id || "",
            };
          }) || [];

        setPosts(formattedPosts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user]);

  // --- 4. ฟังก์ชันจัดการเหตุการณ์ (Handlers) ---

  // กดไลก์ / ยกเลิกไลก์ (Optimistic Update)
  const handleLikeToggle = async (postId: string, likedByUser: boolean) => {
    if (!user) return;

    // อัปเดตหน้าจอทันที
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByUser: !likedByUser,
              likesCount: likedByUser ? p.likesCount - 1 : p.likesCount + 1,
            }
          : p
      )
    );

    try {
      if (likedByUser) {
        // ลบไลก์
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        // เพิ่มไลก์
        await supabase.from("likes").insert([{ post_id: postId, user_id: user.id }]);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      // ถ้า Error ให้ย้อนค่ากลับ
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByUser: likedByUser,
                likesCount: likedByUser ? p.likesCount + 1 : p.likesCount - 1,
              }
            : p
        )
      );
    }
  };

  // อัปเดตจำนวนคอมเมนต์ (เมื่อปิด Modal คอมเมนต์)
  const updateCommentCount = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, commentsCount: p.commentsCount + 1 }
          : p
      )
    );
  };

  // --- 5. ส่วนแสดงผลหน้าจอ (Render UI) ---

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-sky-600" />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-34 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 text-center">
        Feed โพสต์ล่าสุด
      </h2>
      
      {/* Modal ดูรูปภาพขยาย */}
      {showImageModal && (
        <MediaModal
          mediaUrl={modalImageUrl}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {posts.length === 0 ? (
        // กรณีไม่มีโพสต์
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <h2 className="text-gray-900 font-semibold">ยังไม่มีโพสต์</h2>
          <p className="text-gray-500 mt-1">
            โพสต์จากกลุ่มที่คุณติดตามจะแสดงที่นี่
          </p>
        </div>
      ) : (
        // แสดงรายการโพสต์
        <div className="grid gap-4">
          {posts.map((post) => {
            // เช็คว่าเป็นเจ้าของกลุ่มโพสต์เองหรือไม่
            const isOwnerPosting = post.user_id === post.group_owner_id; 
            
            // เลือกชื่อและรูปที่จะแสดง (ถ้าเจ้าของโพสต์ ให้แสดงในนามกลุ่ม)
            const avatarSrc = isOwnerPosting
              ? post.group_avatar_url
              : post.post_user_avatar_url;
            const nameDisplay = isOwnerPosting
              ? post.group_name
              : post.post_username;

            return (
              <div
                key={post.id}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
              >
                {/* Header ของโพสต์ */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    
                    {/* รูปโปรไฟล์ผู้โพสต์ */}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-100 shrink-0">
                      <Image
                        src={avatarSrc}
                        alt="Avatar"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    
                    <div>
                      {/* ชื่อผู้โพสต์ */}
                      <p className="font-bold text-gray-900">{nameDisplay}</p>
                      {/* ชื่อกลุ่ม */}
                      <p className="text-xs text-gray-500">
                        {isOwnerPosting
                          ? "แอดมินกลุ่ม :"
                          : "โพสต์ในกลุ่ม :"}
                        <Link href={`/groups/${post.group_id}`} className="font-medium text-sky-600 hover:text-sky-700 ml-1">
                          {post.group_name}
                        </Link>
                      </p>
                      {/* เวลาที่โพสต์ */}
                      <p className="text-xs text-gray-400">
                        {new Date(post.created_at).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* เนื้อหาข้อความ */}
                <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* รูปภาพ/วิดีโอประกอบ */}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.media_urls.map((url, idx) => {
                      const publicUrl = getPublicMediaUrl(url);
                      const isVideo =
                        publicUrl.endsWith(".mp4") ||
                        publicUrl.endsWith(".webm") ||
                        publicUrl.endsWith(".ogg");

                      return (
                        <div
                          key={idx}
                          className="relative w-32 h-32 rounded-lg overflow-hidden border bg-gray-100 cursor-pointer"
                          onClick={() => handleImageClick(publicUrl)}
                        >
                          {isVideo ? (
                            <video
                              src={publicUrl}
                              controls={false}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Image
                              src={publicUrl}
                              alt={`Post media ${idx}`}
                              fill
                              sizes="128px"
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ปุ่ม Like และ Comment */}
                <div className="flex gap-4 text-gray-500 text-sm pt-3 mt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleLikeToggle(post.id, post.likedByUser)}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                      post.likedByUser ? "text-red-500" : "hover:text-red-400"
                    }`}
                  >
                    <Heart className="w-4 h-4 fill-current" />
                    {post.likesCount} ถูกใจ
                  </button>

                  <button
                    onClick={() => setActivePostIdForComments(post.id)}
                    className="flex items-center gap-1.5 hover:text-sky-600 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {post.commentsCount} ความคิดเห็น
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal แสดงความคิดเห็น (Overlay) */}
      {activePostIdForComments && user && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <DashboardCommentModal
            postId={activePostIdForComments}
            userId={user.id}
            onClose={() => setActivePostIdForComments(null)}
            updateCount={updateCommentCount}
          />
        </div>
      )}
    </div>
  );
}