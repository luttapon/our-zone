"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { MailCheck, XCircle, Loader2, ArrowRight } from 'lucide-react';
import React from 'react';

/**
 * หน้า Redirect สำหรับการยืนยันอีเมล
 * หน้าที่ถูกเปิดขึ้นมาเมื่อผู้ใช้คลิกลิงก์ในอีเมล (จาก Supabase Auth)
 */
export default function ConfirmEmailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // ตรวจสอบสถานะ: ว่า Redirect มาจากการยืนยันสำเร็จหรือไม่
    // (เราตั้งค่าจากหน้าลงทะเบียนให้ส่ง status=success มา)
    const status = searchParams.get('status');
    const isSuccess = status === 'success';

    // --- Handler: สั่งให้เบราว์เซอร์ทำการ Redirect แบบ Hard Reload ไปหน้า Login ---
    const handleGoToLogin = () => {
        // 💡 ใช้ window.location.href แทน router.push 
        //    เพื่อให้เบราว์เซอร์จัดการการนำทางและมีโอกาส 'กระโดด' ออกจาก 
        //    In-App Browser ไปยังเบราว์เซอร์มาตรฐานได้ง่ายขึ้น
        window.location.href = '/login'; 
    };

    // 1. Loading State (ถ้ายังไม่มี Query Parameter)
    if (!status) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                <p className="text-gray-600 font-medium">กำลังตรวจสอบสถานะการยืนยัน...</p>
            </div>
        );
    }
    
    // 2. Success/Error State
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
            <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md w-full text-center border border-gray-200">
                
                {isSuccess ? (
                    <>
                        <MailCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            การลงทะเบียนเสร็จสมบูรณ์!
                        </h1>
                        <p className="text-gray-700 text-lg font-medium">
                            คุณสามารถ **ปิดหน้านี้** หรือดำเนินการต่อ:
                        </p>
                    </>
                ) : (
                    <>
                        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            เกิดข้อผิดพลาดในการยืนยัน
                        </h1>
                        <p className="text-gray-700 text-lg font-medium">
                            โปรดตรวจสอบลิงก์อีกครั้งหรือกดปุ่มเพื่อลองเข้าสู่ระบบ
                        </p>
                    </>
                )}
                
                {/* ปุ่มทางเลือก: กลับไปหน้า Login (ใช้ window.location.href เพื่อความเสถียรบนมือถือ) */}
                <button
                    onClick={handleGoToLogin} 
                    className="mt-6 w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-95"
                >
                    ไปที่หน้าเข้าสู่ระบบ
                    <ArrowRight className='w-5 h-5'/>
                </button>
                
                {/* คำแนะนำสำหรับมือถือ */}
                {isSuccess && (
                     <p className="text-xs text-gray-400 mt-4">
                        (หากหน้าจอนี้เปิดในแอปเมล, โปรดกดปุ่มด้านบนเพื่อไปต่อในเบราว์เซอร์หลัก)
                     </p>
                )}
            </div>
        </div>
    );
}