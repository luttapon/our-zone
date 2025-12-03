"use client"; // ระบุว่าไฟล์นี้ทำงานฝั่ง Client (Browser) เพราะมีการใช้ Hooks และการโต้ตอบกับผู้ใช้

import React, {
  useState,       // ใช้เก็บข้อมูลสถานะในหน้าเว็บ (เช่น รหัสที่กรอก, ข้อความแจ้งเตือน)
  useRef,         // ใช้เข้าถึง Element ของ HTML โดยตรง (ใช้จัดการ Focus ช่องกรอกรหัส)
  ChangeEvent,    // ชนิดข้อมูลสำหรับเหตุการณ์การพิมพ์
  KeyboardEvent,  // ชนิดข้อมูลสำหรับเหตุการณ์การกดปุ่มคีย์บอร์ด
  useEffect,      // ใช้ทำงานอัตโนมัติเมื่อหน้าเว็บโหลดเสร็จ
} from "react";
import { supabase } from "@/lib/supabase/client"; // นำเข้าเครื่องมือเชื่อมต่อฐานข้อมูล Supabase

// ====================================================================
// หน้าจอยืนยันรหัส OTP (One-Time Password)
// ====================================================================

export default function VerifyOtpPage() {
  
  // --- 1. ส่วนกำหนดตัวแปรและสถานะ (State) ---

  // เก็บค่ารหัส OTP 6 หลัก เป็น Array (เริ่มด้วยค่าว่าง 6 ช่อง)
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  
  // เก็บอีเมลของผู้ใช้ (จะดึงมาจาก URL)
  const [email, setEmail] = useState<string>("");
  
  // เก็บข้อความที่จะแสดงแจ้งเตือนผู้ใช้
  const [message, setMessage] = useState<string>("");
  
  // เก็บสถานะว่าข้อความแจ้งเตือนเป็น Error หรือไม่ (true=แดง, false=เขียว)
  const [isError, setIsError] = useState<boolean>(false);
  
  // เก็บสถานะว่ากำลังโหลดอยู่หรือไม่ (เพื่อล็อคปุ่มกด)
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ตัวแปรอ้างอิงไปยังช่องกรอก Input ทั้ง 6 ช่อง (เพื่อสั่งให้ Focus ได้)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // --- 2. ส่วนทำงานอัตโนมัติเมื่อโหลดหน้า (Effect) ---
  
  useEffect(() => {
    // ดึงค่า Query Parameters จาก URL (ส่วนหลังเครื่องหมาย ?)
    const searchParams = new URLSearchParams(window.location.search);
    const emailFromUrl = searchParams.get("email"); // หาตัวแปรชื่อ 'email'
    
    if (emailFromUrl) {
      // ถ้าเจออีเมล ให้บันทึกลง State
      setEmail(emailFromUrl);
    } else {
      // ถ้าไม่เจอ ให้แจ้งเตือน Error
      setMessage("ไม่พบอีเมลใน URL กรุณาลองใหม่");
      setIsError(true);
    }
  }, []); // ทำงานแค่ครั้งเดียวตอนเปิดหน้านี้

  // --- 3. ฟังก์ชันจัดการเหตุการณ์ (Event Handlers) ---

  // ฟังก์ชันทำงานเมื่อผู้ใช้พิมพ์ในช่อง OTP
  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;
    
    // ตรวจสอบความถูกต้อง: ต้องเป็นตัวเลข 0-9 เท่านั้น และยาวไม่เกิน 1 ตัว
    if (value.length > 1 || (value && !/^[0-9]$/.test(value))) {
      return; // ถ้าไม่ถูกเงื่อนไข ให้หยุดทำงาน
    }

    // สร้างสำเนา Array OTP เดิม แล้วอัปเดตค่าใหม่ลงไป
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // ระบบเลื่อนช่องอัตโนมัติ: ถ้าพิมพ์ตัวเลขแล้ว และไม่ใช่ช่องสุดท้าย
    if (value && index < 5) {
      // สั่งให้ย้าย Cursor ไปช่องถัดไป
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ฟังก์ชันทำงานเมื่อผู้ใช้กดปุ่มคีย์บอร์ด (สำหรับปุ่ม Backspace)
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    // ถ้ากด Backspace + ช่องปัจจุบันว่างเปล่า + ไม่ใช่ช่องแรกสุด
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // สั่งให้ย้าย Cursor ถอยกลับไปช่องก่อนหน้า
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ฟังก์ชันส่งข้อมูลยืนยัน OTP (เมื่อกดปุ่ม Submit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // ห้ามไม่ให้หน้าเว็บ Refresh
    setIsLoading(true); // เริ่มสถานะ Loading
    setMessage("");     // ล้างข้อความเก่า
    setIsError(false);

    // รวมตัวเลข 6 ช่องให้เป็นข้อความเดียว
    const fullOtp = otp.join("");

    // ตรวจสอบเบื้องต้น
    if (fullOtp.length !== 6) {
      setMessage("กรุณากรอกรหัส 6 หลักให้ครบถ้วน");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    if (!supabase || !email) {
      setMessage("เกิดข้อผิดพลาด: ไม่พบอีเมล หรือการตั้งค่า Supabase ไม่ถูกต้อง");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      // เรียกใช้ Supabase เพื่อยืนยันรหัส
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
        token: fullOtp,
        type: "email",
      });

      if (verifyError) {
        throw verifyError; // ถ้า Supabase แจ้ง Error ให้กระโดดไปส่วน catch
      }

      // ถ้าสำเร็จ
      setMessage("ยืนยันสำเร็จ! กำลังเปลี่ยนหน้าไปตั้งรหัสผ่านใหม่");
      setIsError(false);

      // รอ 1.5 วินาที แล้วเปลี่ยนหน้าไปตั้งรหัสผ่านใหม่
      setTimeout(() => {
        window.location.href = `/newPassword`;
      }, 1500);

    } catch (err: unknown) {
      console.error("Verify OTP error:", err);
      let errorMessage = "เกิดข้อผิดพลาดที่ไม่คาดคิด";
      
      // แปลงข้อความ Error ให้อ่านง่ายขึ้น
      if (err instanceof Error) {
        if (
          err.message.includes("Invalid OTP") ||
          err.message.includes("Invalid verification code") ||
          err.message.includes("expired")
        ) {
          errorMessage = "รหัส OTP 6 หลักไม่ถูกต้องหรือหมดอายุ";
        } else {
          errorMessage = err.message;
        }
      }
      setMessage(`เกิดข้อผิดพลาด: ${errorMessage}`);
      setIsError(true);
    } finally {
      setIsLoading(false); // จบการทำงาน ปลดล็อคปุ่ม
    }
  };

  // ฟังก์ชันขอรหัส OTP ใหม่ (Resend Code)
  const handleResendCode = async () => {
    setIsLoading(true);
    setMessage("");
    setIsError(false);

    if (!supabase || !email) {
      setMessage("ไม่พบอีเมล, ไม่สามารถส่งรหัสใหม่ได้");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      // สั่ง Supabase ให้ส่งรหัสใหม่ (เหมือนตอน Login)
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: false }, // ย้ำว่าไม่ต้องสร้าง user ใหม่
      });

      if (error) {
        throw error;
      }

      setMessage("ส่งรหัส OTP ใหม่สำเร็จแล้ว กรุณาตรวจสอบอีเมล");
      setIsError(false);
      
      // ล้างช่องกรอกรหัสให้ว่าง แล้วโฟกัสช่องแรกใหม่
      setOtp(new Array(6).fill(""));
      inputRefs.current[0]?.focus();

    } catch (err: unknown) {
      console.error("Resend OTP error:", err);
      let errorMessage = "เกิดข้อผิดพลาดในการส่งรหัสใหม่";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setMessage(`เกิดข้อผิดพลาด: ${errorMessage}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 4. ส่วนแสดงผลหน้าจอ (Render UI) ---
  return (
    // ฉากหลังแบบไล่สี (Gradient) เต็มหน้าจอ
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-green-500 to-blue-800 relative overflow-hidden">
      
      {/* เลเยอร์สีดำจางๆ เพื่อให้ตัวอักษรอ่านง่ายขึ้น */}
      <div className="absolute inset-0 bg-black opacity-50"></div>

      {/* กล่อง Card ตรงกลาง */}
      <div className="w-full max-w-sm relative z-10 px-2 sm:px-0">
        <div className="p-6 sm:p-8 bg-white/60 backdrop-blur-lg rounded-2xl shadow-2xl border-2 border-white/30 transform transition duration-500 hover:shadow-blue-600/30">
          
          {/* หัวข้อหน้าจอ */}
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              ยืนยันตัวตน
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 font-medium px-2 leading-relaxed">
              กรุณากรอกรหัส 6 หลักที่เราส่งไปให้ที่อีเมล
            </p>
            {/* แสดงอีเมลที่กำลังยืนยัน */}
            <p className="text-xs sm:text-sm text-gray-800 font-bold px-2">
              {email}
            </p>
          </div>

          {/* กล่องแสดงข้อความแจ้งเตือน (Success / Error) */}
          {message && (
            <div
              className={`p-3 mb-4 rounded-lg text-xs sm:text-sm font-semibold break-words ${
                isError
                  ? "bg-red-100 text-red-700 border border-red-300"   // สีแดงถ้า Error
                  : "bg-green-100 text-green-700 border border-green-300" // สีเขียวถ้าสำเร็จ
              }`}
            >
              {message}
            </div>
          )}

          {/* กล่องเตือน Developer ถ้าลืมใส่ค่า Config ของ Supabase */}
          {!supabase && !message && (
            <div className="p-3 mb-4 rounded-lg text-xs sm:text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
              <strong>คำเตือน:</strong> กรุณาตั้งค่า{" "}
              <code className="font-mono">YOUR_SUPABASE_URL</code> และ{" "}
              <code className="font-mono">YOUR_SUPABASE_ANON_KEY</code> ในโค้ด
            </div>
          )}

          {/* แบบฟอร์มกรอกรหัส */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* ชุดช่องกรอกรหัส 6 ช่อง */}
            <div className="flex justify-center gap-1.5 sm:gap-2 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  placeholder="•"
                  title={`OTP digit ${index + 1}`}
                  aria-label={`OTP digit ${index + 1}`}
                  className="w-10 h-10 sm:w-12 sm:h-12 text-center text-xl sm:text-2xl font-bold border-2 border-gray-300 bg-white rounded-lg 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 shadow-sm hover:border-gray-400"
                />
              ))}
            </div>

            {/* ปุ่มกดยืนยัน */}
            <button
              type="submit"
              disabled={
                isLoading || !email || !supabase || otp.join("").length < 6
              }
              className={`w-full py-3 sm:py-3.5 rounded-xl font-bold shadow-lg transition-all duration-300 ease-in-out text-base sm:text-lg ${
                isLoading || !email || !supabase || otp.join("").length < 6
                  ? "bg-blue-300 text-white cursor-not-allowed opacity-50" // สีจางเมื่อกดไม่ได้
                  : "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-blue-600/40 hover:shadow-blue-600/60 hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" // สีปกติ
              }`}
            >
              {isLoading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส OTP"}
            </button>
          </form>

          {/* ลิงก์กดขอรหัสใหม่ */}
          <div className="text-center mt-5 sm:mt-6">
            <button
              onClick={handleResendCode}
              disabled={isLoading || !email || !supabase}
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer transition duration-200 underline-offset-2 hover:underline py-2 px-3"
            >
              ไม่ได้รับรหัส? ส่งอีกครั้ง
            </button>
          </div>

        </div>
      </div>

      {/* ส่วนตกแต่งพื้นหลัง (Animation คลื่น) */}
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