"use client";

import Image from "next/image";
import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Edit3,
  LogOut,
  User as UserIcon,
  Heart,
  MessageSquare,
} from "lucide-react";
// นำเข้า Modal คอมเมนต์
import ProfileCommentModal from "@/app/components/ProfileCommentModal";

// ----------------------------------------------------------------------
// --- Component ย่อย: MediaModal (แสดงรูปภาพ/วิดีโอขนาดใหญ่) ---
// (ย้าย MediaModal เข้ามาใน Component หลักเพื่อให้เข้าถึง State ได้ง่าย หรือจะคงไว้ด้านนอกก็ได้)
// (ในที่นี้ขอย้ายไปรวมกับ Component หลัก เพื่อไม่ให้เกิดการเรียกซ้ำซ้อนใน JSX)
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูล (Interfaces) ---
// ----------------------------------------------------------------------
interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null; // Path ใน Storage
  cover_url: string | null; // Path ใน Storage
}

// โครงสร้างโพสต์ที่ดึงมาจากฐานข้อมูล (รวม Join data)
interface PostWithJoins {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  group_id: string;
  media_urls: string[] | null;
  likes: { user_id: string }[] | null;
  comments: { id: string }[] | null;
}

// โครงสร้างโพสต์สำหรับแสดงผลใน UI (แปลง Likes/Comments เป็น Count/Boolean)
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
}

// ----------------------------------------------------------------------
// --- Component หลัก: Page (หน้าโปรไฟล์) ---
// ----------------------------------------------------------------------
export default function Page() {
  const router = useRouter();

  // --- State: สถานะการโหลดและข้อมูลผู้ใช้ ---
  const [loading, setLoading] = useState(true); // โหลดหน้าหลัก
  const [saving, setSaving] = useState(false); // กำลังบันทึกโปรไฟล์
  const [user, setUser] = useState<SupabaseUser | null>(null); // ข้อมูล User จาก Supabase Auth
  const [profile, setProfile] = useState<Profile | null>(null); // ข้อมูล Profile จากตาราง user

  // --- State: การแก้ไขโปรไฟล์ ---
  const [isEditing, setIsEditing] = useState(false); // โหมดแก้ไข
  const [usernameEdit, setUsernameEdit] = useState(""); // ชื่อผู้ใช้ที่กำลังแก้ไข
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // ไฟล์ Avatar ใหม่
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); // Preview Avatar URL (Object URL)
  const [avatarPublicUrl, setAvatarPublicUrl] = useState<string | null>(null); // Public URL Avatar ปัจจุบัน
  const [coverFile, setCoverFile] = useState<File | null>(null); // ไฟล์ Cover ใหม่
  const [coverPreview, setCoverPreview] = useState<string | null>(null); // Preview Cover URL (Object URL)
  const [coverPublicUrl, setCoverPublicUrl] = useState<string | null>(null); // Public URL Cover ปัจจุบัน
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null); // ข้อความแจ้งเตือน

  // --- State: รายการโพสต์และกลุ่ม ---
  const [posts, setPosts] = useState<Post[]>([]); // โพสต์ของผู้ใช้
  // ID ของโพสต์ที่ถูกเลือกเพื่อเปิด Modal คอมเมนต์
  const [activePostIdForComments, setActivePostIdForComments] =
    useState<string | null>(null);
  // แผนที่ Group ID -> { id, name } สำหรับแสดงชื่อกลุ่มในโพสต์
  const [groupsMap, setGroupsMap] = useState<
    Record<string, { id: string; name: string }>
  >({});

  // --- State: Modal แสดงรูปภาพขยาย ---
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");

  // --- Helper: เปิด Modal ดูรูปภาพขนาดใหญ่ ---
  const handleImageClick = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };

  // --- Helper: แปลง Path รูปภาพเป็น Public URL (สำหรับสื่อในโพสต์) ---
  const getPublicMediaUrl = (urlOrPath: string) => {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://"))
      return urlOrPath;
    const { data } = supabase.storage
      .from("post_media")
      .getPublicUrl(urlOrPath);
    return data.publicUrl || "https://placehold.co/128x128?text=No+Image";
  };

  // --- Data Fetching: ดึงข้อมูลโปรไฟล์ ---
  const fetchProfile = async (authUser: SupabaseUser) => {
    const { data, error } = await supabase
      .from("user")
      .select("id, username, avatar_url, cover_url")
      .eq("id", authUser.id)
      .single<Profile>();

    if (error || !data) {
      setMessage({ text: "ไม่สามารถโหลดโปรไฟล์ได้", type: "error" });
      return;
    }

    setProfile(data);
    setUsernameEdit(data.username || "");

    // เตรียม URL รูปภาพ
    if (data.avatar_url)
      setAvatarPublicUrl(
        supabase.storage.from("avatars").getPublicUrl(data.avatar_url).data
          .publicUrl
      );
    if (data.cover_url)
      setCoverPublicUrl(
        supabase.storage.from("avatars").getPublicUrl(data.cover_url).data
          .publicUrl
      );
  };

  // --- Data Fetching: ดึงข้อมูลโพสต์ของผู้ใช้ ---
  const fetchPosts = async (userId: string) => {
    // 1. ดึงโพสต์พร้อม Likes/Comments/Groups
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, content, created_at, user_id, group_id, media_urls, likes(user_id), comments(id)"
      )
      .eq("user_id", userId) // ดึงเฉพาะโพสต์ของ User นี้
      .order("created_at", { ascending: false }); // ล่าสุดอยู่บน

    if (!error && data) {
      const rawPosts = data as PostWithJoins[];

      // 2. ดึงชื่อกลุ่มที่เกี่ยวข้องทั้งหมดมาเก็บไว้ใน Map
      const groupIds = Array.from(new Set(rawPosts.map((p) => p.group_id)));
      const { data: groupData } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", groupIds);

      const map: Record<string, { id: string; name: string }> = {};
      groupData?.forEach((g) => (map[g.id] = { id: g.id, name: g.name }));
      setGroupsMap(map);

      // 3. แปลงข้อมูลโพสต์ให้อยู่ในรูปแบบที่พร้อมแสดงผล
      const formattedPosts: Post[] = rawPosts.map((post) => ({
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        user_id: post.user_id,
        group_id: post.group_id,
        media_urls: post.media_urls,
        likesCount: post.likes?.length || 0,
        commentsCount: post.comments?.length || 0,
        likedByUser:
          post.likes?.some((like) => like.user_id === userId) || false,
      }));
      setPosts(formattedPosts);
    }
  };

  // --- Effect: ตรวจสอบ Session และโหลดข้อมูลเริ่มต้น ---
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        await fetchProfile(user);
        await fetchPosts(user.id);
      } else {
        // ถ้าไม่มี User ให้ Redirect ไปหน้า Login
        router.push("/login");
      }
      setLoading(false);
    };
    checkUser();
    // Cleanup function: ปล่อย Object URLs เมื่อ Component ถูกทำลาย
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [router, avatarPreview, coverPreview]); // เพิ่ม dependencies ที่เหมาะสม

  // --- Handlers: การกด Like (Optimistic Update) ---
  const handleProfileLikeToggle = async (postId: string, isLiked: boolean) => {
    if (!user) return;

    // 1. Optimistic Update: อัปเดตหน้าจอทันทีก่อนยิง API
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByUser: !isLiked, // สลับสถานะ Like
              likesCount: isLiked ? p.likesCount - 1 : p.likesCount + 1, // เพิ่ม/ลด Count
            }
          : p
      )
    );

    try {
      if (isLiked)
        // Un-Like
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      else
        // Like
        await supabase.from("likes").insert([{ post_id: postId, user_id: user.id }]);
    } catch {
      // 2. หาก error ให้ Rollback UI (ย้อนค่ากลับ)
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByUser: isLiked,
                likesCount: isLiked ? p.likesCount + 1 : p.likesCount - 1,
              }
            : p
        )
      );
    }
  };

  // --- Callback: อัปเดตจำนวนคอมเมนต์หลังมีการเพิ่ม (จาก Modal) ---
  const updateCommentCount = (postId: string) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      )
    );
  };

  // --- Handlers: การเลือกไฟล์รูปภาพ (Avatar/Cover) ---
  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAvatarFile(e.target.files[0]);
      // สร้าง Object URL สำหรับ Preview และทำลาย Preview เก่าถ้ามี
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleCoverFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setCoverFile(e.target.files[0]);
      // สร้าง Object URL สำหรับ Preview และทำลาย Preview เก่าถ้ามี
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  // --- Handlers: ยกเลิกการแก้ไข ---
  const handleCancelEdit = () => {
    setIsEditing(false);
    // เคลียร์ไฟล์/Preview ที่เลือกไว้
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    setCoverFile(null);
    setCoverPreview(null);
    // คืนค่าชื่อผู้ใช้เป็นค่าเดิม
    if (profile) setUsernameEdit(profile.username || "");
    setMessage(null);
  };

  // --- Handlers: ออกจากระบบ ---
  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  // --- Handlers: บันทึกข้อมูลโปรไฟล์ (รูปภาพ + ชื่อ) ---
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setMessage(null);

    let newAvatarPath = profile.avatar_url;
    let newCoverPath = profile.cover_url;

    try {
      // 1. อัปโหลดรูป Avatar (ถ้ามีการเปลี่ยน)
      if (avatarFile) {
        // ลบรูปเก่าก่อน (ถ้ามี)
        if (profile.avatar_url) {
          await supabase.storage.from("avatars").remove([profile.avatar_url]);
        }
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}/profile/avatar-${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile);
        if (error) throw error;
        newAvatarPath = data.path; // Path ใหม่

        // ดึง Public URL มาอัปเดต UI ทันที
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(newAvatarPath);
        setAvatarPublicUrl(urlData.publicUrl);
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }

      // 2. อัปโหลดรูป Cover (ถ้ามีการเปลี่ยน)
      if (coverFile) {
        if (profile.cover_url) {
          await supabase.storage.from("avatars").remove([profile.cover_url]);
        }
        const ext = coverFile.name.split(".").pop();
        const path = `${user.id}/cover/cover-${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage
          .from("avatars")
          .upload(path, coverFile);
        if (error) throw error;
        newCoverPath = data.path;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(newCoverPath);
        setCoverPublicUrl(urlData.publicUrl);
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        setCoverPreview(null);
      }

      // 3. อัปเดตข้อมูล Text ในฐานข้อมูล
      const { error } = await supabase
        .from("user")
        .update({
          username: usernameEdit,
          avatar_url: newAvatarPath,
          cover_url: newCoverPath,
        })
        .eq("id", user.id);

      if (error) throw error;

      // 4. อัปเดต Profile State ด้วยข้อมูลใหม่
      setProfile((prev) => ({
        ...prev!,
        username: usernameEdit,
        avatar_url: newAvatarPath,
        cover_url: newCoverPath,
      }));

      setIsEditing(false);
      setMessage({ text: "บันทึกโปรไฟล์สำเร็จ", type: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setMessage({ text: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // --- Render: หน้า Loading ---
  if (loading)
    return (
      <div className="flex flex-col gap-2 justify-center items-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-sky-600" />
        <p className="text-sm text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
      </div>
    );

  // --- Render: กรณีไม่พบข้อมูล ---
  if (!profile || !user)
    return <div className="text-center mt-20 text-gray-500">ไม่พบผู้ใช้</div>;

  // --- กำหนด URL สำหรับแสดงผล ---
  const displayAvatarUrl = avatarPreview || avatarPublicUrl;

  // กำหนด Placeholder สำหรับ Cover
  const DEFAULT_COVER =
    "https://placehold.co/1200x400/e2e8f0/94a3b8?text=No+Cover";
  const displayCoverUrl = coverPreview || coverPublicUrl || DEFAULT_COVER;


  // --- MediaModal Component (ย้ายมาไว้ตรงนี้ เพื่อลดความซ้ำซ้อนใน JSX) ---
  const ProfileMediaModal = ({
    mediaUrl,
    onClose,
  }: {
    mediaUrl: string;
    onClose: () => void;
  }) => {
    if (!mediaUrl) return null;
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
          onClick={(e) => e.stopPropagation()}
        >
          {isVideo ? (
            <video
              src={mediaUrl}
              controls
              className="w-full h-full max-h-[90vh] object-contain rounded-xl"
              autoPlay
            />
          ) : (
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
        {/* ปุ่มปิดมุมขวาบน */}
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


  // --- Render: หน้าโปรไฟล์หลัก ---
  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 ">
      
      {/* Modal แสดงรูปภาพขยาย (Image Modal) */}
      {showImageModal && (
        <ProfileMediaModal
          mediaUrl={modalImageUrl}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {/* 1. ส่วน Header (Cover + Avatar + ข้อมูลส่วนตัว) */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto">
          {/* รูปหน้าปก */}
          <div
            className={`relative h-48 md:h-72 w-full bg-gray-200 overflow-hidden group ${
              displayCoverUrl !== DEFAULT_COVER ? "cursor-pointer" : ""
            }`}
            onClick={() =>
              displayCoverUrl !== DEFAULT_COVER &&
              handleImageClick(displayCoverUrl)
            }
          >
            <Image
              src={displayCoverUrl}
              alt="Cover"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-50" />
            {displayCoverUrl !== DEFAULT_COVER && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  คลิกเพื่อดูรูป
                </span>
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            <div className="relative flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 gap-6">
              {/* รูปโปรไฟล์ */}
              <div className="relative z-10">
                <div
                  className={`w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-xl bg-white overflow-hidden p-1 ${
                    displayAvatarUrl ? "cursor-pointer group" : ""
                  }`}
                  onClick={() =>
                    displayAvatarUrl && handleImageClick(displayAvatarUrl)
                  }
                >
                  {displayAvatarUrl ? (
                    <Image
                      src={displayAvatarUrl}
                      alt="Avatar"
                      fill
                      className="object-cover rounded-full group-hover:opacity-80 transition-opacity"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                      <UserIcon className="w-16 h-16 md:w-20 md:h-20 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* ชื่อและอีเมล */}
              <div className="flex-1 text-center md:text-left mt-2 md:mt-0 md:mb-4 space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                  {profile.username || "Unnamed User"}
                </h1>
                <p className="text-gray-500 font-medium text-sm md:text-base flex items-center justify-center md:justify-start gap-1.5">
                  <UserIcon className="w-4 h-4" /> {user.email}
                </p>
              </div>

              {/* ปุ่มดำเนินการ (แก้ไข / ออกจากระบบ) */}
              <div className="flex gap-3 mb-2 md:mb-4">
                {!isEditing && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-full font-medium hover:bg-sky-700 active:scale-95 transition-all shadow-md shadow-sky-100 cursor-pointer hover:scale-105"
                    >
                      <Edit3 className="w-4 h-4" /> แก้ไขโปรไฟล์
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-full font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 hover:scale-105 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" /> ออกจากระบบ
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ส่วนฟอร์มแก้ไขโปรไฟล์ (แสดงเมื่อกดปุ่มแก้ไข) */}
      {isEditing && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 bg-white rounded-2xl shadow-md border border-gray-200 p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h3 className="text-xl font-bold mb-6 text-gray-900">แก้ไขโปรไฟล์</h3>

          {/* ข้อความแจ้งเตือน */}
          {message && (
            <div
              className={`mb-4 p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            {/* แก้ไข Avatar */}
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                {avatarPreview ? (
                  // Preview ไฟล์ใหม่
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-300 shadow-sm flex-shrink-0">
                  <Image
                    src={avatarPreview}
                    alt="Preview avatar"
                    fill
                    className="rounded-full border-2 border-gray-300 shadow-sm object-cover"
                    unoptimized
                  />
                  </div>
                ) : (
                  // Placeholder หรือรูปเดิม
                  <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center text-gray-400">
                    รูปโปรไฟล์
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  แก้ไขรูปโปรไฟล์
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0 file:text-sm file:font-semibold
                      file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200"
                  disabled={saving}
                />
              </div>
            </div>

            {/* แก้ไข Cover */}
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                {coverPreview ? (
                  // Preview ไฟล์ใหม่
                  <Image
                    src={coverPreview}
                    alt="Preview cover"
                    width={200}
                    height={80}
                    className="rounded-lg border-2 border-gray-300 shadow-sm object-cover"
                    unoptimized
                  />
                ) : (
                  // Placeholder หรือรูปเดิม
                  <div className="w-48 h-20 rounded-lg bg-gray-100 border-2 border-gray-300 flex items-center justify-center text-gray-400">
                    รูปหน้าปก
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  แก้ไขรูปหน้าปก
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0 file:text-sm file:font-semibold
                      file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200"
                  disabled={saving}
                />
              </div>
            </div>

            {/* แก้ไขชื่อผู้ใช้ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อผู้ใช้
              </label>
              <input
                type="text"
                value={usernameEdit}
                onChange={(e) => setUsernameEdit(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                disabled={saving}
              />
            </div>

            {/* ปุ่มบันทึก/ยกเลิก */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-sky-600 text-white px-5 py-3 rounded-lg hover:bg-sky-700 disabled:bg-sky-300 font-medium shadow-md transition cursor-pointer active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin inline mr-1" />
                    กำลังบันทึก...
                  </>
                ) : (
                  "บันทึก"
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex-1 bg-gray-200 text-gray-700 px-5 py-3 rounded-lg hover:bg-gray-300 font-medium transition cursor-pointer active:scale-95"
                disabled={saving}
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3. ส่วนรายการโพสต์ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">โพสต์ของคุณ</h2>
          <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
            ทั้งหมด {posts.length} โพสต์
          </span>
        </div>

        <div className="grid gap-4">
          {posts.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center">
              <h3 className="text-gray-900 font-semibold">ยังไม่มีโพสต์</h3>
              <p className="text-gray-500 text-sm mt-1">
                เรื่องราวของคุณจะปรากฏที่นี่เมื่อคุณเริ่มโพสต์
              </p>
            </div>
          ) : (
            // แสดงรายการโพสต์
            posts.map((post) => (
              <div
                key={post.id}
                className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-sky-100 transition-all duration-200"
              >
                <div className="flex gap-4">
                  {/* Avatar ในโพสต์ */}
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0">
                    {displayAvatarUrl ? (
                      <Image
                        src={displayAvatarUrl}
                        alt="User"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Header โพสต์ (ชื่อ + กลุ่ม + เวลา) */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">
                          {profile.username}
                        </p>
                        {groupsMap[post.group_id] && (
                          <p className="text-xs text-gray-400">
                            กลุ่ม: {groupsMap[post.group_id].name}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 font-medium">
                          {new Date(post.created_at).toLocaleDateString(
                            "th-TH",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    {/* เนื้อหาโพสต์ */}
                    <p className="text-gray-700 leading-relaxed text-base">
                      {post.content}
                    </p>

                    {/* สื่อในโพสต์ (รูปภาพ/วิดีโอ) */}
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {post.media_urls.map((mediaUrl, index) => {
                          const publicUrl = getPublicMediaUrl(mediaUrl);
                          const isVideo =
                            publicUrl.endsWith(".mp4") ||
                            publicUrl.endsWith(".webm") ||
                            publicUrl.endsWith(".ogg");
                          return (
                            <div
                              key={index}
                              className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer"
                              onClick={() => handleImageClick(publicUrl)}
                            >
                              {isVideo ? (
                                <video
                                  src={publicUrl}
                                  controls={false} // ปิด Controls ใน Thumbnail
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Image
                                  src={publicUrl}
                                  alt={`Post media ${index + 1}`}
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

                    {/* Action Bar (Like / Comment) */}
                    <div className="flex justify-start gap-4 text-gray-500 text-sm pt-3 border-t border-gray-100">
                      <button
                        onClick={() =>
                          handleProfileLikeToggle(post.id, post.likedByUser)
                        }
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                          post.likedByUser ? "text-red-500" : "hover:text-red-400"
                        }`}
                      >
                        <Heart className="w-4 h-4 fill-current" />{" "}
                        {post.likesCount}
                      </button>
                      <button
                        onClick={() => setActivePostIdForComments(post.id)}
                        className="flex items-center gap-1.5 hover:text-gray-900 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {post.commentsCount}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Modal คอมเมนต์ (แสดงที่ Root Level) */}
      {activePostIdForComments && user && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <ProfileCommentModal
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