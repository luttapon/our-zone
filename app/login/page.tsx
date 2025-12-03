"use client"; // แจ้ง Next.js ว่าไฟล์นี้ทำงานที่ฝั่ง Browser (Client Side)

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation"; // เครื่องมือสำหรับเปลี่ยนหน้าเว็บ
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase
import { Lock, LucideIcon, Eye, EyeOff } from "lucide-react"; // ไอคอนต่างๆ

// ====================================================================
// ส่วนกำหนดรูปแบบข้อมูล (Interface)
// ====================================================================

// กำหนดว่าช่องกรอกข้อมูลต้องรับค่าอะไรบ้าง
interface InputFieldProps {
  icon: LucideIcon; // รูปไอคอน
  type: string;     // ประเภทข้อมูล (text, password)
  value: string;    // ค่าที่พิมพ์อยู่
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // ฟังก์ชันเมื่อมีการพิมพ์
  placeholder: string; // ข้อความจางๆ บอกใบ้
  required?: boolean;  // จำเป็นต้องกรอกไหม
  id: string;          // รหัสอ้างอิงช่อง
}

// โครงสร้างข้อมูลสำหรับข้อความแจ้งเตือน
interface MessageState {
  text: string;
  type: "success" | "error" | ""; // ประเภท: สำเร็จ, ผิดพลาด, หรือว่างเปล่า
}

// ====================================================================
// Component ย่อย: ช่องกรอกข้อมูล (InputField)
// ====================================================================

const InputField = ({
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  required = true,
  id,
}: InputFieldProps) => {
  // ตรวจสอบว่าเป็นช่องรหัสผ่านหรือไม่
  const isPasswordField = type === "password";
  
  // เก็บสถานะว่าเปิดดูรหัสผ่านอยู่หรือไม่ (เริ่มต้นปิดอยู่)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // คำนวณประเภทช่อง: ถ้าเป็นรหัสผ่านและกดเปิดตา -> แสดงเป็น text, ถ้าไม่ -> เป็น password
  const inputType = isPasswordField
    ? isPasswordVisible
      ? "text"
      : "password"
    : type;

  // เลือกไอคอนลูกตา (EyeOff = ตาปิด, Eye = ตาเปิด)
  const VisibilityIcon = isPasswordVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      {/* ไอคอนด้านซ้าย */}
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
      
      {/* ช่องกรอกข้อมูล */}
      <input
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        id={id}
        // ตกแต่ง: เว้นระยะซ้ายขวาเผื่อไอคอน, ขอบมน, เปลี่ยนสีเมื่อกด
        className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 border border-gray-300 bg-white/80 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out placeholder-gray-400 text-sm sm:text-base shadow-sm hover:border-gray-400"
      />

      {/* ปุ่มกดดูรหัสผ่าน (แสดงเฉพาะช่อง Password) */}
      {isPasswordField && (
        <button
          type="button"
          onClick={() => setIsPasswordVisible(!isPasswordVisible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 transition duration-150 focus:outline-none"
          aria-label={isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        >
          <VisibilityIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      )}
    </div>
  );
};

// ====================================================================
// Component หลัก: หน้าเข้าสู่ระบบ (App)
// ====================================================================

const App: React.FC = () => {
  // --- 1. การจัดการข้อมูล (State) ---
  const [username, setUsername] = useState<string>(""); // เก็บอีเมล
  const [password, setPassword] = useState<string>(""); // เก็บรหัสผ่าน
  const [loading, setLoading] = useState<boolean>(false); // เก็บสถานะกำลังโหลด
  
  // เก็บข้อความแจ้งเตือน (ข้อความ และ ประเภท)
  const [message, setMessage] = useState<MessageState>({ text: "", type: "" });

  const router = useRouter(); // ตัวช่วยเปลี่ยนหน้า

  // --- 2. ฟังก์ชันช่วยทำงาน (Helpers) ---

  // ฟังก์ชันแสดงข้อความแจ้งเตือนและลบออกเองใน 5 วินาที
  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage({ text: "", type: "" });
    }, 5000);
  };

  // เลือกสีพื้นหลังข้อความตามประเภท (เขียว=สำเร็จ, แดง=พลาด)
  const messageClasses =
    message.type === "success"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";

  // --- 3. ฟังก์ชันหลัก (Handlers) ---

  // เมื่อกดปุ่ม "เข้าสู่ระบบ"
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // ห้ามรีเฟรชหน้า
    setLoading(true);   // เริ่มโหลด
    setMessage({ text: "", type: "" }); // ล้างข้อความเก่า

    // ส่งข้อมูลไปตรวจสอบกับ Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password: password,
    });

    setLoading(false); // หยุดโหลด

    if (error) {
      // ถ้าเข้าสู่ระบบไม่ผ่าน
      console.error("Login error:", error.message);
      showMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง", "error");
    } else if (data.user) {
      // ถ้าสำเร็จ
      showMessage("เข้าสู่ระบบสำเร็จ! กำลังไปหน้าหลัก...", "success");

      // รอ 1 วินาที แล้วย้ายไปหน้า Profile
      setTimeout(() => {
        router.push("/profile");
        router.refresh(); // บังคับโหลดข้อมูลใหม่
      }, 1000);
    }
  };

  // ฟังก์ชันเปลี่ยนหน้าต่างๆ
  const handleGoBack = () => router.push("/"); // กลับหน้าแรก
  const handleGoRegister = () => router.push("/register"); // ไปสมัครสมาชิก
  const handleGopasswordreset = () => router.push("/passwordReset"); // ไปหน้ารีเซ็ตรหัส

  // --- 4. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // พื้นหลังไล่สีและจัดกึ่งกลาง
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-cyan-500 to-purple-500 relative overflow-hidden">
      
      {/* เลเยอร์สีดำจางๆ */}
      <div className="absolute inset-0 bg-black opacity-50"></div>

      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        
        {/* ปุ่มย้อนกลับ */}
        <button
          type="button"
          onClick={handleGoBack}
          aria-label="ย้อนกลับไปหน้าหลัก"
          className="flex items-center justify-start mb-4 sm:mb-6 text-gray-600 hover:text-gray-900 transition-all duration-200 p-2 px-3 rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/80 focus:outline-none shadow-sm cursor-pointer border border-gray-200"
        >
          {/* ไอคอนลูกศรย้อนกลับ */}
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 mr-1 sm:mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          <span className="text-sm sm:text-base font-semibold">ย้อนกลับ</span>
        </button>

        {/* กล่อง Card หลัก (พื้นหลังเบลอ) */}
        <div className="bg-white/70 backdrop-blur-xl p-6 sm:p-8 md:p-10 shadow-2xl rounded-2xl border border-white/50 transform transition duration-500 hover:shadow-indigo-600/10">
          
          {/* แสดงข้อความแจ้งเตือน (ถ้ามี) */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm text-center font-medium ${messageClasses}`}>
              {message.text}
            </div>
          )}

          {/* หัวข้อหน้าจอ */}
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              เข้าสู่ระบบ
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 font-medium px-2">
              โปรดกรอกรายละเอียดเพื่อดำเนินการต่อ
            </p>
          </div>

          {/* แบบฟอร์ม Login */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* ช่องกรอกอีเมล */}
            <div className="mb-4 sm:mb-5">
              <label htmlFor="username" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                อีเมล
              </label>
              <InputField
                id="username"
                icon={Lock} // ใช้อาคอน Lock ตามต้นฉบับ
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="example@mail.com"
              />
            </div>

            {/* ช่องกรอกรหัสผ่าน */}
            <div className="mb-5 sm:mb-6">
              <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                รหัสผ่าน
              </label>
              <InputField
                id="password"
                icon={Lock}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />

              {/* ลิงก์ลืมรหัสผ่าน */}
              <div className="flex justify-end mt-2 sm:mt-3">
                <a
                  href="#"
                  className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 transition duration-200 ease-in-out underline-offset-2 hover:underline py-1 px-2 rounded"
                  onClick={handleGopasswordreset}
                >
                  ลืมรหัสผ่าน?
                </a>
              </div>
            </div>

            {/* ปุ่มกดเข้าสู่ระบบ */}
            <button
              type="submit"
              disabled={loading || !username || !password} // กดไม่ได้ถ้า: กำลังโหลด หรือ กรอกไม่ครบ
              className="w-full py-3 sm:py-3.5 bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/40 hover:shadow-blue-600/60 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 ease-in-out transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-base sm:text-lg cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* ลิงก์ไปหน้าสมัครสมาชิก */}
          <p className="text-center text-xs sm:text-sm text-gray-700 mt-6 sm:mt-8 font-medium">
            ยังไม่มีบัญชี?{" "}
            <a
              href="#"
              className="font-bold text-blue-600 hover:text-blue-800 transition duration-200 underline-offset-2 hover:underline"
              onClick={handleGoRegister}
            >
              ลงทะเบียนที่นี่
            </a>
          </p>
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

export default App;