"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import { UsersRound } from "lucide-react";

import { useFollowedGroups } from "@/lib/context/FollowedGroupsContext";
import GroupCalendar from "@/app/components/GroupCalendar";
import PostFeed from "@/app/components/PostFeed";
import PostInputBar from "@/app/components/PostInputBar";

import type {
  PostWithUser as SupabasePostWithUser,
  CommentWithUser,
} from "@/types/supabase";

// ----------------------------------------------------------------------
// --- Constants & Placeholders ---
// ----------------------------------------------------------------------
const DEFAULT_COVER = "https://placehold.co/1200x400/e2e8f0/94a3b8?text=No+Cover";
const DEFAULT_AVATAR = "https://placehold.co/128x128?text=G";

// ----------------------------------------------------------------------
// --- Types (ที่เกี่ยวข้อง) ---
// ----------------------------------------------------------------------
interface GroupMinimal {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  owner_id: string;
  allow_members_to_post?: boolean; // สิทธิ์ในการโพสต์
}

// Type สำหรับ Post ที่ถูกดึงจาก DB ก่อนการจัดรูปแบบ
interface PostFromDB {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  media_urls?: string[];
  likes_count?: number;
  liked_by_user?: boolean;
  comments?: CommentWithUser[] | null;
  created_at: string;
  user?: {
    id: string;
    username: string;
    avatar_url?: string | null;
    created_at?: string | null;
  };
  likes?: { user_id: string }[] | null;
}

// Type สำหรับ Post ที่ถูกจัดรูปแบบแล้วพร้อมส่งเข้า PostFeed
type FeedPost = Omit<SupabasePostWithUser, "media_urls"> & { media_urls: string[] };

// ----------------------------------------------------------------------
// --- Component หลัก: GroupDetailPage ---
// ----------------------------------------------------------------------
export default function GroupDetailPage() {
  const { groupId } = useParams() as { groupId: string };
  const router = useRouter();
  const { refreshGroups } = useFollowedGroups(); // Context สำหรับอัปเดตกลุ่มที่ติดตาม

  // --- State: Group Info & Status ---
  const [group, setGroup] = useState<GroupMinimal | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  // --- State: Media URLs ---
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER);
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");

  // --- State: Posts ---
  const [posts, setPosts] = useState<FeedPost[]>([]);

  // --- Helper: กำหนดสิทธิ์ ---
  const isOwner = userId === group?.owner_id;
  const isPostingAllowed = group?.allow_members_to_post ?? true; // Default เป็น true ถ้าไม่ได้ระบุ

  // ----------------------------------------------------------------------
  // --- Data Fetching: โพสต์ ---
  // ----------------------------------------------------------------------

  /** ฟังก์ชันดึงโพสต์ทั้งหมดของกลุ่มและจัดรูปแบบข้อมูล */
  const fetchGroupPosts = useCallback(
    async (currentUserId: string | null) => {
      if (!groupId) return;

      // 1. ดึงโพสต์พร้อมข้อมูล User, Likes, และ Comments
      const { data: postData } = await supabase
        .from("posts")
        .select(
          "*, user:user_id(id, username, avatar_url, created_at), likes(user_id), comments(*, user:user_id(id, username, avatar_url))"
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }); // โพสต์ล่าสุดอยู่บน

      // 2. จัดรูปแบบข้อมูลให้เข้ากับ FeedPost Type
      const formattedPosts: FeedPost[] = (
        (postData as PostFromDB[]) || []
      ).map((p) => {
        const didUserLike =
          p.likes?.some((like) => like.user_id === currentUserId) || false;
        const postUser = p.user;

        return {
          id: p.id,
          group_id: p.group_id,
          user_id: p.user_id,
          content: p.content,
          media_urls: p.media_urls || [], // รับประกันว่าเป็น Array ว่าง
          likes_count: p.likes?.length || 0,
          liked_by_user: didUserLike,
          comments: (p.comments || []) as CommentWithUser[], // รับประกันว่าเป็น Array ว่าง
          created_at: p.created_at,
          user: {
            id: postUser?.id || "",
            username: postUser?.username || "Unknown",
            avatar_url: postUser?.avatar_url ?? null,
            created_at: postUser?.created_at || null,
          },
        };
      });
      setPosts(formattedPosts);
    },
    [groupId]
  );

  // ----------------------------------------------------------------------
  // --- Data Fetching: ข้อมูลกลุ่มและสถานะการติดตาม ---
  // ----------------------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;
      setUserId(currentUserId);
      if (!groupId) return;

      // 1. ดึงข้อมูลกลุ่มหลัก
      const { data: groupData } = await supabase
        .from("groups")
        .select("*, allow_members_to_post")
        .eq("id", groupId)
        .single<GroupMinimal>();
      setGroup(groupData || null);

      // 2. ดึง Signed URL ของ Cover และ Avatar
      let fetchedAvatarUrl = DEFAULT_AVATAR;
      let fetchedCoverUrl = DEFAULT_COVER;

      if (groupData) {
        // ดึง Cover URL
        if (groupData.cover_url) {
          const { data, error } = await supabase.storage
            .from("groups")
            // สร้าง Signed URL สำหรับรูปภาพ (หมดอายุใน 1 ชม.)
            .createSignedUrl(groupData.cover_url.replace(/^\/+/, ""), 3600); 
          if (!error) fetchedCoverUrl = data.signedUrl;
        }
        // ดึง Avatar URL
        if (groupData.avatar_url) {
          const { data, error } = await supabase.storage
            .from("groups")
            .createSignedUrl(groupData.avatar_url.replace(/^\/+/, ""), 3600);
          if (!error) fetchedAvatarUrl = data.signedUrl;
        }
      }
      setCoverUrl(fetchedCoverUrl);
      setAvatarUrl(fetchedAvatarUrl);

      // 3. ตรวจสอบสถานะการติดตาม (ถ้ามี User ID)
      if (currentUserId && groupData) {
        const { data: followData } = await supabase
          .from("group_members")
          .select("*")
          .eq("user_id", currentUserId)
          .eq("group_id", groupId)
          .maybeSingle();
        setIsFollowing(!!followData);
      }

      // 4. นับจำนวนผู้ติดตามทั้งหมด
      const { count } = await supabase
        .from("group_members")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", groupId);
      setFollowersCount(count || 0);

      // 5. อัปเดตสถานะการอ่านล่าสุด (เพื่อรีเซ็ต Badge แจ้งเตือนใน NavbarSub)
      if (currentUserId && groupData) {
        const { error } = await supabase.from("user_group_read_status").upsert(
          {
            user_id: currentUserId,
            group_id: groupId,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "user_id,group_id" }
        );
        if (error) console.error("Failed to update read status:", error);
      }

      // 6. ดึงโพสต์ของกลุ่ม
      await fetchGroupPosts(currentUserId);
      setLoading(false);
    };
    fetchData();
  }, [groupId, fetchGroupPosts, router, refreshGroups]); 
  // Dependency: refreshGroups ถูกเพิ่มเข้ามาเพื่อใช้ใน HandleFollowToggle

  // ----------------------------------------------------------------------
  // --- Handlers: การจัดการกลุ่มและโพสต์ ---
  // ----------------------------------------------------------------------

  /** Toggle การติดตาม/เลิกติดตามกลุ่ม */
  const handleFollowToggle = async () => {
    if (!userId || !group) return;
    
    // Optimistic Update
    setIsFollowing((prev) => !prev);
    setFollowersCount((prev) => (isFollowing ? prev - 1 : prev + 1));

    try {
      if (isFollowing) {
        // Unfollow: ลบแถว
        await supabase
          .from("group_members")
          .delete()
          .eq("user_id", userId)
          .eq("group_id", group.id);
      } else {
        // Follow: เพิ่มแถว
        await supabase
          .from("group_members")
          .insert([{ user_id: userId, group_id: group.id }]);
        await fetchGroupPosts(userId); // ดึงโพสต์ใหม่หลังจากติดตามแล้ว
      }
      refreshGroups(); // อัปเดตรายการกลุ่มที่ติดตามใน Context
    } catch (e) {
      // Rollback UI
      setIsFollowing((prev) => !prev);
      setFollowersCount((prev) => (isFollowing ? prev + 1 : prev - 1));
      console.error("Follow toggle failed:", e);
    }
  };

  /** 🛑 Logic การลบกลุ่มและไฟล์สื่อทั้งหมด */
  const handleDeleteGroup = async () => {
    if (!group || !window.confirm("คุณต้องการลบกลุ่มนี้จริงหรือไม่?")) return;

    try {
      setLoading(true); // เพิ่ม Loading

      // 1. ดึงโพสต์ทั้งหมดในกลุ่มเพื่อหา Path ของไฟล์สื่อ (Post Media)
      const { data: postsData } = await supabase
        .from('posts')
        .select('media_urls')
        .eq('group_id', groupId);

      const pathsToDelete: string[] = [];

      if (postsData) {
        // รวบรวม Path ของไฟล์สื่อทั้งหมด
        (postsData as { media_urls: string[] | null }[]).forEach(post => {
          if (post.media_urls) {
            post.media_urls.forEach((url: string) => { 
              const bucketName = "post_media";
              const pathSegment = `/${bucketName}/`;
              
              // พยายามแปลง Public URL กลับเป็น Path ใน Storage (เพื่อความแน่ใจ)
              if (url.startsWith("http")) {
                try {
                  const urlObj = new URL(url);
                  const path = urlObj.pathname.split(pathSegment)[1];
                  if (path) pathsToDelete.push(path);
                } catch (e) {
                  // Fallback: ถ้าแปลง URL ไม่ได้ ให้ถือว่าเป็น Path
                  pathsToDelete.push(url);
                }
              } else {
                pathsToDelete.push(url); // ถ้าเป็น Path อยู่แล้ว
              }
            });
          }
        });
      }

      // 2. ลบไฟล์สื่อโพสต์ออกจาก Bucket "post_media"
      if (pathsToDelete.length > 0) {
        await supabase.storage.from("post_media").remove(pathsToDelete);
        console.log(`Successfully deleted ${pathsToDelete.length} post media files.`);
      }

      // 3. ลบรูป Avatar และ Cover ของกลุ่ม (จาก "groups" bucket)
      if (group.avatar_url)
        await supabase.storage.from("groups").remove([group.avatar_url.replace(/^\/+/, "")]);
      if (group.cover_url)
        await supabase.storage.from("groups").remove([group.cover_url.replace(/^\/+/, "")]);

      // 4. ลบข้อมูลกลุ่มออกจาก Database
      // (Supabase RLS/Foreign Keys ควรจะดูแลการลบ Likes, Comments, Posts, GroupMembers ที่เกี่ยวข้องทั้งหมด)
      const { error: deleteError } = await supabase.from("groups").delete().eq("id", group.id);
      if (deleteError) throw deleteError;
      
      // 5. Redirect และอัปเดต Context
      refreshGroups();
      router.push("/groups");

    } catch (e) {
      setLoading(false);
      console.error("Group deletion failed:", e);
      alert("ไม่สามารถลบกลุ่มได้: " + (e as Error).message);
    }
  };


  /** เพิ่มโพสต์ใหม่ไปยัง Feed (Optimistic/Local Update) */
  const handleNewPost = (post: SupabasePostWithUser) => {
    setPosts((prev) => [
      {
        ...post,
        media_urls: post.media_urls || [],
        likes_count: post.likes_count || 0,
        liked_by_user: post.liked_by_user || false,
        comments: post.comments || [],
      },
      ...prev,
    ]);
  };

  /** ลบโพสต์ออกจาก Feed (Local Update) */
  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  /** อัปเดตโพสต์ใน Feed (Local Update) */
  const handlePostUpdated = (updatedPost: SupabasePostWithUser) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === updatedPost.id
          ? { ...updatedPost, media_urls: updatedPost.media_urls || [] }
          : p
      )
    );
  };

  /** เปิด Modal แสดงรูปภาพขยาย */
  const handleImageClick = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };


  // ----------------------------------------------------------------------
  // --- Render ---
  // ----------------------------------------------------------------------
  if (loading)
    return <p className="p-4 text-center text-gray-500">Loading...</p>;
  if (!group)
    return <p className="p-4 text-center text-red-500">Group not found</p>;

  // Component ย่อยสำหรับ Modal (เพื่อลดความซ้ำซ้อนใน JSX)
  const ImagePreviewModal = () => (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={() => setShowImageModal(false)}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
        <Image
          src={modalImageUrl}
          alt="Preview"
          width={1200}
          height={800}
          className="object-contain max-w-full max-h-full"
          unoptimized
        />
      </div>
      {/* ปุ่มปิด */}
      <button
        onClick={() => setShowImageModal(false)}
        className="fixed top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition z-50 leading-none"
        aria-label="ปิด"
      >
        &times;
      </button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Image Modal (แสดงรูป Cover/Avatar ขยาย) */}
      {showImageModal && <ImagePreviewModal />}

      {/* 1. Group Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* ส่วนรูปปก (Cover) */}
        <div
          className={`relative w-full h-44 md:h-52 lg:h-60 ${
            coverUrl !== DEFAULT_COVER ? "cursor-pointer group" : ""
          }`}
          onClick={() => coverUrl !== DEFAULT_COVER && handleImageClick(coverUrl)}
        >
          {coverUrl === DEFAULT_COVER ? (
            <div className="w-full h-full bg-gray-300" />
          ) : (
            <>
              <Image
                src={coverUrl}
                alt="Group Cover"
                fill
                className="object-cover opacity-40 group-hover:opacity-50 transition-opacity"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/10" />
              {/* Hover Effect */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  คลิกเพื่อดูรูป
                </span>
              </div>
            </>
          )}
        </div>

        {/* ข้อมูลกลุ่ม, Avatar, และปุ่ม */}
        <div className="px-6 pb-6 pt-6 relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            {/* รูปโปรไฟล์ (Avatar) */}
            <div
              className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-100 cursor-pointer flex items-center justify-center shrink-0 aspect-square"
              onClick={() =>
                avatarUrl !== DEFAULT_AVATAR && handleImageClick(avatarUrl)
              }
            >
              {avatarUrl === DEFAULT_AVATAR ? (
                <UsersRound className="w-16 h-16 md:w-20 md:h-20 text-gray-400" />
              ) : (
                <Image
                  src={avatarUrl}
                  alt="Group Avatar"
                  width={128}
                  height={128}
                  className="object-cover w-full h-full group-hover:opacity-80 transition-opacity"
                  unoptimized
                />
              )}
            </div>

            {/* ชื่อและจำนวนผู้ติดตาม */}
            <div className="mb-2 md:mb-4 pt-10">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 break-words">
                {group.name}
              </h1>
              <p className="text-gray-500 font-medium text-sm md:text-base mt-1">
                {followersCount} ผู้ติดตาม
              </p>
            </div>
          </div>

          {/* ปุ่มดำเนินการ (แก้ไข/ลบ/ติดตาม) */}
          <div className="flex flex-row gap-3 mt-4 md:mt-0">
            {isOwner ? (
              // ปุ่มสำหรับ Owner
              <>
                <button
                  onClick={() => router.push(`/groups/${group.id}/edit`)}
                  className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full font-semibold transition shadow-md cursor-pointer hover:scale-105 active:scale-93"
                >
                  แก้ไขกลุ่ม
                </button>
                <button
                  onClick={handleDeleteGroup}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold transition shadow-md cursor-pointer hover:scale-105 active:scale-93"
                >
                  ลบกลุ่ม
                </button>
              </>
            ) : (
              // ปุ่มสำหรับ Member/Guest
              <button
                onClick={handleFollowToggle}
                className={`px-5 py-2.5 rounded-full font-semibold transition shadow-md cursor-pointer hover:scale-105 active:scale-93 ${
                  isFollowing
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "bg-sky-600 text-white hover:bg-sky-700"
                }`}
              >
                {isFollowing ? "✔️ กำลังติดตาม" : "+ ติดตาม"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Content (3 คอลัมน์) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* คอลัมน์ซ้าย: รายละเอียดกลุ่มและปฏิทิน */}
        <div className="md:col-span-1 space-y-6">
          {/* รายละเอียดกลุ่ม */}
          {group.description && (
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                เกี่ยวกับกลุ่ม
              </h2>
              <p className="text-gray-700 break-words whitespace-pre-wrap">
                {group.description}
              </p>
            </div>
          )}

          {/* ปฏิทินกิจกรรม */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              ปฏิทินกิจกรรม
            </h2>
            <GroupCalendar groupId={group.id} userId={userId} isOwner={isOwner} />
          </div>
        </div>

        {/* คอลัมน์ขวา: กล่องโพสต์และ Feed */}
        <div className="md:col-span-2 space-y-6">
          {/* กล่องโพสต์ (แสดงเมื่อมีสิทธิ์) */}
          {userId && (isOwner || isPostingAllowed) && (
            <PostInputBar
              groupId={group.id}
              userId={userId}
              onPosted={handleNewPost}
              isGroupOwner={isOwner}
              allowMembersToPost={isPostingAllowed}
              isFollowing={isFollowing}
            />
          )}

          {/* Feed โพสต์ */}
          <PostFeed
            posts={posts}
            groupName={group.name}
            groupAvatar={avatarUrl}
            userId={userId}
            onPostDeleted={handlePostDeleted}
            onPostUpdated={handlePostUpdated}
            groupOwnerId={group.owner_id}
            isGroupOwner={isOwner}
          />
        </div>
      </div>
    </div>
  );
}