"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
// Import Supabase client
import { supabase } from "@/lib/supabase/client"; 
// Import Context สำหรับกลุ่มที่ติดตาม
import { useFollowedGroups } from "@/lib/context/FollowedGroupsContext";
// Import Hook สำหรับดึง Pathname ปัจจุบัน
import { usePathname } from "next/navigation";
// Import Type สำหรับ Realtime Channel ของ Supabase
import type { RealtimeChannel } from "@supabase/supabase-js";
// Icon แสดงกลุ่ม
import { UsersRound } from "lucide-react";

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูล (Types) 
// ----------------------------------------------------------------------

/** โครงสร้างข้อมูลพื้นฐานของ Group ที่ติดตาม */
interface Group {
  id: string;
  name: string;
  avatar_url: string | null;
  owner_id: string; // ID เจ้าของกลุ่ม
}

/** โครงสร้างข้อมูลสถานะการอ่านล่าสุดของผู้ใช้ต่อกลุ่ม */
interface UserGroupReadStatus {
  group_id: string;
  last_read_at: string; // Timestamp ของการอ่านล่าสุด
}

// ----------------------------------------------------------------------
// --- Component หลัก: แถบนำทางรอง (แสดงกลุ่มที่ติดตาม) 
// ----------------------------------------------------------------------

export const NavbarSub = () => {
  // --- Context & Hooks ---
  const { groups } = useFollowedGroups(); // ดึงรายชื่อกลุ่มที่ติดตามจาก Context
  const pathname = usePathname();         // ดึง URL path ปัจจุบัน

  // --- State Management ---
  // เก็บจำนวนโพสต์ที่ยังไม่อ่าน: { groupId: count }
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);         // เก็บ ID ผู้ใช้ปัจจุบัน
  // สถานะควบคุมการแสดง/ซ่อนแถบแสดงกลุ่มที่ติดตาม
  const [isGroupsVisible, setIsGroupsVisible] = useState(true); 

  // --- Effect: ดึง User ID เมื่อ Component Mount ---
  useEffect(() => {
    // ดึง session ปัจจุบันจาก Supabase เพื่อรับ User ID
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });
  }, []); // [] = ทำงานเมื่อ Mount ครั้งเดียวเท่านั้น

  // --- Logic: ทำเครื่องหมายว่าอ่านกลุ่มนี้แล้ว (เมื่อคลิกเข้ากลุ่ม) ---
  const markGroupAsRead = async (groupId: string) => {
    if (!userId) return;

    // 1. อัปเดต/สร้าง (Upsert) เวลาอ่านล่าสุดลงในตาราง user_group_read_status
    await supabase.from("user_group_read_status").upsert(
      [
        {
          user_id: userId,
          group_id: groupId,
          last_read_at: new Date().toISOString(),
        },
      ],
      // ระบุคอลัมน์ที่ใช้ในการตรวจสอบ Conflict (คู่ user_id, group_id ต้องไม่ซ้ำกัน)
      { onConflict: "user_id,group_id" }
    );

    // 2. รีเซ็ตตัวเลขแจ้งเตือนใน State เป็น 0 ทันที เพื่ออัปเดต UI ให้แสดง 0
    setUnreadCounts((prev) => ({
      ...prev,
      [groupId]: 0,
    }));
  };

  // --- Effect: คำนวณจำนวนโพสต์ที่ยังไม่อ่าน & ตั้งค่า Realtime Listener ---
  useEffect(() => {
    // หยุดทำงานถ้ายังไม่มีกลุ่มที่ติดตาม หรือยังไม่ทราบ User ID
    if (groups.length === 0 || !userId) return;

    // ฟังก์ชันดึงจำนวนโพสต์ที่ยังไม่อ่านสำหรับทุกกลุ่มที่ติดตาม
    const fetchUnreadCounts = async () => {
      // 1. ดึงข้อมูลเวลาอ่านล่าสุด (last_read_at) ของผู้ใช้สำหรับกลุ่มที่ติดตามทั้งหมด
      const { data: readStatusData } = (await supabase
        .from("user_group_read_status")
        .select("group_id, last_read_at")
        .in(
          "group_id",
          groups.map((g) => g.id)
        )
        .eq("user_id", userId)) as { data: UserGroupReadStatus[] | null };

      const counts: Record<string, number> = {};

      // 2. วนลูปแต่ละกลุ่มเพื่อรับจำนวนโพสต์ใหม่ที่สร้างขึ้นหลังเวลาอ่านล่าสุด
      for (const group of groups) {
        const status = readStatusData?.find((s) => s.group_id === group.id);
        const lastReadTime = status?.last_read_at;

        // Base Query: นับจำนวนโพสต์ทั้งหมดของกลุ่ม ยกเว้นโพสต์ที่ผู้ใช้ปัจจุบันสร้าง (Self-post)
        let query = supabase
          .from("posts")
          .select("id", { count: "exact", head: true }) // นับจำนวนอย่างเดียว (optimization)
          .eq("group_id", group.id)
          .neq("user_id", userId); // ไม่นับโพสต์ของตัวเอง

        // ถ้ามีเวลาอ่านล่าสุด (lastReadTime) ให้เพิ่มเงื่อนไข: โพสต์ต้องใหม่กว่าเวลานั้น
        if (lastReadTime) query = query.gt("created_at", lastReadTime);

        const { count, error } = await query;

        if (error) {
          console.error(`Error fetching post count for ${group.id}:`, error);
          counts[group.id] = 0;
        } else {
          // เงื่อนไขพิเศษ: ถ้าผู้ใช้อยู่ในหน้ากลุ่มนั้นอยู่แล้ว หรือเป็นเจ้าของกลุ่ม
          // ให้ถือว่าอ่านแล้ว (เพื่อป้องกันการแสดง Badge เมื่ออยู่ในกลุ่ม)
          if (pathname === `/groups/${group.id}` || group.owner_id === userId) {
            counts[group.id] = 0;
          } else {
            // บันทึกจำนวนโพสต์ที่ยังไม่อ่าน
            counts[group.id] = count ?? 0;
          }
        }
      }

      setUnreadCounts(counts);
    };

    fetchUnreadCounts();

    // --- Realtime Listener: ฟัง event โพสต์ใหม่ ---
    const channel: RealtimeChannel = supabase
      .channel("group_unread_counter") // ตั้งชื่อ Channel
      .on(
        "postgres_changes",
        {
          event: "INSERT", // ฟังเฉพาะ Event สร้าง (INSERT)
          schema: "public",
          table: "posts",
          // กรอง: ฟังเฉพาะกลุ่มที่อยู่ในรายชื่อกลุ่มที่ติดตามเท่านั้น
          filter: `group_id=in.(${groups.map((g) => g.id).join(",")})`,
        },
        (payload) => {
          // Cast payload.new เพื่อเข้าถึง group_id และ user_id
          const newPost = payload.new as { group_id: string; user_id: string };
          const groupId = newPost.group_id;
          const group = groups.find((g) => g.id === groupId);

          // 1. ถ้าโพสต์ถูกสร้างโดยผู้ใช้ปัจจุบัน ให้ข้าม (ไม่บวกแจ้งเตือน)
          if (newPost.user_id === userId) return;

          // 2. ถ้าไม่พบกลุ่ม หรือผู้ใช้อยู่ในหน้ากลุ่มนั้นอยู่แล้ว ให้ข้าม
          if (!group || pathname === `/groups/${groupId}`) return;

          // 3. บวกจำนวนแจ้งเตือนเพิ่ม +1 ใน State
          setUnreadCounts((prev) => ({
            ...prev,
            [groupId]: (prev[groupId] || 0) + 1,
          }));
        }
      )
      .subscribe(); // เริ่มฟัง Channel

    return () => {
      // Cleanup Function: ลบ Channel เมื่อ Component ถูกทำลาย
      supabase.removeChannel(channel);
    };
    // Re-run effect เมื่อรายชื่อกลุ่ม, Path, หรือ User ID เปลี่ยน
  }, [groups, pathname, userId]);

  return (
    // --- Container หลัก: แถบนำทางรอง (Fixed Position ใต้ Navbar หลัก) ---
    <nav
      className="
        fixed top-20 left-0 w-full z-40
        bg-white/80 backdrop-blur-md
        shadow-[0_4px_10px_rgba(0,0,0,0.06)]
        border-b border-slate-200
      "
    >
      {/* ---------------- TOP BAR (ปุ่มนำทางหลัก) ---------------- */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 h-16 gap-2">
        {/* Left buttons (ปุ่ม 'กลุ่มทั้งหมด' และ 'กลุ่มของฉัน') */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/groups"
            className="
              border border-slate-300 hover:border-sky-500
              px-3 py-1.5 rounded-xl transition-all
              text-xs sm:text-sm text-slate-600 hover:text-sky-600
              hover:shadow-sm active:scale-95
            "
          >
            กลุ่มทั้งหมด
          </Link>

          <Link
            href="/myGroups"
            className="
              border border-slate-300 hover:border-sky-500
              px-3 py-1.5 rounded-xl transition-all
              text-xs sm:text-sm text-slate-600 hover:text-sky-600
              hover:shadow-sm active:scale-95
            "
          >
            กลุ่มของฉัน
          </Link>
        </div>

        {/* Toggle Button (ปุ่มแสดง/ซ่อนแถบกลุ่ม) */}
        <div className="flex justify-center">
          <button
            onClick={() => setIsGroupsVisible(!isGroupsVisible)}
            className="
              text-xs sm:text-sm text-slate-600
              hover:text-sky-600 transition-all
              px-3 py-1 rounded-lg
              hover:bg-sky-50 active:scale-95
            "
          >
            {isGroupsVisible ? "ซ่อนกลุ่ม ▲" : "กลุ่มที่ติดตาม ▼"}
          </button>
        </div>

        {/* Create button (ปุ่ม 'สร้างกลุ่ม') */}
        <div className="shrink-0">
          <Link
            href="/create"
            className="
              bg-gradient-to-r from-sky-500 to-sky-600
              px-4 py-2 rounded-full text-white
              text-xs sm:text-sm font-medium shadow-sm
              hover:shadow-md hover:scale-105
              active:scale-95 transition-all
            "
          >
            สร้างกลุ่ม
          </Link>
        </div>
      </div>

      {/* --------------- GROUP BAR (แถบแสดงกลุ่มที่ติดตาม) ---------------- */}
      <div
        className={`
          overflow-hidden transition-all duration-500 ease-in-out 
          border-t border-slate-200 bg-white/60 backdrop-blur-sm
          ${isGroupsVisible ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="flex gap-3 px-6 py-3 overflow-x-auto scrollbar-hide scroll-smooth">
          {groups.length === 0 ? (
            // กรณีไม่มีกลุ่มที่ติดตาม: แสดงข้อความ
            <div className="text-xs sm:text-sm text-slate-500 w-full text-center py-2">
              ยังไม่มีกลุ่มที่คุณติดตาม
            </div>
          ) : (
            // วนลูปแสดง Avatar/Link ของกลุ่มที่ติดตาม
            groups.map((group) => {
              const count = unreadCounts[group.id] || 0; // ดึงจำนวนที่ยังไม่อ่าน

              return (
                <div key={group.id} className="relative shrink-0">
                  <Link
                    href={`/groups/${group.id}`}
                    // เมื่อคลิก: ทำเครื่องหมายว่าอ่านแล้ว และอัปเดตสถานะการอ่านใน DB
                    onClick={() => markGroupAsRead(group.id)}
                    className="block"
                  >
                    {/* Avatar Bubble Container */}
                    <div
                      className="
                        w-11 h-11 rounded-full overflow-hidden 
                        bg-gradient-to-br from-slate-100 to-slate-200
                        shadow-md border border-white
                        hover:scale-110 transition-transform duration-200
                        flex items-center justify-center
                      "
                    >
                      {group.avatar_url ? (
                        // แสดงรูป Avatar กลุ่มจาก Storage
                        <Image
                          src={
                            supabase.storage
                              .from("groups")
                              .getPublicUrl(group.avatar_url).data.publicUrl
                          }
                          alt={group.name}
                          width={44}
                          height={44}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      ) : (
                        // Placeholder Icon หากไม่มี Avatar
                        <UsersRound className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                  </Link>

                  {/* Badge: แสดงจำนวนที่ยังไม่อ่าน (ถ้า count > 0) */}
                  {count > 0 && (
                    <span
                      className="
                        absolute top-0 right-0 translate-x-1/2
                        bg-red-600 text-white text-[10px] font-bold
                        w-5 h-5 flex items-center justify-center rounded-full
                        shadow-md
                      "
                    >
                      {/* แสดง 99+ ถ้าจำนวนเกิน 99 */}
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </nav>
  );
};