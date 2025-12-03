"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react"; // ไอคอนรูปตา สำหรับเปิด/ปิดดูรหัสผ่าน
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interface)
// ====================================================================

// กำหนดว่าช่องกรอกรหัสผ่านต้องรับค่าอะไรบ้าง
interface PasswordInputProps {
  label?: string; // ป้ายกำกับ (มีหรือไม่มีก็ได้)
  id: string;     // รหัสอ้างอิงของช่อง
  value: string;  // ค่ารหัสผ่านที่กรอก
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // ฟังก์ชันเมื่อมีการพิมพ์
  autoComplete?: string; // การช่วยจำรหัสผ่านของ Browser
}

// ====================================================================
// Component ย่อย: ช่องกรอกรหัสผ่าน (PasswordInput)
// ====================================================================
// เป็นช่องกรอกที่สามารถกดปุ่มรูปตาเพื่อดูรหัสผ่านได้

const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  id,
  value,
  onChange,
  autoComplete = "off",
}) => {
  // เก็บสถานะว่าเปิดดูรหัสผ่านอยู่หรือไม่ (false = ปิด, true = เปิด)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // ถ้าเปิดดูอยู่ให้เป็น type="text" (เห็นตัวอักษร), ถ้าปิดให้เป็น "password" (เห็นจุดๆ)
  const inputType = isPasswordVisible ? "text" : "password";

  // เลือกไอคอน: ถ้าเปิดอยู่ใช้ EyeOff (ตาปิด), ถ้าปิดอยู่ใช้ Eye (ตาเปิด)
  const VisibilityIcon = isPasswordVisible ? EyeOff : Eye;

  return (
    <div>
      {/* แสดงป้ายกำกับถ้ามีส่งมา */}
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      <div className="relative">
        {/* ช่องกรอกข้อมูลหลัก */}
        <input
          type={inputType}
          id={id}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder="••••••••"
          // ตกแต่ง: ขอบมน, เงา, เปลี่ยนสีเมื่อโฟกัส
          className="w-full pl-3 pr-10 sm:pr-12 py-2.5 sm:py-3 border-2 border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 ease-in-out placeholder-gray-400 text-sm sm:text-base shadow-sm hover:border-gray-400"
        />
        
        {/* ปุ่มกดสลับการมองเห็น (รูปตาด้านขวา) */}
        <button
          type="button"
          onClick={() => setIsPasswordVisible(!isPasswordVisible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 transition duration-150 focus:outline-none"
          aria-label={isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        >
          <VisibilityIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>
    </div>
  );
};

// ====================================================================
// Component หลัก: หน้าเปลี่ยนรหัสผ่าน (ChangePasswordPage)
// ====================================================================

export default function ChangePasswordPage() {
  // --- 1. การจัดการข้อมูล (State) ---
  
  // เก็บค่ารหัสผ่านใหม่ทั้ง 2 ช่อง
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // เก็บสถานะการทำงานต่างๆ
  const [message, setMessage] = useState("");     // ข้อความแจ้งเตือน
  const [isError, setIsError] = useState(false);  // เป็น Error หรือไม่
  const [isLoading, setIsLoading] = useState(false); // กำลังโหลดหรือไม่
  
  // เก็บสถานะสิทธิ์: ผู้ใช้ล็อกอินหรือยัง (ถ้ามาจากการรีเซ็ตต้องมี Session)
  const [isAuthorized, setIsAuthorized] = useState(false);

  // --- 2. ทำงานอัตโนมัติเมื่อเปิดหน้า (useEffect) ---
  
  useEffect(() => {
    const checkSession = async () => {
      // ตรวจสอบกับ Supabase ว่าผู้ใช้นี้มี Session ที่ถูกต้องหรือไม่
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        // ถ้า Supabase แจ้ง Error
        setMessage(`เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ${error.message}`);
        setIsError(true);
      } else if (!session) {
        // ถ้าไม่มี Session (ไม่ได้ล็อกอิน หรือลิงก์หมดอายุ)
        setMessage("คุณไม่ได้รับอนุญาตให้เข้าหน้านี้ กรุณาเริ่มต้นใหม่");
        setIsError(true);
        // (ส่วนนี้เตรียมไว้สำหรับสั่งเปลี่ยนหน้ากลับไป Login)
        setTimeout(() => console.log("Redirecting to password reset page..."), 3000); 
      } else {
        // ถ้าทุกอย่างถูกต้อง: อนุญาตให้แสดงฟอร์มเปลี่ยนรหัส
        setIsAuthorized(true);
        setMessage("คุณยืนยันตัวตนสำเร็จแล้ว กรุณาตั้งรหัสผ่านใหม่");
        setIsError(false);
      }
    };
    
    // เรียกฟังก์ชันตรวจสอบทันทีที่หน้าเว็บโหลด
    checkSession();
  }, []); // [] หมายถึงทำแค่ครั้งเดียวตอนเริ่ม

  // --- 3. ฟังก์ชันทำงานเมื่อกดปุ่มบันทึก (Handler) ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // ห้ามรีเฟรชหน้า
    setIsLoading(true); // เริ่มโหลด
    setMessage("");     // ล้างข้อความเก่า
    setIsError(false);

    // ตรวจสอบ 1: กรอกครบไหม
    if (!newPassword || !confirmPassword) {
      setMessage("กรุณากรอกรหัสผ่านใหม่ และยืนยันรหัสผ่าน");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    // ตรวจสอบ 2: ความยาวรหัสผ่าน
    if (newPassword.length < 6) {
      setMessage("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    // ตรวจสอบ 3: รหัสผ่านตรงกันไหม
    if (newPassword !== confirmPassword) {
      setMessage("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      // สั่ง Supabase ให้อัปเดตรหัสผ่านของผู้ใช้นี้
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      
      if (updateError) throw updateError; // ถ้ามีปัญหา ให้กระโดดไปส่วน catch

      // ถ้าสำเร็จ
      setMessage("✅ อัปเดตรหัสผ่านสำเร็จ! กำลังนำคุณกลับไปหน้าหลัก...");
      setIsError(false);
      setIsLoading(false);
      
      // ล้างช่องกรอก
      setNewPassword("");
      setConfirmPassword("");

      // (ส่วนนี้เตรียมไว้สำหรับเปลี่ยนหน้าไป Home)
      setTimeout(() => console.log("Redirecting to home page..."), 2500); 

    } catch (err: unknown) {
      // ถ้าเกิดข้อผิดพลาด
      console.error("Update password error:", err);
      let errorMessage = "เกิดข้อผิดพลาดที่ไม่คาดคิด";
      
      if (err instanceof Error) errorMessage = err.message;
      
      setMessage(`เกิดข้อผิดพลาด: ${errorMessage}`);
      setIsError(true);
      setIsLoading(false);
    }
  };

  // --- 4. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // พื้นหลังไล่สีและจัดกึ่งกลาง
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-yellow-200 to-green-600 relative overflow-hidden">
      
      {/* เลเยอร์สีดำจางๆ เพื่อให้อ่านง่ายขึ้น */}
      <div className="absolute inset-0 bg-black opacity-50"></div>
      
      {/* กล่อง Card หลัก */}
      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        
        {/* กล่องเนื้อหา (พื้นหลังเบลอ) */}
        <div className="bg-white/50 backdrop-blur-lg p-6 sm:p-8 md:p-10 shadow-2xl rounded-2xl border-2 border-white/30 transform transition duration-500 hover:shadow-indigo-600/30">
          
          {/* หัวข้อหน้าจอ */}
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              ตั้งรหัสผ่านใหม่
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 font-medium px-2">
              กรุณากรอกรหัสผ่านใหม่ของคุณ
            </p>
          </div>

          {/* กล่องแจ้งเตือน (Success / Error) */}
          {message && (
            <div
              className={`p-3 mb-4 rounded-lg text-xs sm:text-sm font-semibold ${
                isError
                  ? "bg-red-100 text-red-700 border border-red-300" // สีแดงถ้า Error
                  : "bg-green-100 text-green-700 border border-green-300" // สีเขียวถ้าสำเร็จ
              }`}
            >
              {message}
            </div>
          )}

          {/* แสดงฟอร์มเฉพาะเมื่อตรวจสอบสิทธิ์ผ่านแล้ว (isAuthorized = true) */}
          {isAuthorized && (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* ช่องรหัสผ่านใหม่ */}
              <div>
                <label htmlFor="newPassword" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                  รหัสผ่านใหม่
                </label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-gray-500">รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร</p>
              </div>

              {/* ช่องยืนยันรหัสผ่านใหม่ */}
              <div>
                <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {/* ปุ่มบันทึก */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 sm:py-3.5 rounded-xl font-bold shadow-lg transition-all duration-300 ease-in-out text-base sm:text-lg mt-6 ${
                  isLoading
                    ? "bg-indigo-300 text-white cursor-not-allowed opacity-50" // สีจาง (กดไม่ได้)
                    : "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-indigo-600/40 hover:shadow-indigo-600/60 hover:from-indigo-700 hover:to-indigo-800 transform hover:scale-[1.02] cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" // สีปกติ
                }`}
              >
                {isLoading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Animation พื้นหลัง (คลื่น) */}
      <div className="wave-container">
        <div className="wave-blob wave-1"></div>
        <div className="wave-blob wave-2"></div>
        <div className="wave-blob wave-3"></div>
        <div className="wave-blob wave-small-1"></div>
        <div className="wave-blob wave-small-2"></div>
        <div className="wave-blob wave-small-3"></div>
        <div className="wave-blob wave-small-4"></div>
      </div>
    </div>
  );
}