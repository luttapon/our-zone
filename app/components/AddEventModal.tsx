"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interfaces)
// ====================================================================

// โครงสร้างข้อมูลของกิจกรรม (Event)
interface CalendarEvent {
  id: string;
  group_id: string;
  user_id: string | null;
  title: string;
  description?: string | null;
  start_time: string; // เวลาเริ่ม (ISO string)
  end_time: string;   // เวลาจบ (ISO string)
}

// ข้อมูลที่ Component นี้ต้องการ (Props)
interface AddEventModalProps {
  groupId: string;        // รหัสกลุ่ม
  userId: string | null;  // รหัสผู้ใช้
  onClose: () => void;    // ฟังก์ชันปิดหน้าต่าง
  eventToEdit?: CalendarEvent | null; // ข้อมูลกิจกรรมเดิม (ถ้าเป็นการแก้ไข)
}

// ====================================================================
// Component หลัก: หน้าต่างเพิ่ม/แก้ไขกิจกรรม (AddEventModal)
// ====================================================================

const AddEventModal: React.FC<AddEventModalProps> = ({
  groupId,
  userId,
  onClose,
  eventToEdit = null,
}) => {
  
  // --- 1. ฟังก์ชันช่วย (Helper) ---
  
  // แปลงเวลาจาก ISO (2023-10-25T10:00:00.000Z) เป็น format ที่ input type="datetime-local" เข้าใจ (2023-10-25T10:00)
  const toLocalDatetime = (isoString: string | undefined): string => {
    if (!isoString) return "";
    return new Date(isoString).toISOString().slice(0, 16);
  };

  // --- 2. การจัดการข้อมูล (State) ---

  // ข้อมูลในฟอร์ม (ถ้ามี eventToEdit ให้ดึงมาใส่เลย ถ้าไม่มีให้เป็นค่าว่าง)
  const [title, setTitle] = useState(eventToEdit?.title || "");
  const [description, setDescription] = useState(eventToEdit?.description || "");
  const [startTime, setStartTime] = useState(toLocalDatetime(eventToEdit?.start_time));
  const [endTime, setEndTime] = useState(toLocalDatetime(eventToEdit?.end_time));

  // สถานะการทำงาน
  const [loading, setLoading] = useState(false);          // กำลังบันทึกหรือไม่
  const [error, setError] = useState<string | null>(null);// ข้อความ Error
  const [success, setSuccess] = useState(false);          // บันทึกสำเร็จหรือไม่

  // --- 3. ตั้งค่าฟอร์มเมื่อโหมดเปลี่ยน (Effect) ---
  
  // เมื่อ eventToEdit เปลี่ยน (เช่น เปลี่ยนจากโหมดเพิ่ม เป็นโหมดแก้ไข หรือเปลี่ยนกิจกรรมที่เลือก)
  useEffect(() => {
    if (eventToEdit) {
      // โหมดแก้ไข: เอาข้อมูลเดิมมาใส่ในช่อง
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description || "");
      setStartTime(toLocalDatetime(eventToEdit.start_time));
      setEndTime(toLocalDatetime(eventToEdit.end_time));
    } else {
      // โหมดเพิ่มใหม่: ล้างช่องให้ว่าง
      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
    }
  }, [eventToEdit]);

  // --- 4. ฟังก์ชันบันทึกข้อมูล (Submit Handler) ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // ห้ามรีเฟรชหน้า
    setError(null);     // ล้าง Error เก่า
    setSuccess(false);  // ล้างสถานะสำเร็จเก่า

    // ตรวจสอบความถูกต้อง (Validation)
    if (!title || !startTime || !endTime) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (!userId) {
      setError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }

    setLoading(true); // เริ่มบันทึก

    // แปลงเวลากลับเป็น ISO format เพื่อเก็บใน DB
    const isoStartTime = new Date(startTime).toISOString();
    const isoEndTime = new Date(endTime).toISOString();

    try {
      if (eventToEdit) {
        // --- กรณีแก้ไข (Update) ---
        const { error: updateError } = await supabase
          .from("calendar_events")
          .update({
            title,
            description: description || null,
            start_time: isoStartTime,
            end_time: isoEndTime,
          })
          .eq("id", eventToEdit.id); // อัปเดตที่ ID นี้เท่านั้น

        if (updateError) throw updateError;

      } else {
        // --- กรณีเพิ่มใหม่ (Insert) ---
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

      // บันทึกสำเร็จ
      setSuccess(true);
      
      // รอ 1 วินาที แล้วปิดหน้าต่าง (เพื่อให้ผู้ใช้เห็นข้อความสำเร็จก่อน)
      setTimeout(() => {
        onClose(); 
      }, 1000);

    } catch (err) {
      console.error(err);
      setError((err as Error).message || "เกิดข้อผิดพลาดที่ไม่คาดคิด");
    } finally {
      setLoading(false); // จบการทำงาน
    }
  };

  // --- 5. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // ฉากหลังสีดำจางๆ (Modal Overlay)
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300">
      
      {/* กล่องเนื้อหา Modal */}
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* ส่วนหัว (Header) */}
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

        {/* ส่วนฟอร์ม (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            {/* ช่องชื่อกิจกรรม */}
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

            {/* ช่องรายละเอียด */}
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

            {/* ช่องวันเวลา (แบ่ง 2 คอลัมน์) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* วันเริ่มต้น */}
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
              
              {/* วันสิ้นสุด */}
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

            {/* ข้อความแจ้งเตือน (Error / Success) */}
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

            {/* ปุ่มดำเนินการ */}
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