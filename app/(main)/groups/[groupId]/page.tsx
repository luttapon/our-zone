"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation"; // เครื่องมือจัดการ URL และการนำทาง
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import Image from "next/image";
import { UsersRound } from "lucide-react"; // ไอคอนต่างๆ

// Context และ Components ย่อย
import { useFollowedGroups } from "@/lib/context/FollowedGroupsContext";
import GroupCalendar from "@/app/components/GroupCalendar";
import PostFeed from "@/app/components/PostFeed";
import PostInputBar from "@/app/components/PostInputBar";

// นำเข้า Types
import type {
  PostWithUser as SupabasePostWithUser,
  CommentWithUser,
} from "@/types/supabase";

// ====================================================================
// ค่าคงที่และรูปภาพ Placeholder
// ====================================================================
const DEFAULT_COVER = "https://placehold.co/1200x400/e2e8f0/94a3b8?text=No+Cover";
const DEFAULT_AVATAR = "https://placehold.co/128x128?text=G";

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interfaces)
// ====================================================================

// ข้อมูลพื้นฐานของกลุ่ม
interface GroupMinimal {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  owner_id: string;
  allow_members_to_post?: boolean; // สิทธิ์ในการโพสต์ของสมาชิก
}

// ข้อมูลโพสต์ดิบจาก Database (ก่อนแปลง)
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

// ข้อมูลโพสต์สำหรับส่งให้ Feed Component (แปลงแล้ว)
type FeedPost = Omit<SupabasePostWithUser, "media_urls"> & { media_urls: string[] };

// ====================================================================
// Component หลัก: หน้ารายละเอียดกลุ่ม (GroupDetailPage)
// ====================================================================

export default function GroupDetailPage() {
  const { groupId } = useParams() as { groupId: string }; // ดึง ID กลุ่มจาก URL
  const router = useRouter();
  const { refreshGroups } = useFollowedGroups(); // ใช้เพื่ออัปเดต Sidebar เมื่อกดติดตาม

  // --- 1. การจัดการข้อมูลกลุ่มและผู้ใช้ (State) ---
  const [group, setGroup] = useState<GroupMinimal | null>(null); // ข้อมูลกลุ่ม
  const [loading, setLoading] = useState(true);                  // สถานะโหลดหน้าเว็บ
  const [userId, setUserId] = useState<string | null>(null);     // ID ผู้ใช้ปัจจุบัน
  const [isFollowing, setIsFollowing] = useState(false);         // สถานะการติดตาม
  const [followersCount, setFollowersCount] = useState(0);       // จำนวนผู้ติดตาม

  // --- 2. การจัดการรูปภาพ (State) ---
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER);       // URL รูปปก
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);    // URL รูปโปรไฟล์
  const [showImageModal, setShowImageModal] = useState(false);   // เปิด Modal ดูรูปไหม
  const [modalImageUrl, setModalImageUrl] = useState("");        // URL รูปใน Modal

  // --- 3. การจัดการโพสต์ (State) ---
  const [posts, setPosts] = useState<FeedPost[]>([]);            // รายการโพสต์ในกลุ่ม

  // --- 4. ตัวแปรตรวจสอบสิทธิ์ (Helpers) ---
  const isOwner = userId === group?.owner_id; // เป็นเจ้าของกลุ่มหรือไม่
  const isPostingAllowed = group?.allow_members_to_post ?? true; // สมาชิกโพสต์ได้ไหม

  // ====================================================================
  // ส่วนดึงข้อมูล (Data Fetching)
  // ====================================================================

  /** ฟังก์ชันดึงโพสต์ทั้งหมดของกลุ่ม (ใช้ useCallback เพื่อไม่ให้สร้างฟังก์ชันใหม่ซ้ำๆ) */
  const fetchGroupPosts = useCallback(
    async (currentUserId: string | null) => {
      if (!groupId) return;

      // 1. ดึงโพสต์ + ข้อมูลผู้โพสต์ + ไลค์ + คอมเมนต์
      const { data: postData } = await supabase
        .from("posts")
        .select(
          "*, user:user_id(id, username, avatar_url, created_at), likes(user_id), comments(*, user:user_id(id, username, avatar_url))"
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }); // โพสต์ล่าสุดอยู่บน

      // 2. แปลงข้อมูลให้เป็น Format ที่หน้าเว็บต้องการ (FeedPost)
      const formattedPosts: FeedPost[] = (
        (postData as PostFromDB[]) || []
      ).map((p) => {
        // เช็คว่าผู้ใช้ปัจจุบันกดไลค์โพสต์นี้หรือยัง
        const didUserLike =
          p.likes?.some((like) => like.user_id === currentUserId) || false;
        const postUser = p.user;

        return {
          id: p.id,
          group_id: p.group_id,
          user_id: p.user_id,
          content: p.content,
          media_urls: p.media_urls || [], // กันค่า null
          likes_count: p.likes?.length || 0,
          liked_by_user: didUserLike,
          comments: (p.comments || []) as CommentWithUser[],
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

  /** โหลดข้อมูลหลักเมื่อเข้าสู่หน้าเว็บ (Effect) */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // ตรวจสอบผู้ใช้ปัจจุบัน
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;
      setUserId(currentUserId);
      
      if (!groupId) return;

      // 1. ดึงข้อมูลรายละเอียดกลุ่ม
      const { data: groupData } = await supabase
        .from("groups")
        .select("*, allow_members_to_post")
        .eq("id", groupId)
        .single<GroupMinimal>();
      setGroup(groupData || null);

      // 2. สร้าง URL รูปภาพ (Signed URL เพื่อความปลอดภัยและเข้าถึงได้ชั่วคราว)
      let fetchedAvatarUrl = DEFAULT_AVATAR;
      let fetchedCoverUrl = DEFAULT_COVER;

      if (groupData) {
        // รูปปก
        if (groupData.cover_url) {
          const { data, error } = await supabase.storage
            .from("groups")
            .createSignedUrl(groupData.cover_url.replace(/^\/+/, ""), 3600); // อายุ 1 ชม.
          if (!error) fetchedCoverUrl = data.signedUrl;
        }
        // รูปโปรไฟล์
        if (groupData.avatar_url) {
          const { data, error } = await supabase.storage
            .from("groups")
            .createSignedUrl(groupData.avatar_url.replace(/^\/+/, ""), 3600);
          if (!error) fetchedAvatarUrl = data.signedUrl;
        }
      }
      setCoverUrl(fetchedCoverUrl);
      setAvatarUrl(fetchedAvatarUrl);

      // 3. ตรวจสอบว่าผู้ใช้ติดตามกลุ่มนี้อยู่หรือไม่
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

      // 5. บันทึกว่าผู้ใช้อ่านกลุ่มนี้ล่าสุดเมื่อไหร่ (เพื่อเคลียร์แจ้งเตือน)
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

      // 6. ดึงรายการโพสต์
      await fetchGroupPosts(currentUserId);
      setLoading(false);
    };
    
    fetchData();
  }, [groupId, fetchGroupPosts, router, refreshGroups]);

  // ====================================================================
  // ฟังก์ชันจัดการเหตุการณ์ (Handlers)
  // ====================================================================

  /** กดติดตาม / เลิกติดตาม */
  const handleFollowToggle = async () => {
    if (!userId || !group) return;
    
    // อัปเดต UI ทันที (Optimistic Update)
    setIsFollowing((prev) => !prev);
    setFollowersCount((prev) => (isFollowing ? prev - 1 : prev + 1));

    try {
      if (isFollowing) {
        // เลิกติดตาม: ลบออกจากตารางสมาชิก
        await supabase
          .from("group_members")
          .delete()
          .eq("user_id", userId)
          .eq("group_id", group.id);
      } else {
        // ติดตาม: เพิ่มเข้าตารางสมาชิก
        await supabase
          .from("group_members")
          .insert([{ user_id: userId, group_id: group.id }]);
        
        await fetchGroupPosts(userId); // โหลดโพสต์ใหม่เผื่อมีเนื้อหาเฉพาะสมาชิก
      }
      refreshGroups(); // อัปเดต Sidebar
    } catch (e) {
      // ถ้า Error ให้ย้อนค่า UI กลับ
      setIsFollowing((prev) => !prev);
      setFollowersCount((prev) => (isFollowing ? prev + 1 : prev - 1));
      console.error("Follow toggle failed:", e);
    }
  };

  /** ลบกลุ่มและข้อมูลที่เกี่ยวข้องทั้งหมด */
  const handleDeleteGroup = async () => {
    if (!group || !window.confirm("คุณต้องการลบกลุ่มนี้จริงหรือไม่?")) return;

    try {
      setLoading(true);

      // 1. หาไฟล์รูป/วิดีโอในโพสต์ทั้งหมดของกลุ่มเพื่อลบ
      const { data: postsData } = await supabase
        .from('posts')
        .select('media_urls')
        .eq('group_id', groupId);

      const pathsToDelete: string[] = [];

      if (postsData) {
        (postsData as { media_urls: string[] | null }[]).forEach(post => {
          if (post.media_urls) {
            post.media_urls.forEach((url: string) => { 
              // พยายามแปลง URL เป็น Path ใน Storage
              if (url.startsWith("http")) {
                try {
                  const urlObj = new URL(url);
                  const pathSegment = `/post_media/`;
                  const path = urlObj.pathname.split(pathSegment)[1];
                  if (path) pathsToDelete.push(path);
                } catch (e) {
                  pathsToDelete.push(url); // ถ้าแปลงไม่ได้ ให้ใช้ค่าเดิม
                }
              } else {
                pathsToDelete.push(url); // ถ้าเป็น Path อยู่แล้ว
              }
            });
          }
        });
      }

      // 2. สั่งลบไฟล์สื่อออกจาก Storage
      if (pathsToDelete.length > 0) {
        await supabase.storage.from("post_media").remove(pathsToDelete);
      }

      // 3. ลบรูปโปรไฟล์และปกกลุ่มออกจาก Storage
      if (group.avatar_url)
        await supabase.storage.from("groups").remove([group.avatar_url.replace(/^\/+/, "")]);
      if (group.cover_url)
        await supabase.storage.from("groups").remove([group.cover_url.replace(/^\/+/, "")]);

      // 4. ลบข้อมูลกลุ่มจาก Database (Cascade Delete จะลบโพสต์/สมาชิก ให้เองตาม Foreign Key)
      const { error: deleteError } = await supabase.from("groups").delete().eq("id", group.id);
      if (deleteError) throw deleteError;
      
      // 5. กลับไปหน้ารวมกลุ่ม
      refreshGroups();
      router.push("/groups");

    } catch (e) {
      setLoading(false);
      console.error("Group deletion failed:", e);
      alert("ไม่สามารถลบกลุ่มได้: " + (e as Error).message);
    }
  };

  /** เพิ่มโพสต์ใหม่ลงหน้าจอ (Local Update) */
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

  /** ลบโพสต์ออกจากหน้าจอ (Local Update) */
  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  /** อัปเดตข้อมูลโพสต์ในหน้าจอ (Local Update) */
  const handlePostUpdated = (updatedPost: SupabasePostWithUser) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === updatedPost.id
          ? { ...updatedPost, media_urls: updatedPost.media_urls || [] }
          : p
      )
    );
  };

  /** เปิด Modal ดูรูป */
  const handleImageClick = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };

  // ====================================================================
  // ส่วนแสดงผล (Render UI)
  // ====================================================================

  if (loading) return <p className="p-4 text-center text-gray-500">Loading...</p>;
  if (!group) return <p className="p-4 text-center text-red-500">Group not found</p>;

  // Component ย่อย: Modal แสดงรูปภาพขยาย
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
      <button
        onClick={() => setShowImageModal(false)}
        className="fixed top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition z-50 leading-none"
      >
        &times;
      </button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-gray-50 min-h-screen">
      
      {/* Modal รูปภาพ */}
      {showImageModal && <ImagePreviewModal />}

      {/* 1. ส่วนหัวของกลุ่ม (Header) */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        
        {/* รูปปก (Cover Image) */}
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
              {/* ข้อความบอกให้คลิกเมื่อเอาเมาส์ชี้ */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  คลิกเพื่อดูรูป
                </span>
              </div>
            </>
          )}
        </div>

        {/* ข้อมูลกลุ่มและปุ่มต่างๆ */}
        <div className="px-6 pb-6 pt-6 relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            
            {/* รูปโปรไฟล์กลุ่ม (Avatar) */}
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

          {/* ปุ่ม Action (แก้ไข/ลบ หรือ ติดตาม) */}
          <div className="flex flex-row gap-3 mt-4 md:mt-0">
            {isOwner ? (
              // กรณีเป็นเจ้าของ: ปุ่มแก้ไขและลบ
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
              // กรณีเป็นสมาชิกทั่วไป: ปุ่มติดตาม
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

      {/* 2. เนื้อหาหลัก (Grid Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* คอลัมน์ซ้าย (ข้อมูลกลุ่ม, ปฏิทิน) - ซ่อนบน md ขึ้นไป แสดงบน lg ขึ้นไป */}
        <div className="hidden lg:block space-y-6">
          {/* คำอธิบายกลุ่ม */}
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

          {/* ปฏิทิน */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              ปฏิทินกิจกรรม
            </h2>
            <GroupCalendar groupId={group.id} userId={userId} isOwner={isOwner} />
          </div>
        </div>

        {/* คอลัมน์ขวา (โพสต์, Feed) - ขยายเต็มบน md */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          
          {/* แสดงคำอธิบายและปฏิทินบน md ตรงนี้ (ก่อนโพสต์) */}
          <div className="block lg:hidden">
            {/* คำอธิบายกลุ่ม */}
            {group.description && (
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">
                  เกี่ยวกับกลุ่ม
                </h2>
                <p className="text-gray-700 break-words whitespace-pre-wrap">
                  {group.description}
                </p>
              </div>
            )}

            {/* ปฏิทิน - ขยายเต็มบน Tablet */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                ปฏิทินกิจกรรม
              </h2>
              <GroupCalendar groupId={group.id} userId={userId} isOwner={isOwner} />
            </div>
          </div>
          
          {/* กล่องเขียนโพสต์ (แสดงเฉพาะผู้มีสิทธิ์) */}
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

          {/* รายการโพสต์ (Feed) */}
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