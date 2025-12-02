"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
// นำเข้า Icon สำหรับ Loading, Heart, และ MessageSquare
import { Loader2, Heart, MessageSquare } from "lucide-react"; 
// นำเข้า Modal คอมเมนต์สำหรับ Dashboard
import DashboardCommentModal from "@/app/components/DashboardCommentModal"; 
import Link from "next/link";

// ----------------------------------------------------------------------
// --- Component ย่อย: MediaModal (แสดงรูปภาพ/วิดีโอขนาดใหญ่) ---
// ----------------------------------------------------------------------
const MediaModal = ({
  mediaUrl,
  onClose,
}: {
  mediaUrl: string;
  onClose: () => void;
}) => {
  if (!mediaUrl) return null;
  // ตรวจสอบนามสกุลไฟล์ว่าเป็นวิดีโอหรือไม่
  const isVideo =
    mediaUrl.endsWith(".mp4") ||
    mediaUrl.endsWith(".webm") ||
    mediaUrl.endsWith(".ogg");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // ป้องกันการปิด Modal เมื่อคลิกที่เนื้อหา
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

// ----------------------------------------------------------------------
// --- Types & Helpers ---
// ----------------------------------------------------------------------

interface FollowedGroup {
  group_id: string;
}
interface OwnedGroup {
  id: string;
}

/** Helper: ดึง URL รูป Avatar กลุ่มจาก Storage */
const getGroupAvatarUrl = (avatarPath: string | null | undefined) => {
  const defaultUrl = "https://placehold.co/40x40?text=G";
  if (!avatarPath) return defaultUrl;
  if (avatarPath.startsWith("http")) return avatarPath;

  const { data } = supabase.storage.from("groups").getPublicUrl(avatarPath);
  return data.publicUrl || defaultUrl;
};

/** Helper: ดึง URL รูป Avatar ผู้ใช้จาก Storage */
const getProfileAvatarUrl = (avatarPath: string | null | undefined) => {
  const defaultUrl = "https://placehold.co/40x40?text=U";
  if (!avatarPath) return defaultUrl;
  if (avatarPath.startsWith("http")) return avatarPath;

  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
  return data.publicUrl || defaultUrl;
};

/** Interface สำหรับข้อมูลดิบที่ดึงมาจาก Supabase (รวม joins) */
interface PostFromSupabase {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  group_id: string;
  media_urls: string[] | null;
  likes: { user_id: string }[] | null;
  comments: { id: string }[] | null;
  // ข้อมูลกลุ่ม: รวม name, avatar_url, และ owner_id
  groups: { name: string; avatar_url: string | null; owner_id: string } | null;
  // ข้อมูลผู้โพสต์
  user: { username: string; avatar_url: string | null } | null;
}

/** Interface สำหรับ State ใน Client (ข้อมูลที่คำนวณแล้ว) */
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

// ----------------------------------------------------------------------
// --- Component หลัก: DashboardPage ---
// ----------------------------------------------------------------------
export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<SupabaseUser | null>(null); // ข้อมูลผู้ใช้
  const [posts, setPosts] = useState<Post[]>([]); // Feed โพสต์
  const [loading, setLoading] = useState(true);
  // ID โพสต์ที่ถูกเลือกเพื่อเปิด Modal คอมเมนต์
  const [activePostIdForComments, setActivePostIdForComments] =
    useState<string | null>(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");

  /** Helper: แปลง Path ใน Storage เป็น Public URL สำหรับ Post Media */
  const getPublicMediaUrl = (urlOrPath: string) => {
    if (!urlOrPath) return "https://placehold.co/128x128?text=No+Image";
    if (urlOrPath.startsWith("http")) return urlOrPath;

    const { data } = supabase.storage
      .from("post_media")
      .getPublicUrl(urlOrPath);

    return data.publicUrl || "https://placehold.co/128x128?text=No+Image";
  };

  /** Handler: เปิด Modal ดูรูปภาพขยาย */
  const handleImageClick = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };

  // ------------------ Effect: Fetch User (Authentication) ------------------
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login"); // Redirect ไปหน้า Login ถ้าไม่ได้ล็อกอิน
        return;
      }

      setUser(user as SupabaseUser);
    };

    getUser();
  }, [router]);

  // ------------------ Effect: Fetch Posts (Data Retrieval) ------------------
  useEffect(() => {
    if (!user) return; // รอจนกว่าจะดึงข้อมูล User ได้

    const fetchPosts = async () => {
      try {
        // 1. ดึง ID กลุ่มที่ติดตามและกลุ่มที่ตัวเองเป็นเจ้าของ
        const { data: followedGroups } = (await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)) as { data: FollowedGroup[] | null };
        const { data: ownedGroups } = (await supabase
          .from("groups")
          .select("id")
          .eq("owner_id", user.id)) as { data: OwnedGroup[] | null };
        
        // รวม ID กลุ่มทั้งหมด (ใช้ Set เพื่อให้ ID ไม่ซ้ำ)
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

        // 2. ดึงโพสต์จากกลุ่มทั้งหมดที่เกี่ยวข้อง
        const { data: postsData } = (await supabase
          .from("posts")
          .select(
            // Select ข้อมูลโพสต์, Likes, Comments, Groups, และ User
            `id, content, created_at, user_id, group_id, media_urls,
             likes(user_id), comments(id), groups(name, avatar_url, owner_id),
             user(username, avatar_url)`
          )
          .in("group_id", allGroupIds) // กรองตามกลุ่มทั้งหมด
          .order("created_at", { ascending: false })) as {
          data: PostFromSupabase[] | null;
        };

        // 3. Map และจัดรูปแบบข้อมูลสำหรับ UI
        const formattedPosts: Post[] =
          postsData?.map((post) => {
            // Logic เพื่อกำหนด Avatar/Name ที่จะแสดง
            const isOwnerPosting = post.user_id === post.groups?.owner_id;

            return {
              id: post.id,
              content: post.content,
              created_at: post.created_at,
              user_id: post.user_id,
              group_id: post.group_id,
              media_urls: post.media_urls,
              likesCount: post.likes?.length || 0,
              commentsCount: post.comments?.length || 0,
              // ตรวจสอบว่าผู้ใช้ปัจจุบันกด Like โพสต์นี้หรือไม่
              likedByUser:
                post.likes?.some((like) => like.user_id === user.id) || false,
              group_name: post.groups?.name || "กลุ่มไม่ทราบชื่อ",
              group_avatar_url: getGroupAvatarUrl(post.groups?.avatar_url),
              post_username: post.user?.username || "Unnamed User",
              post_user_avatar_url: getProfileAvatarUrl(post.user?.avatar_url),
              group_owner_id: post.groups?.owner_id || "", // ID เจ้าของกลุ่ม
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
  }, [user]); // Re-run เมื่อข้อมูล User ถูกโหลด

  // ------------------ Handlers ------------------

  /** Handler: Like Toggle (Optimistic Update) */
  const handleLikeToggle = async (postId: string, likedByUser: boolean) => {
    if (!user) return;

    // 1. Optimistic Update: อัปเดต UI ทันที
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
        // Un-Like: ลบแถว
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        // Like: เพิ่มแถว
        await supabase.from("likes").insert([{ post_id: postId, user_id: user.id }]);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      // 2. Rollback UI (ถ้าเกิด Error)
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

  /** Handler: Update Comment Count (Callback จาก Modal) */
  const updateCommentCount = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, commentsCount: p.commentsCount + 1 }
          : p
      )
    );
  };

  // ------------------ Render ------------------

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-sky-600" />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-20 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 text-center">
        Feed โพสต์ล่าสุด
      </h2>
      
      {/* Image Modal */}
      {showImageModal && (
        <MediaModal
          mediaUrl={modalImageUrl}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {posts.length === 0 ? (
        // Empty State: ไม่มีโพสต์
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <h2 className="text-gray-900 font-semibold">ยังไม่มีโพสต์</h2>
          <p className="text-gray-500 mt-1">
            โพสต์จากกลุ่มที่คุณติดตามจะแสดงที่นี่
          </p>
        </div>
      ) : (
        // แสดง Feed โพสต์
        <div className="grid gap-4">
          {posts.map((post) => {
            // Logic: ตรวจสอบว่าเป็นโพสต์จากแอดมินกลุ่ม (เจ้าของ) หรือไม่
            const isOwnerPosting = post.user_id === post.group_owner_id; 
            
            // กำหนด Avatar/Name ที่จะแสดง: ถ้าเป็นแอดมินโพสต์ ให้ใช้ชื่อ/รูปกลุ่ม
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
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {/* Avatar ผู้โพสต์/กลุ่ม */}
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
                      {/* ชื่อผู้โพสต์/กลุ่ม */}
                      <p className="font-bold text-gray-900">{nameDisplay}</p>
                      {/* ชื่อกลุ่มที่โพสต์ */}
                      <p className="text-xs text-gray-500">
                        {isOwnerPosting
                          ? "แอดมินกลุ่ม :" // ถ้าเป็นเจ้าของกลุ่มโพสต์
                          : "โพสต์ในกลุ่ม :"}
                        <Link href={`/groups/${post.group_id}`} className="font-medium text-sky-600 hover:text-sky-700 ml-1">
                          {post.group_name}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-400">
                        {/* แสดงวันที่ */}
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

                {/* Content */}
                <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* Media Display */}
                {post.media_urls?.length ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.media_urls.map((url, idx) => {
                      const publicUrl = getPublicMediaUrl(url);
                      const isVideo =
                        publicUrl.endsWith(".mp4") ||
                        publicUrl.endsWith(".webm");

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
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex gap-4 text-gray-500 text-sm pt-3 mt-4 border-t border-gray-100">
                  {/* Like Button */}
                  <button
                    onClick={() => handleLikeToggle(post.id, post.likedByUser)}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                      post.likedByUser ? "text-red-500" : "hover:text-red-400"
                    }`}
                  >
                    <Heart className="w-4 h-4 fill-current" />
                    {post.likesCount} ถูกใจ
                  </button>

                  {/* Comment Button (Modal Trigger) */}
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

      {/* Comment Modal (แสดงที่ Root Level) */}
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