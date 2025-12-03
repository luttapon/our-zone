"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import Image from "next/image";
import type { PostWithUser, CommentWithUser } from "@/types/supabase";
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { useState, useRef, useEffect, ChangeEvent } from "react";
import { Heart, MessageSquare, UsersRound } from "lucide-react"; // ไอคอนต่างๆ

// ====================================================================
// Component ย่อย: MediaModal (หน้าต่างแสดงรูป/วิดีโอขนาดใหญ่)
// ====================================================================

const MediaModal = ({
  mediaUrl,
  onClose,
}: {
  mediaUrl: string;
  onClose: () => void;
}) => {
  if (!mediaUrl) return null; // ถ้าไม่มี URL ไม่ต้องแสดง

  // ตรวจสอบว่าเป็นไฟล์วิดีโอหรือไม่
  const isVideo =
    mediaUrl.endsWith(".mp4") ||
    mediaUrl.endsWith(".webm") ||
    mediaUrl.endsWith(".ogg");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={onClose} // คลิกพื้นที่ว่างเพื่อปิด
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
      {/* ปุ่มกากบาทปิด Modal */}
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
// ส่วนกำหนดรูปแบบข้อมูล (Interfaces & Constants)
// ====================================================================

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
  userId?: string | null; // ID ผู้ใช้ปัจจุบัน
  onPostDeleted?: (postId: string) => void;
  onPostUpdated?: (updatedPost: PostWithUser) => void;
  groupOwnerId: string; // ID เจ้าของกลุ่ม
}

const COMMENTS_LIMIT = 3; // จำนวนคอมเมนต์ที่แสดงเริ่มต้น
const MEDIA_LIMIT = 5;    // จำนวนรูปภาพที่แสดงเริ่มต้น

// ====================================================================
// Component หลัก: การ์ดโพสต์ (PostCard)
// ====================================================================

export default function PostCard({
  post,
  groupName,
  groupAvatar,
  userId,
  onPostDeleted,
  onPostUpdated,
  groupOwnerId,
}: PostCardProps) {
  
  // --- 1. การจัดการข้อมูล (State) ---

  // State สำหรับการแสดงผลทั่วไป
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null); // URL รูปที่เปิดดูเต็มจอ
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);           // จำนวนไลก์
  const [likedByUser, setLikedByUser] = useState(post.liked_by_user || false);   // สถานะกดไลก์
  const [comments, setComments] = useState<CommentWithUser[]>(post.comments || []); // รายการคอมเมนต์
  const [newComment, setNewComment] = useState("");                              // ข้อความคอมเมนต์ใหม่
  const [showAllComments, setShowAllComments] = useState(false);                 // ดูคอมเมนต์ทั้งหมดไหม
  const [showAllMedia, setShowAllMedia] = useState(false);                       // ดูรูปทั้งหมดไหม

  // State สำหรับเมนูและการแก้ไข
  const [isMenuOpen, setIsMenuOpen] = useState(false);  // เปิดเมนูตัวเลือกไหม (จุดสามจุด)
  const menuRef = useRef<HTMLDivElement>(null);         // ตัวอ้างอิงตำแหน่งเมนู
  const [isEditing, setIsEditing] = useState(false);    // อยู่ในโหมดแก้ไขไหม
  const [editedContent, setEditedContent] = useState(post.content || ""); // เนื้อหาที่กำลังแก้ไข
  const [isSaving, setIsSaving] = useState(false);      // กำลังบันทึกการแก้ไขไหม

  // State สำหรับจัดการไฟล์ในโหมดแก้ไข
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);    // ไฟล์ใหม่ที่เลือกเพิ่ม
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);  // ตัวอย่างรูปใหม่
  const [existingMediaPaths, setExistingMediaPaths] = useState<string[]>([]); // รูปเดิมที่ยังอยู่
  const [existingMediaToDelete, setExistingMediaToDelete] = useState<string[]>([]); // รูปเดิมที่ต้องการลบ

  // --- 2. Effect & Helpers ---

  // ปิดเมนูเมื่อคลิกพื้นที่ด้านนอก
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

  // ฟังก์ชันแปลง Path รูปโปรไฟล์เป็น URL
  const getAvatarPublicUrl = (path: string | null | undefined) => {
    if (!path) return "https://via.placeholder.com/24";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl || "https://via.placeholder.com/24";
  };

  // ฟังก์ชันแปลง Path รูปโพสต์เป็น URL
  const getPublicMediaUrl = (urlOrPath: string) => {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://"))
      return urlOrPath;
    const { data } = supabase.storage.from("post_media").getPublicUrl(urlOrPath);
    return data.publicUrl || "https://via.placeholder.com/128";
  };

  // --- 3. เตรียมข้อมูลแสดงผล (Render Logic) ---

  // ตรวจสอบว่าใครเป็นคนโพสต์ (ถ้าเป็นเจ้าของกลุ่ม ให้แสดงในนามกลุ่ม)
  const isPostByOwner = post.user_id === groupOwnerId;
  const postUserAvatarUrl = getAvatarPublicUrl(post.user?.avatar_url);
  const postUsername = post.user?.username || "ผู้ใช้ไม่ทราบชื่อ";

  const headerAvatarUrl = isPostByOwner ? groupAvatar : postUserAvatarUrl;
  const headerUsername = isPostByOwner ? groupName : postUsername;

  // เตรียมรายการรูปภาพ/วิดีโอ
  const mediaUrls = post.media_urls.map(getPublicMediaUrl);
  // ตัดแบ่งจำนวนรูปที่จะแสดง
  const mediaToShow = showAllMedia
    ? mediaUrls
    : mediaUrls.slice(0, MEDIA_LIMIT);
  const remainingMediaCount = mediaUrls.length - MEDIA_LIMIT;

  // --- 4. ฟังก์ชันจัดการเหตุการณ์ (Handlers) ---

  // เปิด/ปิด Modal รูปภาพ
  const handleMediaClick = (url: string) => setSelectedMediaUrl(url);
  const handleCloseModal = () => setSelectedMediaUrl(null);
  const handleToggleMedia = () => setShowAllMedia((prev) => !prev);

  // การกดไลก์ (Like Toggle)
  const handleLikeToggle = async () => {
    if (!userId) return;

    // อัปเดตหน้าจอทันที (Optimistic Update) เพื่อความลื่นไหล
    setLikedByUser((prev) => !prev);
    setLikesCount((prev) => (likedByUser ? prev - 1 : prev + 1));

    try {
      if (likedByUser) {
        // ถ้าเคยไลก์แล้ว -> ลบไลก์ออก
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", userId as string);
      } else {
        // ถ้ายังไม่ไลก์ -> เพิ่มไลก์
        await supabase
          .from("likes")
          .insert([{ post_id: post.id, user_id: userId as string }]);
      }
    } catch (err) {
      console.error("Error toggling like:", (err as Error).message);
      // ถ้า Error ให้ย้อนค่ากลับ (Rollback)
      setLikedByUser((prev) => !prev);
      setLikesCount((prev) => (likedByUser ? prev + 1 : prev - 1));
    }
  };

  // การเพิ่มคอมเมนต์
  const handleAddComment = async () => {
    if (!userId || !newComment.trim()) return;
    try {
      // บันทึกคอมเมนต์ลง DB
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

      if (insertError || !insertedData) throw insertError || new Error("Insert empty");

      // ดึงข้อมูลคอมเมนต์ที่เพิ่งสร้างพร้อมข้อมูลผู้ใช้
      const { data: commentWithUser, error: fetchError } = await supabase
        .from("comments")
        .select("*, user:user_id(id, username, avatar_url)")
        .eq("id", insertedData.id)
        .single<CommentWithUser>();

      if (fetchError || !commentWithUser) throw fetchError;

      // อัปเดต State
      setComments((prev) => [...prev, commentWithUser]);
      setNewComment(""); // ล้างช่องพิมพ์
    } catch (err) {
      console.error("Error adding comment:", (err as Error).message);
      alert("เพิ่มคอมเมนต์ไม่สำเร็จ");
    }
  };
  
  const handleToggleComments = () => setShowAllComments((prev) => !prev);

  // เริ่มแก้ไขโพสต์
  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(post.content || "");
    setIsMenuOpen(false);

    // แปลง URL กลับเป็น Path เพื่อจัดการไฟล์
    const currentPaths = post.media_urls
      .map((urlOrPath) => {
        if (
          urlOrPath.startsWith("http://") ||
          urlOrPath.startsWith("https://")
        ) {
          try {
            const url = new URL(urlOrPath);
            const pathSegment = `/post_media/`;
            const path = url.pathname.split(pathSegment)[1];
            return path;
          } catch (e) {
            return urlOrPath;
          }
        }
        return urlOrPath;
      })
      .filter(Boolean) as string[];

    setExistingMediaPaths(currentPaths);
    setSelectedFiles([]);
    setImagePreviews([]);
    setExistingMediaToDelete([]);
  };

  // ยกเลิกแก้ไข
  const handleCancelEdit = () => {
    setIsEditing(false);
    // ล้างค่าชั่วคราวทั้งหมด
    setSelectedFiles([]);
    imagePreviews.forEach(URL.revokeObjectURL);
    setImagePreviews([]);
    setExistingMediaPaths([]);
    setExistingMediaToDelete([]);
  };

  // จัดการไฟล์ในโหมดแก้ไข (เลือกเพิ่ม)
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);

      const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  // ลบไฟล์ใหม่ที่เพิ่งเลือก
  const handleRemoveNewFile = (indexToRemove: number) => {
    URL.revokeObjectURL(imagePreviews[indexToRemove]);
    setSelectedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
    setImagePreviews((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  // ลบไฟล์เดิมที่มีอยู่แล้ว
  const handleRemoveExistingMedia = (pathToRemove: string) => {
    setExistingMediaPaths((prev) =>
      prev.filter((path) => path !== pathToRemove)
    );
    // เก็บ Path ไว้ลบออกจาก Storage จริงๆ ตอนกดบันทึก
    setExistingMediaToDelete((prev) => [...prev, pathToRemove]);
  };

  // บันทึกการแก้ไข (Save Edit)
  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      let finalMediaUrls: string[] = [...existingMediaPaths];

      // 1. ลบไฟล์เก่าออกจาก Storage
      if (existingMediaToDelete.length > 0) {
        await supabase.storage
          .from("post_media")
          .remove(existingMediaToDelete);
      }

      // 2. อัปโหลดไฟล์ใหม่
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `posts/${uniqueName}`;

          const { error } = await supabase.storage
            .from("post_media")
            .upload(filePath, file);
          if (error) throw error;
          return filePath;
        });

        const newUploadedPaths = await Promise.all(uploadPromises);
        finalMediaUrls = [...finalMediaUrls, ...newUploadedPaths];
      }

      // 3. อัปเดตข้อมูลใน Database
      const { data, error } = await supabase
        .from("posts")
        .update({
          content: editedContent.trim(),
          media_urls: finalMediaUrls,
        })
        .eq("id", post.id)
        .select(
          "*, user:user_id(id, username, avatar_url, created_at), likes(user_id), comments(*, user:user_id(id, username, avatar_url))"
        )
        .single();

      if (error) throw error;

      // 4. แจ้ง Component แม่ว่าอัปเดตแล้ว
      if (onPostUpdated && data) {
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
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating post:", (err as Error).message);
      alert("ไม่สามารถแก้ไขโพสต์ได้: " + (err as Error).message);
    } finally {
      setIsSaving(false);
      // ล้างค่าชั่วคราว
      setSelectedFiles([]);
      imagePreviews.forEach(URL.revokeObjectURL);
      setImagePreviews([]);
      setExistingMediaPaths([]);
      setExistingMediaToDelete([]);
    }
  };

  // ลบโพสต์ (Delete)
  const handleDelete = async () => {
    setIsMenuOpen(false);
    if (!window.confirm("คุณต้องการลบโพสต์นี้จริงหรือไม่?")) return;

    try {
      const pathsToDelete: string[] = [];
      const bucketName = "post_media";

      // เตรียมรายการไฟล์ที่ต้องลบจาก Storage
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

      // 1. ลบไฟล์จาก Storage
      if (pathsToDelete.length > 0) {
        await supabase.storage.from(bucketName).remove(pathsToDelete);
      }

      // 2. ลบข้อมูลจาก Database
      const { error: dbError } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (dbError) throw dbError;

      // 3. แจ้ง Component แม่
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Error deleting post:", (err as Error).message);
      alert("ไม่สามารถลบโพสต์ได้: " + (err as Error).message);
    }
  };

  // --- 5. ส่วนแสดงผลหน้าจอ (JSX) ---
  return (
    <div className="relative bg-white p-4 rounded-2xl shadow mb-2 border border-gray-200">
      
      {/* 1. Modal แสดงรูปภาพ (ถ้ามีเลือกอยู่) */}
      <MediaModal
        mediaUrl={selectedMediaUrl as string}
        onClose={handleCloseModal}
      />

      {/* 2. เมนูตัวเลือก (จุดสามจุด) - แสดงเฉพาะเจ้าของโพสต์/กลุ่ม */}
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

      {/* 3. ส่วนหัวโพสต์ (Avatar & Name) */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
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
          <span className="font-semibold">{headerUsername}</span>
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

      {/* 4. เนื้อหาโพสต์ (Content) */}
      {!isEditing ? (
        // --- โหมดแสดงผลปกติ (View) ---
        <>
          {/* ข้อความ */}
          {post.content && (
            <p className="mb-2 whitespace-pre-wrap break-words">
              {post.content}
            </p>
          )}

          {/* รูปภาพ/วิดีโอ */}
          {mediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {mediaToShow.map((url, i) => {
                // คำนวณการแสดง Overlay (+N)
                const isLastLimitedItem =
                  !showAllMedia &&
                  i === MEDIA_LIMIT - 1 &&
                  remainingMediaCount > 0;
                const isSingleMedia = mediaUrls.length === 1 && !showAllMedia;

                const mediaContainerClass = isSingleMedia
                  ? "relative w-full h-auto min-h-48 rounded-xl overflow-hidden cursor-pointer"
                  : "relative w-32 h-32 rounded-xl overflow-hidden cursor-pointer bg-gray-100";

                return (
                  <div
                    key={url}
                    className={mediaContainerClass}
                    onClick={() => handleMediaClick(url)}
                  >
                    {url.endsWith(".mp4") ? (
                      <video
                        src={url}
                        controls={false}
                        className={`w-full h-full object-contain pointer-events-none ${
                          isSingleMedia ? "aspect-video" : ""
                        }`}
                      />
                    ) : (
                      <Image
                        src={url}
                        fill
                        sizes={isSingleMedia ? "100vw" : "128px"}
                        className="object-contain"
                        unoptimized
                        alt={""}
                      />
                    )}

                    {/* Overlay แสดงจำนวนรูปที่เหลือ */}
                    {isLastLimitedItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMedia();
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

          {/* ปุ่มซ่อนรูป (ถ้าแสดงครบแล้ว) */}
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
        // --- โหมดแก้ไข (Edit) ---
        <div className="mb-2">
          {/* แก้ไขข้อความ */}
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm resize-y"
            rows={4}
            disabled={isSaving}
            autoFocus
          />

          {/* จัดการรูปเดิม */}
          <div className="flex flex-wrap gap-2 my-2">
            {existingMediaPaths.map((path, i) => (
              <div
                key={`existing-${path}-${i}`}
                className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300"
              >
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
                {/* ปุ่มลบรูปเดิม */}
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

          {/* ปุ่มเพิ่มรูปใหม่ */}
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

          {/* พรีวิวรูปใหม่ */}
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

      {/* 5. ส่วน Footer (Likes & Comments) */}
      {!isEditing && (
        <>
          <div className="flex gap-4 text-gray-500 text-sm pt-3 mt-4 border-t border-gray-100">
            {/* ปุ่มกด Like */}
            <button
              type="button"
              onClick={handleLikeToggle}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                likedByUser ? "text-red-500" : "hover:text-red-400"
              }`}
            >
              <Heart className="w-4 h-4 fill-current" /> {likesCount} ถูกใจ
            </button>
            
            {/* แสดงจำนวนคอมเมนต์ */}
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              {comments.length} ความคิดเห็น
            </span>
          </div>

          {/* รายการคอมเมนต์ */}
          {comments.length > 0 && (
            <div className="mt-2 space-y-1">
              {comments
                .slice(0, showAllComments ? comments.length : COMMENTS_LIMIT)
                .map((c) => {
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

              {/* ปุ่มดูคอมเมนต์เพิ่มเติม */}
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