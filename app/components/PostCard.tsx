"use client";

import Image from "next/image";
import type { PostWithUser, CommentWithUser } from "@/types/supabase";
import { supabase } from "@/lib/supabase/client";
import { useState, useRef, useEffect, ChangeEvent } from "react";
import { Heart, MessageSquare, UsersRound } from "lucide-react";

// ----------------------------------------------------------------------
// --- Component ย่อย: MediaModal (Modal แสดงรูปภาพ/วิดีโอขนาดใหญ่) ---
// ----------------------------------------------------------------------
const MediaModal = ({
  mediaUrl,
  onClose,
}: {
  mediaUrl: string;
  onClose: () => void;
}) => {
  if (!mediaUrl) return null;

  // ตรวจสอบว่าเป็นวิดีโอหรือไม่ (รองรับนามสกุลพื้นฐาน)
  const isVideo =
    mediaUrl.endsWith(".mp4") ||
    mediaUrl.endsWith(".webm") ||
    mediaUrl.endsWith(".ogg");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={onClose} // ปิด Modal เมื่อคลิกนอกเนื้อหา
    >
      <div
        // Parent Container: จำกัดขนาดและป้องกันการปิด Modal เมื่อคลิกที่เนื้อหา
        className="relative w-full max-w-4xl max-h-[90vh] h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          // แสดงวิดีโอ (ใช้แท็ก <video>)
          <video
            src={mediaUrl}
            controls
            className="w-full h-full max-h-[90vh] object-contain rounded-xl"
            autoPlay // เล่นอัตโนมัติเมื่อเปิด
          />
        ) : (
          // แสดงรูปภาพ (ใช้ Next.js Image เพื่อให้ยืดหยุ่น)
          <div className="relative w-full h-full max-h-[90vh]">
            <Image
              src={mediaUrl}
              alt="Full size media"
              className="object-contain" // แสดงทั้งรูป ไม่ถูกตัด
              fill
              sizes="90vw"
              unoptimized
            />
          </div>
        )}
      </div>
      {/* ปุ่มปิด Modal (x) */}
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
// --- กำหนด Props ของ Component หลัก ---
// ----------------------------------------------------------------------
interface PostCardProps {
  post: PostWithUser & {
    media_urls: string[];
    likes_count?: number;
    comments_count?: number;
    liked_by_user?: boolean;
    comments?: CommentWithUser[];
  };
  groupName: string;
  groupAvatar?: string | null;
  userId?: string | null; // ID ผู้ใช้งานปัจจุบัน
  onPostDeleted?: (postId: string) => void;
  onPostUpdated?: (updatedPost: PostWithUser) => void;
  groupOwnerId: string; // ID เจ้าของกลุ่ม
}

const COMMENTS_LIMIT = 3; // จำนวนคอมเมนต์ที่แสดงเริ่มต้น
const MEDIA_LIMIT = 5; // จำนวนรูปภาพที่แสดงเริ่มต้น

// ----------------------------------------------------------------------
// --- Component หลัก: PostCard ---
// ----------------------------------------------------------------------
export default function PostCard({
  post,
  groupName,
  groupAvatar,
  userId,
  onPostDeleted,
  onPostUpdated,
  groupOwnerId,
}: PostCardProps) {
  // --- State: การแสดงผลและการโต้ตอบพื้นฐาน ---
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null); // URL สื่อที่ถูกคลิกเพื่อเปิด Modal
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0); // จำนวนไลก์ปัจจุบัน
  const [likedByUser, setLikedByUser] = useState(post.liked_by_user || false); // สถานะว่าผู้ใช้ปัจจุบันกดไลก์หรือไม่
  const [comments, setComments] = useState<CommentWithUser[]>(
    post.comments || []
  ); // รายการคอมเมนต์
  const [newComment, setNewComment] = useState(""); // ข้อความในช่องคอมเมนต์ใหม่
  const [showAllComments, setShowAllComments] = useState(false); // สถานะแสดงคอมเมนต์ทั้งหมด
  const [showAllMedia, setShowAllMedia] = useState(false); // สถานะแสดงรูปภาพ/วิดีโอทั้งหมด

  // --- State: เมนูและการแก้ไข ---
  const [isMenuOpen, setIsMenuOpen] = useState(false); // สถานะเปิด/ปิดเมนูตัวเลือก
  const menuRef = useRef<HTMLDivElement>(null); // Ref สำหรับอ้างอิงเมนูเพื่อตรวจสอบการคลิกนอก
  const [isEditing, setIsEditing] = useState(false); // สถานะโหมดแก้ไข
  const [editedContent, setEditedContent] = useState(post.content || ""); // เนื้อหาที่กำลังแก้ไข
  const [isSaving, setIsSaving] = useState(false); // สถานะกำลังบันทึกการแก้ไข

  // --- State: จัดการไฟล์มีเดียในโหมดแก้ไข ---
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // ไฟล์ใหม่ที่เลือกเพื่ออัปโหลด
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); // URL Preview สำหรับไฟล์ใหม่
  const [existingMediaPaths, setExistingMediaPaths] = useState<string[]>([]); // Path ของไฟล์เดิมที่ยังคงอยู่
  const [existingMediaToDelete, setExistingMediaToDelete] = useState<string[]>(
    []
  ); // Path ของไฟล์เดิมที่ถูกทำเครื่องหมายให้ลบ

  // --- Effect: ปิดเมนูเมื่อคลิกพื้นที่ภายนอก (Outside Click Handler) ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  // --- Helper: แปลง Path/URL เป็น Public URL สำหรับ Avatar ---
  const getAvatarPublicUrl = (path: string | null | undefined) => {
    if (!path) return "https://via.placeholder.com/24";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    // ดึง Public URL จาก Supabase Storage bucket 'avatars'
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl || "https://via.placeholder.com/24";
  };

  // --- Helper: แปลง Path/URL เป็น Public URL สำหรับ Post Media ---
  const getPublicMediaUrl = (urlOrPath: string) => {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://"))
      return urlOrPath;
    // ดึง Public URL จาก Supabase Storage bucket 'post_media'
    const { data } = supabase.storage
      .from("post_media")
      .getPublicUrl(urlOrPath);
    return data.publicUrl || "https://via.placeholder.com/128";
  };

  // --- Logic: กำหนดข้อมูลส่วนหัวของโพสต์ (Avatar & Name) ---
  // ถ้าโพสต์มาจากเจ้าของกลุ่ม ให้แสดงชื่อและรูปกลุ่มแทน (Custom Logic)
  const isPostByOwner = post.user_id === groupOwnerId;
  const postUserAvatarUrl = getAvatarPublicUrl(post.user?.avatar_url);
  const postUsername = post.user?.username || "ผู้ใช้ไม่ทราบชื่อ";

  const headerAvatarUrl = isPostByOwner ? groupAvatar : postUserAvatarUrl;
  const headerUsername = isPostByOwner ? groupName : postUsername;

  // เตรียมข้อมูล Media สำหรับแสดงผล (แปลง Path เป็น Public URL ก่อน)
  const mediaUrls = post.media_urls.map(getPublicMediaUrl);
  // จำกัด/ไม่จำกัดจำนวน Media ที่จะแสดง
  const mediaToShow = showAllMedia
    ? mediaUrls
    : mediaUrls.slice(0, MEDIA_LIMIT);
  const remainingMediaCount = mediaUrls.length - MEDIA_LIMIT;

  // --- Handlers: จัดการ Modal รูปภาพและ Media Display ---
  const handleMediaClick = (url: string) => setSelectedMediaUrl(url); // เปิด Modal
  const handleCloseModal = () => setSelectedMediaUrl(null); // ปิด Modal
  const handleToggleMedia = () => setShowAllMedia((prev) => !prev); // สลับแสดง Media ทั้งหมด

  // --- Logic: การกดไลก์ (Like/Unlike) ---
  const handleLikeToggle = async () => {
    if (!userId) return; // ต้องล็อกอินก่อน

    // 1. Optimistic UI Update (อัปเดต State ทันที)
    setLikedByUser((prev) => !prev);
    setLikesCount((prev) => (likedByUser ? prev - 1 : prev + 1));

    try {
      if (likedByUser) {
        // Un-Like: ลบแถวในตาราง 'likes'
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", userId as string);
      } else {
        // Like: เพิ่มแถวในตาราง 'likes'
        await supabase
          .from("likes")
          .insert([{ post_id: post.id, user_id: userId as string }]);
      }
    } catch (err) {
      console.error("Error toggling like:", (err as Error).message);
      // 2. Rollback UI (ถ้าเกิด Error)
      setLikedByUser((prev) => !prev);
      setLikesCount((prev) => (likedByUser ? prev + 1 : prev - 1));
    }
  };

  // --- Logic: การเพิ่มคอมเมนต์ ---
  const handleAddComment = async () => {
    if (!userId || !newComment.trim()) return;
    try {
      // 1. บันทึกคอมเมนต์และดึง ID ที่สร้างขึ้นกลับมา
      const { data: insertedData, error: insertError } = await supabase
        .from("comments")
        .insert([
          {
            post_id: post.id,
            user_id: userId as string,
            content: newComment.trim(),
          },
        ])
        .select("id")
        .single();

      if (insertError || !insertedData)
        throw insertError || new Error("Insert empty");

      // 2. ดึงข้อมูลคอมเมนต์ที่บันทึกพร้อมข้อมูลผู้ใช้ (เพื่อแสดงผลทันที)
      const { data: commentWithUser, error: fetchError } = await supabase
        .from("comments")
        .select("*, user:user_id(id, username, avatar_url)")
        .eq("id", insertedData.id)
        .single<CommentWithUser>();

      if (fetchError || !commentWithUser) throw fetchError;

      // 3. อัปเดต State ของ comments และเคลียร์ช่องพิมพ์
      setComments((prev) => [...prev, commentWithUser]);
      setNewComment("");
    } catch (err) {
      console.error("Error adding comment:", (err as Error).message);
      alert("เพิ่มคอมเมนต์ไม่สำเร็จ");
    }
  };
  const handleToggleComments = () => setShowAllComments((prev) => !prev); // สลับแสดงคอมเมนต์ทั้งหมด

  // --- Logic: เริ่มการแก้ไขโพสต์ (Enter Edit Mode) ---
  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(post.content || "");
    setIsMenuOpen(false); // ปิดเมนู

    // แปลง Full URL (Public URL) กลับเป็น Path ใน Storage เพื่อจัดการ
    const currentPaths = post.media_urls
      .map((urlOrPath) => {
        if (
          urlOrPath.startsWith("http://") ||
          urlOrPath.startsWith("https://")
        ) {
          try {
            const url = new URL(urlOrPath);
            const pathSegment = `/post_media/`; // ชื่อ Bucket
            // ดึง Path ส่วนที่อยู่หลังชื่อ Bucket
            const path = url.pathname.split(pathSegment)[1];
            return path;
          } catch (e) {
            return urlOrPath;
          }
        }
        return urlOrPath; // ถ้าเป็น Path อยู่แล้ว
      })
      .filter(Boolean) as string[];

    setExistingMediaPaths(currentPaths); // กำหนด Path สื่อเดิม
    setSelectedFiles([]);
    setImagePreviews([]);
    setExistingMediaToDelete([]);
  };

  // --- Logic: ยกเลิกการแก้ไข ---
  const handleCancelEdit = () => {
    setIsEditing(false);
    // เคลียร์ค่าที่เกี่ยวข้องกับการอัปโหลด/แก้ไขไฟล์
    setSelectedFiles([]);
    imagePreviews.forEach(URL.revokeObjectURL); // ปล่อย Object URL
    setImagePreviews([]);
    setExistingMediaPaths([]);
    setExistingMediaToDelete([]);
  };

  // --- Logic: จัดการไฟล์ที่เลือกในโหมดแก้ไข ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]); // เพิ่มไฟล์ใหม่

      const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
      setImagePreviews((prev) => [...prev, ...newPreviews]); // สร้าง Preview URL
    }
  };

  const handleRemoveNewFile = (indexToRemove: number) => {
    // ลบไฟล์ที่เลือกใหม่
    URL.revokeObjectURL(imagePreviews[indexToRemove]); // ลบ Object URL ก่อน
    setSelectedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
    setImagePreviews((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleRemoveExistingMedia = (pathToRemove: string) => {
    // ทำเครื่องหมายไฟล์เดิมให้ถูกลบ
    setExistingMediaPaths((prev) =>
      prev.filter((path) => path !== pathToRemove)
    );
    setExistingMediaToDelete((prev) => [...prev, pathToRemove]); // เก็บ Path ไว้ลบจาก Storage ภายหลัง
  };

  // --- Logic: บันทึกการแก้ไข (Save Edit) ---
  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      let finalMediaUrls: string[] = [...existingMediaPaths]; // Path ที่เหลืออยู่

      // 1. ลบไฟล์เก่าออกจาก Storage (ที่ถูกทำเครื่องหมายให้ลบ)
      if (existingMediaToDelete.length > 0) {
        await supabase.storage
          .from("post_media")
          .remove(existingMediaToDelete);
      }

      // 2. อัปโหลดไฟล์ใหม่ (ถ้ามี)
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `posts/${uniqueName}`; // Path ใน Storage

          const { error } = await supabase.storage
            .from("post_media")
            .upload(filePath, file);
          if (error) throw error;
          return filePath; // คืนค่า Path ที่ใช้บันทึก
        });

        const newUploadedPaths = await Promise.all(uploadPromises);
        finalMediaUrls = [...finalMediaUrls, ...newUploadedPaths]; // รวม Path ใหม่เข้ากับ Path เดิมที่เหลืออยู่
      }

      // 3. อัปเดตข้อมูลใน Database
      const { data, error } = await supabase
        .from("posts")
        .update({
          content: editedContent.trim(),
          media_urls: finalMediaUrls, // ใช้ Path ใหม่ทั้งหมด
        })
        .eq("id", post.id)
        .select(
          // ดึงข้อมูลใหม่ทั้งหมดกลับมาเพื่ออัปเดต UI (รวมถึง likes/comments)
          "*, user:user_id(id, username, avatar_url, created_at), likes(user_id), comments(*, user:user_id(id, username, avatar_url))"
        )
        .single();

      if (error) throw error;

      // 4. อัปเดต State ผ่าน Callback ไปยัง Parent Component
      if (onPostUpdated && data) {
        // แปลงข้อมูลที่ได้จากการ SELECT กลับมาให้ตรงกับ Type
        const updatedPostWithCounts: PostWithUser = {
          ...data,
          likes_count: data.likes?.length || 0,
          liked_by_user: data.likes
            ? data.likes.some(
                (like: { user_id: string }) => like.user_id === userId
              )
            : false,
          comments: (data.comments as CommentWithUser[]) || [],
        };
        onPostUpdated(updatedPostWithCounts);
      }
      setIsEditing(false); // ออกจากโหมดแก้ไข
    } catch (err) {
      console.error("Error updating post:", (err as Error).message);
      alert("ไม่สามารถแก้ไขโพสต์ได้: " + (err as Error).message);
    } finally {
      setIsSaving(false);
      // เคลียร์ State ชั่วคราวทั้งหมด
      setSelectedFiles([]);
      imagePreviews.forEach(URL.revokeObjectURL);
      setImagePreviews([]);
      setExistingMediaPaths([]);
      setExistingMediaToDelete([]);
    }
  };

  // --- Logic: ลบโพสต์ (Delete) ---
  const handleDelete = async () => {
    setIsMenuOpen(false);
    if (!window.confirm("คุณต้องการลบโพสต์นี้จริงหรือไม่?")) return; // ยืนยันก่อนลบ

    try {
      const pathsToDelete: string[] = [];
      const bucketName = "post_media";

      // 1. แปลง Public URL กลับเป็น Path ใน Storage (เพื่อลบไฟล์)
      for (const urlOrPath of post.media_urls) {
        if (
          urlOrPath.startsWith("http://") ||
          urlOrPath.startsWith("https://")
        ) {
          try {
            const url = new URL(urlOrPath);
            const path = url.pathname.split(`/${bucketName}/`)[1];
            if (path) pathsToDelete.push(path);
          } catch (e) {
            console.warn("Invalid URL:", urlOrPath);
          }
        } else {
          pathsToDelete.push(urlOrPath);
        }
      }

      // 2. ลบไฟล์จาก Storage (ถ้ามี)
      if (pathsToDelete.length > 0) {
        await supabase.storage.from(bucketName).remove(pathsToDelete);
      }

      // 3. ลบข้อมูลจาก Database (การลบโพสต์จะทำให้ Likes/Comments ถูกลบตามไปด้วยถ้าตั้ง Foreign Key Cascading)
      const { error: dbError } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (dbError) throw dbError;

      // 4. แจ้ง Parent Component ว่าลบสำเร็จ
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Error deleting post:", (err as Error).message);
      alert("ไม่สามารถลบโพสต์ได้: " + (err as Error).message);
    }
  };

  // ----------------------------------------------------------------------
  // --- JSX (Return Statement) ---
  // ----------------------------------------------------------------------
  return (
    <div className="relative bg-white p-4 rounded-2xl shadow mb-2 border border-gray-200">
      {/* 1. Modal แสดงรูปภาพ (Rendered Conditionally) */}
      <MediaModal
        mediaUrl={selectedMediaUrl as string}
        onClose={handleCloseModal}
      />

      {/* 2. เมนูตัวเลือก (Edit/Delete) - แสดงเฉพาะเจ้าของโพสต์และเมื่อไม่อยู่ในโหมดแก้ไข */}
      {(userId === post.user_id || userId === groupOwnerId) && !isEditing && (
        <div ref={menuRef} className="absolute top-4 right-4 z-10">
          <button
            type="button"
            aria-label="ตัวเลือกเพิ่มเติม"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            {/* Icon จุดสามจุด */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-600"
            >
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>

          {isMenuOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px]">
              {userId === post.user_id && (
              <button
                type="button"
                onClick={handleEdit}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
              >
                ✏️ แก้ไขโพสต์
              </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                className={`block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 rounded-b-lg ${userId === post.user_id ? 'rounded-b-lg' : 'rounded-lg'}`}
              >
                🗑️ ลบโพสต์
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. ส่วนหัว: ข้อมูลผู้โพสต์ (User Post Header) */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
          {/* แสดง Avatar ของผู้โพสต์/กลุ่ม */}
          {headerAvatarUrl &&
          headerAvatarUrl !== "https://via.placeholder.com/24" ? (
            <Image
              src={headerAvatarUrl}
              alt={headerUsername || "Avatar"}
              width={40}
              height={40}
              className="object-cover"
              unoptimized
            />
          ) : (
            <UsersRound className="w-6 h-6 text-gray-500" />
          )}
        </div>
        <div className="flex flex-col">
          {/* ชื่อผู้ใช้/ชื่อกลุ่ม */}
          <span className="font-semibold">{headerUsername}</span>
          {/* วันที่และเวลาโพสต์ */}
          <span className="text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* 4. ส่วนเนื้อหาโพสต์ (Content & Media) */}
      {!isEditing ? (
        // --- โหมดแสดงผล (View Mode) ---
        <>
          {/* เนื้อหาข้อความ */}
          {post.content && (
            <p className="mb-2 whitespace-pre-wrap break-words">
              {post.content}
            </p>
          )}

          {/* Grid แสดงรูปภาพ/วิดีโอ */}
          {mediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {mediaToShow.map((url, i) => {
                // Logic สำหรับการจำกัดจำนวนการแสดงผล
                const isLastLimitedItem =
                  !showAllMedia &&
                  i === MEDIA_LIMIT - 1 &&
                  remainingMediaCount > 0;
                const isSingleMedia = mediaUrls.length === 1 && !showAllMedia;

                const mediaContainerClass = isSingleMedia
                  ? "relative w-full h-auto min-h-48 rounded-xl overflow-hidden cursor-pointer" // รูปเดียวขนาดใหญ่
                  : "relative w-32 h-32 rounded-xl overflow-hidden cursor-pointer bg-gray-100"; // หลายรูปขนาดเล็ก

                return (
                  <div
                    key={url}
                    className={mediaContainerClass}
                    onClick={() => handleMediaClick(url)}
                  >
                    {url.endsWith(".mp4") ? (
                      // แสดงวิดีโอ (ในโหมดพรีวิว)
                      <video
                        src={url}
                        controls={false}
                        className={`w-full h-full object-contain pointer-events-none ${
                          isSingleMedia ? "aspect-video" : ""
                        }`}
                      />
                    ) : (
                      // แสดงรูปภาพ (ในโหมดพรีวิว)
                      <Image
                        src={url}
                        fill
                        sizes={isSingleMedia ? "100vw" : "128px"}
                        className="object-contain" // แสดงทั้งรูป ไม่ถูกตัด
                        unoptimized
                        alt={""}
                      />
                    )}

                    {/* Overlay แสดงจำนวนรูปที่เหลือ (+N) */}
                    {isLastLimitedItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // ป้องกันการเปิด Modal
                          handleToggleMedia(); // สลับไปแสดงทั้งหมด
                        }}
                        className="absolute inset-0 bg-black bg-opacity-50 text-white font-bold text-lg flex items-center justify-center hover:bg-opacity-70 transition"
                      >
                        +{remainingMediaCount}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ปุ่มซ่อนรูปภาพ (แสดงเมื่อ ShowAllMedia เป็น true และมีรูปเกินขีดจำกัด) */}
          {showAllMedia && mediaUrls.length > MEDIA_LIMIT && (
            <button
              type="button"
              onClick={handleToggleMedia}
              className="text-sm text-sky-600 hover:text-sky-700 font-semibold mt-1 block"
            >
              ซ่อนรูปภาพ
            </button>
          )}
        </>
      ) : (
        // --- โหมดแก้ไข (Edit Mode) ---
        <div className="mb-2">
          {/* ช่องแก้ไขข้อความ */}
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm resize-y"
            rows={4}
            disabled={isSaving}
            autoFocus
          />

          {/* รายการรูปภาพเดิม (พร้อมปุ่มลบ) */}
          <div className="flex flex-wrap gap-2 my-2">
            {existingMediaPaths.map((path, i) => (
              <div
                key={`existing-${path}-${i}`}
                className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300"
              >
                {/* แสดงรูปภาพ/วิดีโอเดิม */}
                {path.endsWith(".mp4") ? (
                  <video
                    src={getPublicMediaUrl(path)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src={getPublicMediaUrl(path)}
                    alt={`Existing media ${i}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized
                  />
                )}
                {/* ปุ่มลบรูปภาพเดิม */}
                <button
                  type="button"
                  onClick={() => handleRemoveExistingMedia(path)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs z-10 hover:bg-red-700"
                  aria-label="ลบรูปภาพเก่า"
                  disabled={isSaving}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* ปุ่มเพิ่มรูปภาพใหม่ */}
          <div className="mt-4">
            <label
              htmlFor={`media-upload-edit-${post.id}`}
              className="cursor-pointer text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              เพิ่มรูปภาพ/วิดีโอ...
            </label>
            <input
              id={`media-upload-edit-${post.id}`}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isSaving}
            />
          </div>

          {/* พรีวิวรูปภาพใหม่ที่เลือก */}
          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {imagePreviews.map((previewUrl, i) => (
                <div
                  key={`new-preview-${i}`}
                  className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300"
                >
                  <Image
                    src={previewUrl}
                    alt={`New media preview ${i}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized
                  />
                  {/* ปุ่มลบรูปภาพที่เลือกใหม่ */}
                  <button
                    type="button"
                    onClick={() => handleRemoveNewFile(i)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs z-10 hover:bg-red-700"
                    aria-label="ลบรูปภาพที่เลือกใหม่"
                    disabled={isSaving}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ปุ่มบันทึก/ยกเลิก */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-100"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="bg-green-600 text-white px-3 py-1 rounded-lg disabled:opacity-50"
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* 5. ส่วน Footer (Likes & Comments) - ซ่อนเมื่อกำลังแก้ไข */}
      {!isEditing && (
        <>
          {/* แถบ Like/Comment Count */}
          <div className="flex gap-4 text-gray-500 text-sm pt-3 mt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleLikeToggle}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                likedByUser ? "text-red-500" : "hover:text-red-400"
              }`}
            >
              <Heart className="w-4 h-4 fill-current" /> {likesCount} ถูกใจ
            </button>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              {comments.length} ความคิดเห็น
            </span>
          </div>

          {/* แสดงรายการคอมเมนต์ */}
          {comments.length > 0 && (
            <div className="mt-2 space-y-1">
              {comments
                // จำกัดจำนวนคอมเมนต์ที่แสดงตาม State
                .slice(0, showAllComments ? comments.length : COMMENTS_LIMIT)
                .map((c) => {
                  // Logic: ถ้าเจ้าของกลุ่มมาเม้นต์ ให้ใช้รูปและชื่อกลุ่ม
                  const isOwnerCommenting = c.user?.id === groupOwnerId;
                  const avatarToShow = isOwnerCommenting
                    ? groupAvatar
                    : getAvatarPublicUrl(c.user?.avatar_url);

                  const nameToShow = isOwnerCommenting
                    ? groupName
                    : c.user?.username || "ผู้ใช้";

                  const fallbackAvatar = "https://via.placeholder.com/24";

                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden">
                        <Image
                          src={avatarToShow || fallbackAvatar}
                          alt={nameToShow || "Avatar"}
                          width={24}
                          height={24}
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="bg-gray-100 px-2 py-1 rounded-lg text-sm break-words">
                        <span className="font-semibold">{nameToShow}</span>:{" "}
                        {c.content}
                      </div>
                    </div>
                  );
                })}

              {/* ปุ่มดูเพิ่มเติม/ซ่อน */}
              {comments.length > COMMENTS_LIMIT && (
                <button
                  type="button"
                  onClick={handleToggleComments}
                  className="text-xs text-sky-600 hover:text-sky-700 font-semibold mt-1 block"
                >
                  {showAllComments
                    ? "ซ่อนความคิดเห็น"
                    : `ดูเพิ่มเติม ${
                        comments.length - COMMENTS_LIMIT
                      } ความคิดเห็น...`}
                </button>
              )}
            </div>
          )}

          {/* ช่องพิมพ์คอมเมนต์ */}
          {userId && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newComment}
                // กด Enter เพื่อส่งคอมเมนต์
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="เพิ่มความคิดเห็น..."
                className="flex-1 border rounded-lg px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="px-3 py-1 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition disabled:opacity-50 hover:scale-105 cursor-pointer"
              >
                ส่ง
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}