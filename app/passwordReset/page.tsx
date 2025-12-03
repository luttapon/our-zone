"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import React, { useState } from "react";
import { useRouter } from "next/navigation"; // เครื่องมือสำหรับเปลี่ยนหน้าเว็บ
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interface)
// ====================================================================

// กำหนดว่าช่องกรอกข้อมูล (InputField) ต้องรับค่าอะไรบ้าง
interface InputFieldProps {
  icon: React.ReactNode; // รูปไอคอน (SVG)
  type: string;          // ประเภทของช่อง (text, email, password)
  value: string;         // ข้อความที่พิมพ์อยู่
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // ฟังก์ชันเมื่อมีการพิมพ์
  placeholder: string;   // ข้อความจางๆ บอกใบ้
  required?: boolean;    // จำเป็นต้องกรอกไหม
}

// ====================================================================
// Component ย่อย: ช่องกรอกข้อมูล (Input Field)
// ====================================================================

const InputField = ({
  icon,
  type,
  value,
  onChange,
  placeholder,
  required = true,
}: InputFieldProps) => (
  <div className="relative mb-4">
    {/* ไอคอนด้านซ้าย */}
    <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-500">
      {icon}
    </div>
    
    {/* ช่องกรอกข้อมูล */}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      // ตกแต่ง: ขอบมน, มีเงา, เปลี่ยนสีขอบเมื่อกด
      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 border-2 border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out placeholder-gray-400 text-sm sm:text-base shadow-sm hover:border-gray-400"
    />
  </div>
);

// ====================================================================
// Component หลัก: PasswordResetForm (ฟอร์มขอรหัสผ่านใหม่)
// ====================================================================

const PasswordResetForm = () => {
  // --- 1. การจัดการข้อมูล (State) ---
  const [email, setEmail] = useState("");      // เก็บอีเมลที่ผู้ใช้กรอก
  const [message, setMessage] = useState("");  // เก็บข้อความแจ้งเตือน
  const [isError, setIsError] = useState(false); // เก็บสถานะว่าเป็น Error หรือไม่
  const [isLoading, setIsLoading] = useState(false); // เก็บสถานะว่ากำลังโหลดอยู่ไหม

  const router = useRouter(); // ตัวช่วยเปลี่ยนหน้าเว็บ

  // --- 2. ฟังก์ชันทำงาน (Handlers) ---

  // เมื่อกดปุ่ม "ส่งรหัส OTP"
  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // ห้ามรีเฟรชหน้าเว็บ
    setIsLoading(true); // เริ่มหมุนติ้วๆ (Loading)
    setMessage("");     // ล้างข้อความเก่า
    setIsError(false);

    // ตรวจสอบว่ากรอกอีเมลหรือยัง
    if (!email) {
      setMessage("กรุณากรอกอีเมลที่ใช้ลงทะเบียน");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    // ตรวจสอบการเชื่อมต่อ Supabase (ป้องกัน Error)
    if (!supabase) {
      setMessage("เกิดข้อผิดพลาด: กรุณาตั้งค่า Supabase URL และ Anon Key ในโค้ด");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      // ส่งคำขอ OTP ไปที่อีเมลผ่าน Supabase
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          // ห้ามสร้าง User ใหม่ (ต้องเป็นคนที่มีบัญชีอยู่แล้วเท่านั้น)
          shouldCreateUser: false, 
        },
      });

      if (error) {
        throw error; // ถ้ามีปัญหา ให้กระโดดไปส่วน catch
      } else {
        // ถ้าสำเร็จ: เปลี่ยนหน้าไปยืนยัน OTP
        window.location.href = `/verify?email=${encodeURIComponent(email)}`;
        setMessage(`✅ ส่งรหัส OTP ไปยัง ${email} แล้ว กำลังนำคุณไปยังหน้ายืนยัน...`);
        setIsError(false);
      }
    } catch (err: unknown) {
      // ถ้าเกิดข้อผิดพลาด
      console.error("Unexpected error:", err);
      let errorMessage = "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง";
      
      if (err instanceof Error) {
        errorMessage = err.message; // ดึงข้อความ Error จริงมาแสดง
      }
      setMessage(errorMessage);
      setIsError(true);
    } finally {
      // จบการทำงาน (ไม่ว่าจะสำเร็จหรือล้มเหลว) ให้เลิกหมุนติ้วๆ
      setIsLoading(false);
    }
  };

  // เมื่อกดลิงก์ "กลับไปหน้าเข้าสู่ระบบ"
  const handleGoRegister = () => {
    router.push("/login"); // ไปที่หน้า Login
  };

  // ไอคอนรูปซองจดหมาย (SVG Code)
  const MailIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-mail"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );

  // --- 3. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // พื้นหลังไล่สีและจัดกึ่งกลาง
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-linear-to-br from-pink-400 to-yellow-200 relative overflow-hidden">
      
      {/* เลเยอร์สีดำจางๆ เพื่อให้อ่านง่ายขึ้น */}
      <div className="absolute inset-0 bg-black opacity-50"></div>

      {/* กล่อง Card หลัก */}
      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        
        {/* กล่องเนื้อหา (พื้นหลังเบลอแบบกระจกฝ้า) */}
        <div className="bg-white/60 backdrop-blur-lg p-6 sm:p-8 md:p-10 rounded-2xl shadow-2xl border-2 border-white/30 transform transition duration-500 hover:shadow-blue-600/30">
          
          {/* หัวข้อหน้าจอ */}
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              รีเซ็ตรหัสผ่าน
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 font-medium px-2 leading-relaxed">
              กรุณากรอกอีเมลที่คุณใช้ลงทะเบียนเพื่อรับ OTP สำหรับตั้งรหัสผ่านใหม่
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

          {/* กล่องเตือน Developer (ถ้าลืมตั้งค่า) */}
          {!supabase && !message && (
            <div className="p-3 mb-4 rounded-lg text-xs sm:text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
              <strong>คำเตือน:</strong> ฟอร์มนี้ยังไม่ได้เชื่อมต่อกับ Supabase
              กรุณาตั้งค่า <code className="font-mono">supabaseUrl</code> และ{" "}
              <code className="font-mono">supabaseAnonKey</code> ในโค้ด
            </div>
          )}

          {/* แบบฟอร์มกรอกอีเมล */}
          <form onSubmit={handleResetPassword} className="space-y-4">
            
            {/* ช่องกรอกอีเมล */}
            <div>
              <label htmlFor="email-input" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                อีเมล
              </label>
              <InputField
                icon={MailIcon}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
              />
            </div>

            {/* ปุ่มกดส่ง */}
            <button
              type="submit"
              // ปุ่มกดไม่ได้ถ้า: ไม่มีอีเมล หรือ กำลังโหลด
              disabled={!email || isLoading || !supabase}
              className={`w-full py-3 sm:py-3.5 rounded-xl font-bold shadow-lg transition-all duration-300 ease-in-out text-base sm:text-lg mt-6 ${
                !email || isLoading || !supabase
                  ? "bg-blue-300 text-white cursor-not-allowed opacity-50" // สีจาง (กดไม่ได้)
                  : "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-blue-600/40 hover:shadow-blue-600/60 hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" // สีปกติ
              }`}
            >
              {isLoading ? "กำลังส่ง..." : "ส่งรหัส OTP"}
            </button>
          </form>

          {/* ลิงก์กลับไปหน้า Login */}
          <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-700 font-medium">
            <a
              href="#"
              className="font-bold text-blue-600 hover:text-blue-800 transition duration-200 underline-offset-2 hover:underline inline-flex items-center gap-1"
              onClick={handleGoRegister}
            >
              <span>←</span>
              <span>กลับไปหน้าเข้าสู่ระบบ</span>
            </a>
          </div>

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
};

export default PasswordResetForm;