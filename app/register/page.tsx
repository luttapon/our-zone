"use client";
import React, { useState } from "react";
// นำเข้า Icon ที่จำเป็น รวมถึง Eye และ EyeOff สำหรับการซ่อน/แสดงรหัสผ่าน
import { Mail, User, Lock, LucideIcon, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// --- InputField Component - ส่วนประกอบ Input ที่มี Icon และรองรับการสลับรหัสผ่าน ---
interface InputFieldProps {
  icon: LucideIcon;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
  id: string;
}

// InputField Component (ใช้ซ้ำได้สำหรับ Email, Username, Password)
const InputField = ({
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  required = true,
  id,
}: InputFieldProps) => {
  // 1. ตรวจสอบว่า Input นั้นเป็นประเภท 'password' หรือไม่
  const isPasswordField = type === "password";
  // 2. State สำหรับจัดการการมองเห็นรหัสผ่าน (เริ่มต้น: ซ่อน)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 3. กำหนดประเภท Input ที่แท้จริงที่จะใช้ใน DOM (text หรือ password)
  const inputType = isPasswordField
    ? isPasswordVisible // ถ้าเป็น Password Field:
      ? "text" // ...และผู้ใช้ต้องการเห็นรหัสผ่าน, ให้ใช้ type="text"
      : "password" // ...ถ้าไม่, ให้ใช้ type="password" (ซ่อน)
    : type; // ถ้าไม่ใช่ Password Field ให้ใช้ type ตามที่ถูกส่งมา

  // 4. Icon สำหรับปุ่มสลับ (เลือก EyeOff ถ้ากำลังแสดงอยู่ และ Eye ถ้าซ่อนอยู่)
  const VisibilityIcon = isPasswordVisible ? EyeOff : Eye;

  return (
    <div className="relative mb-4">
      {/* ไอคอนด้านซ้ายของ input */}
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
      <input
        // ใช้ inputType ที่คำนวณแล้ว (รองรับการสลับระหว่าง text/password)
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        id={id}
        // ปรับ padding ด้านขวาสำหรับปุ่มตาเปิดปิด (pr-10 / sm:pr-12)
        className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 border-2 border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 ease-in-out placeholder-gray-400 text-sm sm:text-base shadow-sm hover:border-gray-400"
      />

      {/* 5. ปุ่มสลับการมองเห็น (แสดงเฉพาะ Password Field เท่านั้น) */}
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
// ------------------------------------

const RegisterPage = () => {
  // State สำหรับเก็บข้อมูลแบบฟอร์ม
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // State สำหรับสถานะ Loading เมื่อเรียก API
  const [loading, setLoading] = useState(false);
  // State สำหรับข้อความแจ้งเตือนผู้ใช้
  const [message, setMessage] = useState("");

  const router = useRouter();

  // ฟังก์ชันสำหรับจัดการการคลิกลิงก์ไปหน้า Login
  const handleGoLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    router.push("/login");
  };

  // --- Logic: การลงทะเบียนกับ Supabase (handleRegister) ---
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // 💡 1. กำหนด URL สำหรับ Redirect หลังการยืนยันอีเมลสำเร็จ
      //    Supabase จะ Redirect ผู้ใช้ไปที่หน้านี้เมื่อคลิกยืนยันในอีเมล
      const redirectToUrl = `${window.location.origin}/confirmEmail?status=success`;

      // 2. เรียกใช้ Supabase Sign Up:
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username, // ข้อมูลเสริมที่ถูกส่งไป
          },
          // ⬅️ แก้ไขชื่อ Property เป็น emailRedirectTo
          emailRedirectTo: redirectToUrl, 
        },
      });

      if (authError) throw authError; // ตรวจสอบ Error จาก Auth
      if (!authData.user)
        throw new Error("Registration failed: Missing User ID.");

      // 3. ลงทะเบียนสำเร็จ: แสดงข้อความแจ้งเตือนให้ไปยืนยันอีเมล
      setMessage("สำเร็จ! ตรวจสอบอีเมลของคุณเพื่อยืนยันการลงทะเบียน");
      // เคลียร์ค่าในฟอร์ม
      setEmail("");
      setUsername("");
      setPassword("");
      
    } catch (err: unknown) {
      // 4. จัดการ Error
      let errorMessage = "เกิดข้อผิดพลาดในการลงทะเบียน";
      if (err instanceof Error) errorMessage = err.message;
      setMessage(errorMessage);
      console.error("Registration Error:", err);
    } finally {
      // ตั้งสถานะ Loading เป็น false เสมอเมื่อสิ้นสุดการทำงาน
      setLoading(false);
    }
  };

  // 4. ตรวจสอบว่ากรอกข้อมูลครบทุกช่องหรือไม่ (สำหรับเปิด/ปิดปุ่ม Submit)
  const isFormComplete =
    email.trim() !== "" &&
    username.trim() !== "" &&
    password.trim() !== "";

  return (
    // คอนเทนเนอร์หลักที่มีพื้นหลังเป็น Gradient และจัดกึ่งกลาง
    <div
      className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-purple-500 to-pink-400 relative overflow-hidden"
    >
      {/* Overlay สีดำจางๆ เพื่อให้ข้อความอ่านง่ายขึ้น */}
      <div className="absolute inset-0 bg-black opacity-50"></div>

      {/* การ์ดหลักสำหรับแบบฟอร์ม */}
      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">

        <div className="bg-white/50 backdrop-blur-lg p-6 sm:p-8 md:p-10 shadow-2xl rounded-2xl border-2 border-white/30 transform transition duration-500 hover:shadow-indigo-600/30">
          
          {/* หัวข้อและคำบรรยาย */}
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              ลงทะเบียน
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 font-medium px-2">
              โปรดกรอกรายละเอียดเพื่อดำเนินการต่อ
            </p>
          </div>

          {/* กล่องข้อความแจ้งเตือน (Success/Error) */}
          {message && (
            <div
              className={`p-3 mb-4 rounded-lg text-xs sm:text-sm font-semibold ${
                message.startsWith("สำเร็จ")
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-red-100 text-red-700 border border-red-300"
              }`}
            >
              {message}
            </div>
          )}

          {/* ฟอร์มลงทะเบียน */}
          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Input Email */}
            <div>
              <label htmlFor="email-input" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                อีเมล
              </label>
              <InputField
                id="email-input"
                icon={Mail}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
              />
            </div>
            
            {/* Input ชื่อผู้ใช้ */}
            <div>
              <label htmlFor="username-input" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                ชื่อผู้ใช้
              </label>
              <InputField
                id="username-input"
                icon={User}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
              />
            </div>
            
            {/* Input รหัสผ่าน */}
            <div>
              <label htmlFor="password-input" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                รหัสผ่าน
              </label>
              <InputField
                id="password-input"
                icon={Lock}
                type="password" // สำคัญ: กำหนด type="password" เพื่อเปิดใช้งานปุ่มสลับการมองเห็นใน InputField component
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {/* ปุ่มลงทะเบียน */}
            <button
              type="submit"
              // ปุ่มจะถูก Disabled ถ้ากรอกข้อมูลไม่ครบหรือกำลังโหลด
              disabled={!isFormComplete || loading}
              className={`w-full py-3 sm:py-3.5 rounded-xl font-bold shadow-lg transition-all duration-300 ease-in-out text-base sm:text-lg mt-6 ${
                !isFormComplete || loading
                  ? "bg-indigo-300 text-white cursor-not-allowed opacity-50" // Style เมื่อ Disabled
                  : "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-indigo-600/40 hover:shadow-indigo-600/60 hover:from-indigo-700 hover:to-indigo-800 transform hover:scale-[1.02] cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" // Style เมื่อ Active
              }`}
            >
              {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
            </button>
          </form>

          {/* Divider "หรือ" */}
          <div className="flex items-center my-5 sm:my-6">
            <hr className="flex-grow border-t border-gray-300" aria-hidden="true" />
            <span className="mx-3 sm:mx-4 text-xs sm:text-sm text-gray-500 font-medium">หรือ</span>
            <hr className="flex-grow border-t border-gray-300" aria-hidden="true" />
          </div>

          {/* ข้อความและลิงก์เข้าสู่ระบบ */}
          <div className="text-center text-xs sm:text-sm text-gray-700 font-medium">
            มีบัญชีอยู่แล้ว?{" "}
            <a
              href="/login"
              className="font-bold text-indigo-600 hover:text-indigo-800 transition duration-200 underline-offset-2 hover:underline"
              onClick={handleGoLogin}
            >
              เข้าสู่ระบบ
            </a>
          </div>
        </div>
      </div>
      {/* --- Wave Background --- */}
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

export default RegisterPage;