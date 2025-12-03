"use client"; // แจ้งให้ Next.js ทราบว่าหน้านี้ทำงานบน Browser (ฝั่ง Client)

import React, { useState } from "react";
import { Mail, User, Lock, LucideIcon, Eye, EyeOff } from "lucide-react"; // นำเข้าไอคอนสวยๆ
import { useRouter } from "next/navigation"; // เครื่องมือสำหรับเปลี่ยนหน้าเว็บ
import { supabase } from "@/lib/supabase/client"; // เครื่องมือเชื่อมต่อฐานข้อมูล Supabase

// ====================================================================
// ส่วนประกอบย่อย: InputField (ช่องกรอกข้อมูล)
// ====================================================================

// กำหนดว่าช่องกรอกข้อมูลต้องรับค่าอะไรบ้าง
interface InputFieldProps {
  icon: LucideIcon; // รูปไอคอนด้านซ้าย
  type: string;     // ประเภทข้อมูล (text, email, password)
  value: string;    // ข้อความที่พิมพ์อยู่
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // ฟังก์ชันเมื่อมีการพิมพ์
  placeholder: string; // ข้อความจางๆ บอกใบ้
  required?: boolean;  // จำเป็นต้องกรอกไหม
  id: string;          // รหัสระบุช่อง
}

// Component ช่องกรอกข้อมูล (รองรับการกดดูรหัสผ่านได้)
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
  
  // ตัวแปรเก็บสถานะการมองเห็นรหัสผ่าน (เริ่มต้นคือปิดอยู่)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // คำนวณประเภท Input จริงๆ ที่จะแสดง (ถ้าเปิดตาให้เป็น text, ถ้าปิดตาให้เป็น password)
  const inputType = isPasswordField
    ? isPasswordVisible
      ? "text"
      : "password"
    : type;

  // เลือกไอคอนลูกตา (EyeOff = ปิดตา, Eye = เปิดตา)
  const VisibilityIcon = isPasswordVisible ? EyeOff : Eye;

  return (
    <div className="relative mb-4">
      {/* ไอคอนด้านซ้ายของช่อง */}
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
      
      <input
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        id={id}
        // ตกแต่งช่องกรอก: มีขอบมน, มีเงา, เปลี่ยนสีเมื่อกดคลิก
        className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 border-2 border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 ease-in-out placeholder-gray-400 text-sm sm:text-base shadow-sm hover:border-gray-400"
      />

      {/* ปุ่มลูกตา (แสดงเฉพาะช่อง Password) */}
      {isPasswordField && (
        <button
          type="button"
          onClick={() => setIsPasswordVisible(!isPasswordVisible)} // สลับสถานะเปิด/ปิด
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
// หน้าจอหลัก: RegisterPage (ลงทะเบียน)
// ====================================================================

const RegisterPage = () => {
  // --- 1. การจัดการข้อมูล (State) ---
  const [email, setEmail] = useState("");     // เก็บอีเมล
  const [username, setUsername] = useState(""); // เก็บชื่อผู้ใช้
  const [password, setPassword] = useState(""); // เกบรหัสผ่าน
  const [loading, setLoading] = useState(false); // เก็บสถานะว่ากำลังโหลดอยู่ไหม
  const [message, setMessage] = useState("");    // เก็บข้อความแจ้งเตือนผู้ใช้

  const router = useRouter(); // ตัวช่วยเปลี่ยนหน้า

  // --- 2. ฟังก์ชันทำงาน (Handlers) ---

  // เมื่อกดลิงก์ไปหน้า Login
  const handleGoLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    router.push("/login"); // สั่งให้เปลี่ยนหน้าไปที่ /login
  };

  // เมื่อกดปุ่ม "ลงทะเบียน"
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // ห้ามไม่ให้หน้าเว็บ Refresh เอง
    setMessage("");     // ล้างข้อความเก่า
    setLoading(true);   // เริ่มโหลด (หมุนติ้วๆ หรือล็อคปุ่ม)

    try {
      // ส่งข้อมูลไปสมัครสมาชิกที่ Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // บันทึกชื่อผู้ใช้ (username) ไปด้วย
          data: {
            username: username,
          },
          // emailRedirectTo: redirectToUrl, 
        },
      });

      if (authError) throw authError; // ถ้า Supabase แจ้ง Error ให้ข้ามไปส่วน catch
      
      // เช็คว่าได้ข้อมูล User กลับมาจริงไหม
      if (!authData.user)
        throw new Error("Registration failed: Missing User ID.");

      // ถ้าสำเร็จ
      setMessage("สำเร็จ! ตรวจสอบอีเมลของคุณเพื่อยืนยันการลงทะเบียน");
      // ล้างช่องกรอกให้ว่างเปล่า
      setEmail("");
      setUsername("");
      setPassword("");
      
    } catch (err: unknown) {
      // ถ้าเกิดข้อผิดพลาด
      let errorMessage = "เกิดข้อผิดพลาดในการลงทะเบียน";
      if (err instanceof Error) errorMessage = err.message;
      
      setMessage(errorMessage); // แสดงข้อความ Error
      console.error("Registration Error:", err);
    } finally {
      // จบการทำงาน (ไม่ว่าจะสำเร็จหรือล้มเหลว) ให้ปลดล็อคปุ่ม
      setLoading(false);
    }
  };

  // เช็คว่ากรอกครบทุกช่องหรือยัง (ถ้าครบจะเป็น true)
  const isFormComplete =
    email.trim() !== "" &&
    username.trim() !== "" &&
    password.trim() !== "";

  // --- 3. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // พื้นหลังไล่สีและจัดกึ่งกลาง
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-purple-500 to-pink-400 relative overflow-hidden">
      
      {/* เลเยอร์สีดำจางๆ เพื่อให้อ่านง่ายขึ้น */}
      <div className="absolute inset-0 bg-black opacity-50"></div>

      {/* กล่อง Card หลัก */}
      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">

        {/* กล่องเนื้อหา (พื้นหลังเบลอแบบกระจกฝ้า) */}
        <div className="bg-white/50 backdrop-blur-lg p-6 sm:p-8 md:p-10 shadow-2xl rounded-2xl border-2 border-white/30 transform transition duration-500 hover:shadow-indigo-600/30">
          
          {/* หัวข้อหน้าจอ */}
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              ลงทะเบียน
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 font-medium px-2">
              โปรดกรอกรายละเอียดเพื่อดำเนินการต่อ
            </p>
          </div>

          {/* กล่องแจ้งเตือน (Success / Error) */}
          {message && (
            <div
              className={`p-3 mb-4 rounded-lg text-xs sm:text-sm font-semibold ${
                // ถ้าข้อความขึ้นต้นด้วย "สำเร็จ" ให้เป็นสีเขียว ถ้าไม่ใช่ให้เป็นสีแดง
                message.startsWith("สำเร็จ")
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-red-100 text-red-700 border border-red-300"
              }`}
            >
              {message}
            </div>
          )}

          {/* แบบฟอร์มกรอกข้อมูล */}
          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* ช่อง Email */}
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
            
            {/* ช่อง Username */}
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
            
            {/* ช่อง Password */}
            <div>
              <label htmlFor="password-input" className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                รหัสผ่าน
              </label>
              <InputField
                id="password-input"
                icon={Lock}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {/* ปุ่มกดลงทะเบียน */}
            <button
              type="submit"
              // ปุ่มกดไม่ได้ถ้า: กรอกไม่ครบ หรือ กำลังโหลดอยู่
              disabled={!isFormComplete || loading}
              className={`w-full py-3 sm:py-3.5 rounded-xl font-bold shadow-lg transition-all duration-300 ease-in-out text-base sm:text-lg mt-6 ${
                !isFormComplete || loading
                  ? "bg-indigo-300 text-white cursor-not-allowed opacity-50" // สีจาง (กดไม่ได้)
                  : "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-indigo-600/40 hover:shadow-indigo-600/60 hover:from-indigo-700 hover:to-indigo-800 transform hover:scale-[1.02] cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" // สีปกติ
              }`}
            >
              {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
            </button>
          </form>

          {/* เส้นขีดคั่น "หรือ" */}
          <div className="flex items-center my-5 sm:my-6">
            <hr className="flex-grow border-t border-gray-300" aria-hidden="true" />
            <span className="mx-3 sm:mx-4 text-xs sm:text-sm text-gray-500 font-medium">หรือ</span>
            <hr className="flex-grow border-t border-gray-300" aria-hidden="true" />
          </div>

          {/* ลิงก์ไปหน้าเข้าสู่ระบบ */}
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

      {/* Animation พื้นหลัง (คลื่นขยับได้) */}
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