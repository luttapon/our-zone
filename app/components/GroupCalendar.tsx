"use client";

import React, { useEffect, useState } from "react";
// ใช้ Component ปฏิทินภายนอก (React Calendar)
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css"; // Style หลักของ React Calendar
import { supabase } from "@/lib/supabase/client";
// สมมติว่ามี Component Modal สำหรับเพิ่ม/แก้ไขอยู่แล้ว
import AddEventModal from "./AddEventModal"; 

// ----------------------------------------------------------------------
// --- กำหนดโครงสร้างข้อมูล (Interfaces) ---
// ----------------------------------------------------------------------
interface CalendarEvent {
  id: string;
  group_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  start_time: string; // ISO string: เวลาเริ่มต้น
  end_time: string; // ISO string: เวลาสิ้นสุด
}

interface GroupCalendarProps {
  groupId: string;
  userId: string | null;
  isOwner: boolean; // ใช้ตรวจสอบสิทธิ์ในการเพิ่ม/แก้ไข/ลบกิจกรรม
}

// ----------------------------------------------------------------------
// --- Component หลัก: GroupCalendar ---
// ----------------------------------------------------------------------
const GroupCalendar: React.FC<GroupCalendarProps> = ({
  groupId,
  userId,
  isOwner,
}) => {
  // --- State: การจัดการปฏิทินและข้อมูล ---
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // วันที่เลือกในปฏิทิน
  const [events, setEvents] = useState<CalendarEvent[]>([]); // กิจกรรมทั้งหมดในกลุ่ม
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // --- State: การจัดการ Modals ---
  const [showAddModal, setShowAddModal] = useState(false); // Modal เพิ่ม/แก้ไขกิจกรรม
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null); // ข้อมูลกิจกรรมที่ต้องการแก้ไข

  const [showDetail, setShowDetail] = useState(false); // Modal รายละเอียดกิจกรรมในวัน
  const [detailEvents, setDetailEvents] = useState<CalendarEvent[]>([]); // กิจกรรมที่ตรงกับวันที่เลือก
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  ); // กิจกรรมที่ถูกเลือกดูใน Modal รายละเอียด

  // --- Effect: ล็อค/ปลดล็อคการเลื่อนหน้าจอเมื่อเปิด/ปิด Modal รายละเอียด ---
  useEffect(() => {
    if (showDetail) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    // Cleanup function: ให้แน่ใจว่า scroll กลับมาทำงานเมื่อ Component ถูกทำลาย
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showDetail]);

  // --- Logic: ดึงข้อมูลกิจกรรมทั้งหมดจาก Supabase ---
  const fetchEvents = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Query: ดึงกิจกรรมทั้งหมดของ group_id นี้
      const { data, error, status } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("group_id", groupId)
        .order("start_time", { ascending: true }); // เรียงตามเวลาเริ่มต้น

      setLoading(false);

      if (error) {
        console.error("Supabase fetchEvents error:", { error, status });
        setFetchError(error.message || `Server responded with status ${status}`);
        setEvents([]);
        return;
      }

      setEvents((data as CalendarEvent[]) || []);
    } catch (err) {
      setLoading(false);
      console.error("Unexpected fetchEvents error:", err);
      setFetchError((err as Error).message || "Unexpected error");
    }
  };

  // ดึงข้อมูลเมื่อ component โหลด หรือ groupId เปลี่ยน
  useEffect(() => {
    fetchEvents();
  }, [groupId]);

  // --- Helper: กรองกิจกรรมตามวันที่ (ใช้สำหรับ Modal รายละเอียด) ---
  const getEventsForDay = (date: Date) =>
    events
      .filter((e) => {
        const eventStart = new Date(e.start_time);
        const eventEnd = new Date(e.end_time);
        const checkDate = new Date(date);

        // ตั้งค่าเวลาเป็น 00:00:00:000 เพื่อเปรียบเทียบเฉพาะ วัน/เดือน/ปี
        eventStart.setHours(0, 0, 0, 0);
        // ตั้งค่าเวลาสิ้นสุดของวันให้เป็น 23:59:59:999 เพื่อรวมกิจกรรมที่สิ้นสุดในวันนั้น
        eventEnd.setHours(23, 59, 59, 999);
        checkDate.setHours(0, 0, 0, 0); // วันที่ที่ต้องการตรวจสอบ

        // กิจกรรมต้องมีช่วงเวลาที่ **ครอบคลุม** หรือ **ตรงกับ** วันที่ checkDate
        return checkDate >= eventStart && checkDate <= eventEnd;
      })
      .slice(0); // สร้างสำเนา Array

  // --- Helper: นับจำนวนกิจกรรมในวันนั้นๆ (ใช้สำหรับ Calendar Tile) ---
  const getEventCountForDay = (date: Date) =>
    events.filter((e) => {
      const eventStart = new Date(e.start_time);
      const eventEnd = new Date(e.end_time);
      const checkDate = new Date(date);

      // ใช้ Logic เดียวกันในการตรวจสอบวันที่ (เปรียบเทียบเฉพาะวัน)
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(23, 59, 59, 999);
      checkDate.setHours(0, 0, 0, 0);

      // นับกิจกรรมที่ตรงกับวันนั้น
      return checkDate >= eventStart && checkDate <= eventEnd;
    }).length;

  // --- Handlers: การโต้ตอบกับปฏิทิน ---

  // เปลี่ยนวันที่ถูกเลือก (เมื่อเปลี่ยนเดือน/ปี หรือเลือกวันใหม่)
  const handleDateChange: React.ComponentProps<typeof Calendar>["onChange"] = (
    value
  ) => {
    if (!value) return;
    // รองรับการรับค่าแบบ Date หรือ Array[Date]
    if (value instanceof Date) setSelectedDate(value);
    else if (Array.isArray(value) && value[0] instanceof Date)
      setSelectedDate(value[0]);
  };

  // คลิกที่ช่องวันในปฏิทิน
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    const dayEvents = getEventsForDay(date); // กรองกิจกรรมสำหรับวันนั้น
    setDetailEvents(dayEvents);
    setSelectedEvent(null); // รีเซ็ตการเลือกกิจกรรมย่อย
    setShowDetail(true); // เปิด Modal รายละเอียด
  };

  // --- Logic: การลบกิจกรรม (ใช้ใน Modal รายละเอียด) ---
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("คุณแน่ใจว่าจะลบกิจกรรมนี้หรือไม่?")) return;
    try {
      // ลบกิจกรรมจากตาราง 'calendar_events'
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId); // ลบตาม ID

      if (error) throw error;

      // ลบสำเร็จ: ปิด Modal และโหลดกิจกรรมใหม่
      setShowDetail(false);
      fetchEvents();
    } catch (err) {
      alert((err as Error).message || "ลบกิจกรรมไม่สำเร็จ");
    }
  };

  // ----------------------------------------------------------------------
  // --- JSX (Return Statement) ---
  // ----------------------------------------------------------------------
  return (
    <div className="bg-gradient-to-br from-sky-50 via-white to-blue-50 rounded-3xl shadow-xl border border-sky-100 w-full max-w-6xl mx-auto">
      
      {/* 1. ส่วนหัว */}
      <div className="mb-6 text-center p-6">
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-700 to-blue-700 mb-1">
          ปฏิทินกลุ่ม
        </h2>
        <p className="text-sm text-gray-600">
          เลือกวันที่เพื่อดูรายละเอียดกิจกรรม
        </p>
      </div>
      
      {/* 2. ปฏิทิน (Calendar) */}
      <div className="flex justify-center px-4 pb-4">
        <Calendar
          className="w-full bg-white rounded-2xl shadow-md border border-gray-200 custom-calendar"
          value={selectedDate}
          onChange={handleDateChange}
          onClickDay={handleDayClick} // เมื่อคลิกที่วัน
          nextLabel="›"
          prevLabel="‹"
          // กำหนด Class CSS ตามสถานะของวัน (มีกิจกรรม, ถูกเลือก)
          tileClassName={({ date }) => {
            const eventCount = getEventCountForDay(date);
            const isSelected =
              new Date(date).toDateString() === selectedDate.toDateString();

            if (isSelected) return "selected-day";
            if (eventCount > 0) {
              if (eventCount === 1) return "event-day-1";
              if (eventCount === 2) return "event-day-2";
              if (eventCount >= 3) return "event-day-3plus";
            }
            return undefined;
          }}
          // แสดงจุดสี (Indicator) บอกจำนวนกิจกรรม
          tileContent={({ date, view }) => {
            if (view === "month") {
              const eventCount = getEventCountForDay(date);
              if (eventCount === 0) return null;

              // กำหนดสีตามจำนวนกิจกรรม
              const colors = [
                "bg-gradient-to-r from-red-500 to-red-600",
                "bg-gradient-to-r from-orange-500 to-orange-600",
                "bg-gradient-to-r from-amber-500 to-amber-600",
              ];
              // เลือกสีตามจำนวนกิจกรรม (จำกัดที่ 3 สี)
              const colorIndex = Math.min(eventCount - 1, 2); 

              return (
                <div
                  className={`mt-1.5 flex items-center justify-center ${colors[colorIndex]} text-white text-xs font-bold px-2 py-1 rounded-full shadow-md`}
                >
                  {eventCount > 9 ? "9+" : eventCount}
                </div>
              );
            }
            return null;
          }}
        />
      </div>

      {/* 3. สถานะ Loading & Error */}
      <div className="px-6 pb-6">
        {loading && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2 animate-pulse">
            ⏳ กำลังโหลดกิจกรรม...
          </div>
        )}
        {fetchError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ❌ ไม่สามารถโหลดกิจกรรม: {fetchError}
          </div>
        )}
      </div>

      {/* 4. ปุ่มเพิ่มกิจกรรม (เฉพาะเจ้าของกลุ่ม) */}
      <div className="px-6 pb-6">
        {isOwner && (
          <button
            onClick={() => {
              setEventToEdit(null); // เคลียร์ข้อมูลเก่า (สำหรับโหมดเพิ่ม)
              setShowAddModal(true); // เปิด Modal เพิ่ม/แก้ไข
            }}
            className="mt-5 w-full px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-500 text-white font-semibold rounded-2xl hover:from-sky-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl active:scale-95 cursor-pointer hover:scale-105"
          >
            ➕ เพิ่มวันสำคัญ
          </button>
        )}
      </div>

      {/* 5. Modal: เพิ่ม/แก้ไขกิจกรรม */}
      {showAddModal && (
        <AddEventModal
          groupId={groupId}
          userId={userId}
          onClose={() => {
            setShowAddModal(false);
            fetchEvents(); // โหลดข้อมูลใหม่หลังจากเพิ่ม/แก้ไขเสร็จ
          }}
          eventToEdit={eventToEdit}
        />
      )}

      {/* 6. Modal: รายละเอียดกิจกรรมในแต่ละวัน */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
          onClick={() => setShowDetail(false)} // ปิด Modal เมื่อคลิกนอก
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            onClick={(e) => e.stopPropagation()} // ป้องกันการปิด Modal เมื่อคลิกที่เนื้อหา
          >
            {/* Header Modal */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex justify-between items-center shrink-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {/* แสดงวันที่ที่ถูกเลือก */}
                  {selectedDate.toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {/* แสดงจำนวนกิจกรรม */}
                  {detailEvents.length === 0
                    ? "ไม่มีกิจกรรม"
                    : `มีทั้งหมด ${detailEvents.length} กิจกรรม`}
                </p>
              </div>
              <button
                title="Close the detail modal"
                onClick={() => setShowDetail(false)}
                className="w-8 h-8 flex items-center justify-center p-0 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 text-xl transition-colors cursor-pointer leading-none"
              >
                ✕
              </button>
            </div>

            {/* Body Modal: รายการกิจกรรม (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              <div className="space-y-3">
                {detailEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <span className="text-4xl mb-3">😴</span>
                    <span className="text-sm">ไม่มีวันสำคัญในวันนี้</span>
                  </div>
                ) : (
                  detailEvents.map((ev, idx) => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      // ไฮไลต์กิจกรรมที่ถูกเลือก
                      className={`relative overflow-hidden border p-4 rounded-xl shadow-sm transition-transform hover:scale-[1.02] bg-white cursor-pointer ${
                        selectedEvent?.id === ev.id
                          ? "border-sky-500 ring-2 ring-sky-200"
                          : ""
                      }`}
                    >
                      {/* แถบสีด้านซ้าย (กำหนดสีตาม Index) */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          [
                            "bg-red-500",
                            "bg-orange-500",
                            "bg-amber-500",
                          ][idx % 3]
                        }`}
                      ></div>

                      {/* รายละเอียดกิจกรรม */}
                      <div className="pl-3">
                        <h4 className="font-bold text-lg text-gray-800 leading-tight">
                          {ev.title}
                        </h4>
                        {ev.description && (
                          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3 text-xs font-medium text-gray-500 bg-gray-100 w-fit px-2 py-1 rounded-md">
                          {/* แสดงเวลาเริ่มต้น - สิ้นสุด */}
                          🕒{" "}
                          {new Date(ev.start_time).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {new Date(ev.end_time).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Modal: ปุ่มแก้ไข/ลบ (เฉพาะเจ้าของกลุ่มและเลือกกิจกรรมแล้ว) */}
            <div className="p-4 border-t border-gray-100 bg-white flex gap-3 shrink-0">
              {isOwner && selectedEvent && ( // แสดงเมื่อเป็นเจ้าของและเลือกกิจกรรมแล้ว
                <>
                  <button
                    onClick={() => {
                      setEventToEdit(selectedEvent); // กำหนดกิจกรรมที่ต้องการแก้ไข
                      setShowDetail(false); // ปิด Modal รายละเอียด
                      setShowAddModal(true); // เปิด Modal เพิ่ม/แก้ไข
                    }}
                    className="flex-1 px-4 py-2.5 bg-sky-600 text-white font-semibold rounded-xl hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 cursor-pointer"
                  >
                    ✏️ แก้ไขกิจกรรม
                  </button>
                  <button
                    onClick={async () => {
                      // เรียกใช้ Logic การลบกิจกรรม
                      await handleDeleteEvent(selectedEvent.id);
                    }}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 cursor-pointer"
                  >
                    🗑 ลบกิจกรรม
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupCalendar;