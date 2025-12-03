"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Types)
// ====================================================================

// โครงสร้างข้อมูลกลุ่มแบบย่อ (เอาไว้แสดงในรายการ)
export type GroupMinimal = {
  id: string;
  name: string;
  avatar_url?: string | null;
  owner_id: string;
};

// รูปแบบของ Context (ข้อมูลที่จะส่งให้คนอื่นใช้)
type FollowedGroupsContextType = {
  groups: GroupMinimal[]; // รายชื่อกลุ่มทั้งหมด
  refreshGroups: () => void; // ฟังก์ชันสำหรับสั่งโหลดข้อมูลใหม่
};

// สร้าง Context ขึ้นมา (ค่าเริ่มต้นเป็นว่างๆ)
const FollowedGroupsContext = createContext<FollowedGroupsContextType>({
  groups: [],
  refreshGroups: () => {},
});

// ====================================================================
// Component หลัก: Provider (ตัวกระจายข้อมูล)
// ====================================================================

export const FollowedGroupsProvider = ({ children }: { children: ReactNode }) => {
  // เก็บรายการกลุ่มทั้งหมดไว้ใน State
  const [groups, setGroups] = useState<GroupMinimal[]>([]);

  // --- ฟังก์ชันดึงข้อมูลกลุ่มทั้งหมด (ที่สร้างเอง + ที่ติดตาม) ---
  const fetchGroups = async () => {
    // 1. ตรวจสอบก่อนว่าใครล็อกอินอยู่
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return; // ถ้าไม่ได้ล็อกอิน ก็จบการทำงาน

    // 2. ดึงกลุ่มที่ "ฉันเป็นเจ้าของ" (Owned Groups)
    const { data: ownedGroups } = await supabase
      .from("groups")
      .select("id,name,avatar_url,owner_id")
      .eq("owner_id", user.id);

    // 3. ดึงกลุ่มที่ "ฉันเป็นสมาชิก/ติดตาม" (Followed Groups)
    // ต้อง Join จากตาราง group_members ไปหาตาราง groups
    const { data: followedGroups } = await supabase
      .from("group_members")
      .select("groups(id,name,avatar_url,owner_id)")
      .eq("user_id", user.id);

    // กำหนด Type ชั่วคราวเพื่อช่วยในการแปลงข้อมูล
    type FollowedGroupRow = {
      groups?: GroupMinimal[] | null;
    };

    // 4. แปลงข้อมูลกลุ่มที่ติดตามให้อยู่ในรูปแบบ Array ปกติ (Flatten)
    const followedGroupsData: GroupMinimal[] = (followedGroups ?? [])
      .flatMap((f: FollowedGroupRow) => f.groups ?? [])
      .map(g => ({
        id: g.id,
        name: g.name,
        avatar_url: g.avatar_url ?? null,
        owner_id: g.owner_id,
      }));

    // 5. รวมกลุ่มทั้ง 2 ประเภทเข้าด้วยกัน และตัดตัวซ้ำออก
    // (กันพลาดกรณีที่เป็นทั้งเจ้าของและสมาชิกในเวลาเดียวกัน)
    const combinedGroups: GroupMinimal[] = [
      ...(ownedGroups ?? []),
      ...followedGroupsData,
    ].filter(
      (value, index, self) => 
        // เช็คว่า ID นี้ปรากฏเป็นครั้งแรกหรือไม่ (ถ้าเจอซ้ำจะถูกกรองออก)
        index === self.findIndex(g => g.id === value.id)
    );

    // บันทึกลง State เพื่อให้ Component อื่นนำไปใช้
    setGroups(combinedGroups);
  };

  // --- ทำงานทันทีเมื่อเริ่มโหลด (Effect) ---
  useEffect(() => {
    const loadGroups = async () => {
      await fetchGroups();
    };

    loadGroups();
  }, []); // [] หมายถึงทำแค่ครั้งเดียวตอนเปิดเว็บ

  // ส่งข้อมูล (groups) และฟังก์ชัน (refreshGroups) ไปให้ลูกหลานใช้งาน
  return (
    <FollowedGroupsContext.Provider value={{ groups, refreshGroups: fetchGroups }}>
      {children}
    </FollowedGroupsContext.Provider>
  );
};

// ====================================================================
// Custom Hook: สำหรับเรียกใช้ข้อมูลนี้จากที่อื่นได้ง่ายๆ
// ====================================================================
export const useFollowedGroups = () => useContext(FollowedGroupsContext);