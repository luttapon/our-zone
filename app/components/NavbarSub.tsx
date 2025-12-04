"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { useFollowedGroups } from "@/lib/context/FollowedGroupsContext"; // Context เก็บข้อมูลกลุ่มที่ติดตาม
import { usePathname } from "next/navigation"; // Hook ดู URL ปัจจุบัน
import type { RealtimeChannel } from "@supabase/supabase-js"; // Type สำหรับระบบ Realtime
import { UsersRound } from "lucide-react"; // ไอคอนรูปกลุ่มคน
import { useScrollDirection } from "@/lib/hooks/useScrollDirection"; // Hook ตรวจสอบการเลื่อนหน้าจอ

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Types)
// ====================================================================

// ข้อมูลพื้นฐานของกลุ่ม
interface Group {
  id: string;
  name: string;
  avatar_url: string | null;
  owner_id: string; // รหัสเจ้าของกลุ่ม
}

// ข้อมูลสถานะการอ่านของ User ในแต่ละกลุ่ม
interface UserGroupReadStatus {
  group_id: string;
  last_read_at: string; // เวลาที่อ่านล่าสุด
}

// ====================================================================
// Component หลัก: แถบนำทางรอง (NavbarSub)
// ====================================================================

export const NavbarSub = () => {
  
  // --- 1. การจัดการข้อมูล (Hooks & State) ---
  const { groups } = useFollowedGroups(); // ดึงรายชื่อกลุ่มที่ติดตาม
  const pathname = usePathname();         // ดึง URL ปัจจุบัน
  const isScrollingUp = useScrollDirection(); // ตรวจสอบว่ากำลังเลื่อนขึ้นหรือไม่

  // เก็บจำนวนโพสต์ที่ยังไม่อ่านของแต่ละกลุ่ม { idกลุ่ม: จำนวน }
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null); // เก็บ ID ผู้ใช้

  // --- 2. โหลดข้อมูลผู้ใช้ (Effect) ---
  useEffect(() => {
    // ดึง Session เพื่อเอา User ID
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });
  }, []);

  // --- 3. ฟังก์ชันทำเครื่องหมายว่าอ่านแล้ว (เมื่อคลิกเข้ากลุ่ม) ---
  const markGroupAsRead = async (groupId: string) => {
    if (!userId) return;

    // บันทึกเวลาอ่านล่าสุดลงฐานข้อมูล (ถ้ามีอยู่แล้วจะอัปเดตแทน)
    await supabase.from("user_group_read_status").upsert(
      [
        {
          user_id: userId,
          group_id: groupId,
          last_read_at: new Date().toISOString(), // เวลาปัจจุบัน
        },
      ],
      { onConflict: "user_id,group_id" } // เงื่อนไขป้องกันข้อมูลซ้ำ
    );

    // รีเซ็ตตัวเลขแจ้งเตือนในหน้าจอให้เป็น 0 ทันที
    setUnreadCounts((prev) => ({
      ...prev,
      [groupId]: 0,
    }));
  };

  // --- 4. โหลดจำนวนโพสต์ที่ยังไม่อ่าน & ตั้งค่า Realtime (Effect) ---
  useEffect(() => {
    if (groups.length === 0 || !userId) return; // ถ้าไม่มีข้อมูลก็จบการทำงาน

    const fetchUnreadCounts = async () => {
      // 4.1 ดึงเวลาที่อ่านล่าสุดของทุกกลุ่มที่ติดตาม
      const { data: readStatusData } = (await supabase
        .from("user_group_read_status")
        .select("group_id, last_read_at")
        .in(
          "group_id",
          groups.map((g) => g.id)
        )
        .eq("user_id", userId)) as { data: UserGroupReadStatus[] | null };

      const counts: Record<string, number> = {};

      // 4.2 วนลูปนับจำนวนโพสต์ใหม่ในแต่ละกลุ่ม
      for (const group of groups) {
        const status = readStatusData?.find((s) => s.group_id === group.id);
        const lastReadTime = status?.last_read_at;

        // สร้างคำสั่งนับจำนวนโพสต์ (ไม่นับโพสต์ของตัวเอง)
        let query = supabase
          .from("posts")
          .select("id", { count: "exact", head: true }) // นับจำนวนอย่างเดียว ไม่เอาข้อมูล
          .eq("group_id", group.id)
          .neq("user_id", userId);

        // ถ้ารู้เวลาอ่านล่าสุด -> นับเฉพาะโพสต์ที่ใหม่กว่าเวลานั้น
        if (lastReadTime) query = query.gt("created_at", lastReadTime);

        const { count, error } = await query;

        if (error) {
          console.error(`Error fetching post count for ${group.id}:`, error);
          counts[group.id] = 0;
        } else {
          // ถ้ากำลังดูหน้ากลุ่มนั้นอยู่ หรือเป็นเจ้าของกลุ่ม -> ถือว่าอ่านแล้ว (0)
          if (pathname === `/groups/${group.id}` || group.owner_id === userId) {
            counts[group.id] = 0;
          } else {
            counts[group.id] = count ?? 0;
          }
        }
      }
      setUnreadCounts(counts); // อัปเดต State
    };

    fetchUnreadCounts();

    // --- 4.3 ระบบ Realtime (แจ้งเตือนทันทีเมื่อมีโพสต์ใหม่) ---
    const channel: RealtimeChannel = supabase
      .channel("group_unread_counter")
      .on(
        "postgres_changes",
        {
          event: "INSERT", // ฟังเฉพาะการเพิ่มข้อมูล (โพสต์ใหม่)
          schema: "public",
          table: "posts",
          // กรองเฉพาะกลุ่มที่ติดตามอยู่
          filter: `group_id=in.(${groups.map((g) => g.id).join(",")})`,
        },
        (payload) => {
          const newPost = payload.new as { group_id: string; user_id: string };
          const groupId = newPost.group_id;
          const group = groups.find((g) => g.id === groupId);

          // ถ้าโพสต์ของตัวเอง หรือกำลังดูหน้ากลุ่มนั้นอยู่ -> ไม่ต้องแจ้งเตือน
          if (newPost.user_id === userId) return;
          if (!group || pathname === `/groups/${groupId}`) return;

          // เพิ่มตัวเลขแจ้งเตือน +1
          setUnreadCounts((prev) => ({
            ...prev,
            [groupId]: (prev[groupId] || 0) + 1,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // ล้างการเชื่อมต่อเมื่อเลิกใช้
    };
  }, [groups, pathname, userId]);

  // --- 5. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // Navbar รอง: ติดตายตัว (Fixed) ใต้ Navbar หลัก
    <nav
      className={`
        fixed left-0 w-full z-40
        bg-white/80 backdrop-blur-md
        shadow-[0_4px_10px_rgba(0,0,0,0.06)]
        border-b border-slate-200
        transition-all duration-300 ease-in-out
        ${isScrollingUp 
          ? "top-20 opacity-100 translate-y-0" // เลื่อนขึ้น -> แสดง
          : "top-20 opacity-0 -translate-y-full pointer-events-none" // เลื่อนลง -> ซ่อน
        }
      `}
    >
      {/* 5.1 แถบเมนูด้านบน (Top Bar) */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 h-16 gap-2">
        
        {/* ปุ่มเมนูซ้าย */}
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

        {/* ปุ่มสร้างกลุ่ม */}
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

      {/* 5.2 แถบแสดงรายการกลุ่ม (Group Bar) */}
      <div
        className="
          overflow-hidden transition-all duration-500 ease-in-out 
          border-t border-slate-200 bg-white/60 backdrop-blur-sm
        "
      >
        <div className="flex gap-3 px-6 py-3 overflow-x-auto scrollbar-hide scroll-smooth">
          {groups.length === 0 ? (
            // ถ้าไม่มีกลุ่มที่ติดตาม
            <div className="text-xs sm:text-sm text-slate-500 w-full text-center py-2">
              ยังไม่มีกลุ่มที่คุณติดตาม
            </div>
          ) : (
            // แสดงรายการกลุ่ม
            groups.map((group) => {
              const count = unreadCounts[group.id] || 0; // จำนวนที่ยังไม่อ่าน

              return (
                <div key={group.id} className="relative shrink-0">
                  <Link
                    href={`/groups/${group.id}`}
                    onClick={() => markGroupAsRead(group.id)} // กดแล้วเคลียร์แจ้งเตือน
                    className="block"
                  >
                    {/* กรอบรูปโปรไฟล์กลุ่ม */}
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
                        <UsersRound className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                  </Link>

                  {/* ป้ายแจ้งเตือน (Badge) สีแดง */}
                  {count > 0 && (
                    <span
                      className="
                        absolute top-0 right-0 translate-x-1/2
                        bg-red-600 text-white text-[10px] font-bold
                        w-5 h-5 flex items-center justify-center rounded-full
                        shadow-md
                      "
                    >
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