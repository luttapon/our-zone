"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูล (Interfaces) ---
// ----------------------------------------------------------------------
interface CalendarEvent {
  id: string;
  group_id: string;
  user_id: string | null;
  title: string;
  description?: string | null;
  start_time: string; // ISO string (บันทึกในฐานข้อมูล)
  end_time: string; // ISO string (บันทึกในฐานข้อมูล)
}

interface AddEventModalProps {
  groupId: string;
  userId: string | null;
  onClose: () => void;
  eventToEdit?: CalendarEvent | null; // ถ้ามีข้อมูลส่งมา แสดงว่าเป็นการ "แก้ไข"
}

// ----------------------------------------------------------------------
// --- Component หลัก: Modal เพิ่ม/แก้ไขกิจกรรม ---
// ----------------------------------------------------------------------
const AddEventModal: React.FC<AddEventModalProps> = ({
  groupId,
  userId,
  onClose,
  eventToEdit = null,
}) => {
  // --- Helper: แปลง ISO string เป็น format YYYY-MM-DDTHH:mm ---
  // เป็น format ที่ input type="datetime-local" ต้องการ
  const toLocalDatetime = (isoString: string | undefined): string => {
    if (!isoString) return "";
    // สร้าง Date object จาก ISO string และแปลงเป็น YYYY-MM-DDTHH:mm
    return new Date(isoString).toISOString().slice(0, 16);
  };

  // --- State: จัดการข้อมูลในฟอร์ม (กำหนดค่าเริ่มต้นจาก eventToEdit ถ้ามี) ---
  const [title, setTitle] = useState(eventToEdit?.title || "");
  const [description, setDescription] = useState(eventToEdit?.description || "");
  const [startTime, setStartTime] = useState(
    toLocalDatetime(eventToEdit?.start_time)
  );
  const [endTime, setEndTime] = useState(
    toLocalDatetime(eventToEdit?.end_time)
  );

  // --- State: สถานะการทำงาน ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // --- Logic: บันทึกข้อมูล (Submit Handler) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!title || !startTime || !endTime) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (!userId) {
      setError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }

    setLoading(true);

    // แปลง datetime-local string กลับเป็น ISO string ที่ Supabase ต้องการ
    const isoStartTime = new Date(startTime).toISOString();
    const isoEndTime = new Date(endTime).toISOString();

    try {
      if (eventToEdit) {
        // กรณีแก้ไข: อัปเดตข้อมูลเดิมในฐานข้อมูล
        const { error: updateError } = await supabase
          .from("calendar_events")
          .update({
            title,
            description: description || null,
            start_time: isoStartTime,
            end_time: isoEndTime,
          })
          .eq("id", eventToEdit.id);

        if (updateError) throw updateError;
      } else {
        // กรณีเพิ่มใหม่: เพิ่มแถวใหม่ลงฐานข้อมูล
        const { error: insertError } = await supabase
          .from("calendar_events")
          .insert([
            {
              group_id: groupId,
              user_id: userId,
              title,
              description: description || null,
              start_time: isoStartTime,
              end_time: isoEndTime,
            },
          ]);

        if (insertError) throw insertError;
      }

      // 2. สำเร็จ: แจ้งเตือนและปิด Modal อัตโนมัติ
      setSuccess(true);
      setTimeout(() => {
        onClose(); // เรียก onClose เพื่อปิด Modal และโหลดกิจกรรมใหม่ใน Parent
      }, 1000);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || "เกิดข้อผิดพลาดที่ไม่คาดคิด");
    } finally {
      setLoading(false);
    }
  };

  // --- Effect: อัปเดตฟอร์มเมื่อเปลี่ยน Event ที่จะแก้ไข ---
  useEffect(() => {
    if (eventToEdit) {
      // ตั้งค่าฟอร์มด้วยข้อมูลเดิม (สำหรับโหมดแก้ไข)
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description || "");
      setStartTime(toLocalDatetime(eventToEdit.start_time));
      setEndTime(toLocalDatetime(eventToEdit.end_time));
    } else {
      // เคลียร์ค่าฟอร์ม (สำหรับโหมดเพิ่มใหม่)
      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventToEdit]); // ทำงานเมื่อ eventToEdit เปลี่ยน

  return (
    // --- UI: Modal Overlay (Fixed Position) ---
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* ส่วนหัว Modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-white">
            {eventToEdit ? "แก้ไขกิจกรรม" : "เพิ่มวันสำคัญ"}
          </h2>
          {/* ปุ่มปิด */}
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-xl transition-colors leading-none"
          >
            ✕
          </button>
        </div>

        {/* ส่วนฟอร์ม (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            {/* ช่องกรอกชื่อกิจกรรม */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                ชื่อกิจกรรม <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                required
              />
            </div>

            {/* ช่องกรอกรายละเอียด */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                รายละเอียด
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 resize-none"
                rows={3}
              />
            </div>

            {/* ช่องเลือกวันเวลาเริ่มต้น-สิ้นสุด (Datetime-local) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  วันเริ่มต้น <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  วันสิ้นสุด <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>
            </div>

            {/* ข้อความแจ้งเตือน Error / Success */}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 text-green-700 rounded-md">
                บันทึกสำเร็จ!
              </div>
            )}

            {/* ปุ่มดำเนินการ (ยกเลิก / บันทึก) */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-600 transition cursor-pointer hover:bg-gray-50 hover:scale-105 active:scale-93"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition cursor-pointer hover:scale-105 active:scale-93 disabled:opacity-50"
              >
                {loading
                  ? "กำลังบันทึก..."
                  : eventToEdit
                  ? "บันทึกการแก้ไข"
                  : "บันทึกกิจกรรม"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEventModal;