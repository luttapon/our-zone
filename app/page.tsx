"use client" // ระบุว่าไฟล์นี้จะทำงานที่ฝั่ง Browser (Client Component)

import Image from 'next/image' // เครื่องมือของ Next.js สำหรับโหลดและแสดงผลรูปภาพให้เร็วขึ้น
import { useRouter } from 'next/navigation' // เครื่องมือสำหรับสั่งเปลี่ยนหน้าเว็บไซต์
import { useState, useEffect } from 'react' // ฟังก์ชันพื้นฐานของ React (จัดการค่าตัวแปร และ การทำงานอัตโนมัติ)
import './globals.css' // นำเข้าไฟล์ตกแต่งหน้าตา (CSS)

// --- ส่วนกำหนดโครงสร้างข้อมูล (Data) ---

// กำหนดว่าข้อมูล "ฟีเจอร์" 1 อัน ต้องมีหน้าตาแบบนี้
interface Feature {
  icon: string      // ไอคอน (เช่น รูปอีโมจิ)
  title: string     // หัวข้อ
  description: string // คำอธิบาย
}

// ข้อมูลที่จะนำไปโชว์ในกล่องเลื่อน (Carousel)
const features: Feature[] = [
  { icon: "📰", title: "ติดตามข่าวสาร", description: "อัปเดตข้อมูลล่าสุดจากชุมชน" },
  { icon: "💬", title: "แลกเปลี่ยน", description: "พื้นที่พูดคุยและแบ่งปันความคิด" },
  { icon: "👥", title: "สร้างกลุ่ม", description: "รวมตัวกับผู้ที่มีความสนใจเดียวกัน" }
]

// --- ส่วนหน้าจอหลัก (Component) ---

export default function Page() {
  // สร้างตัวแปรสำหรับสั่งเปลี่ยนหน้า
  const router = useRouter()
  
  // สร้างตัวแปรเก็บว่าตอนนี้กำลังโชว์สไลด์แผ่นที่เท่าไหร่ (เริ่มที่ 0)
  const [currentSlide, setCurrentSlide] = useState<number>(0)

  // ฟังก์ชันตั้งเวลาให้สไลด์เลื่อนเองอัตโนมัติ
  useEffect(() => {
    // ตั้งเวลาให้ทำงานทุกๆ 4 วินาที (4000 มิลลิวินาที)
    const timer = setInterval(() => {
      // เปลี่ยนเลขสไลด์ถัดไป ถ้าถึงตัวสุดท้ายแล้วให้วนกลับมาเริ่มใหม่ (ใช้ % หารเอาเศษ)
      setCurrentSlide((prev) => (prev + 1) % features.length)
    }, 4000)

    // เมื่อปิดหน้านี้ ให้ยกเลิกการตั้งเวลาเพื่อไม่ให้เปลืองทรัพยากรเครื่อง
    return () => clearInterval(timer)
  }, []) // ทำงานแค่ครั้งเดียวตอนเปิดหน้านี้ขึ้นมา

  // --- ส่วนแสดงผล (HTML/JSX) ---
  return (
    // กรอบใหญ่สุด เต็มจอ (h-screen) ห้ามเลื่อนล้น (overflow-hidden)
    <div className="h-screen w-full overflow-hidden bg-gray-50 flex flex-col relative">
      
      {/* 1. ส่วนหัวเว็บไซต์ (Header) */}
      <header className="w-full p-6 flex items-center shrink-0 z-20">
        <div className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight">
          Proximity Link
        </div>
      </header>

      {/* 2. เนื้อหาหลักตรงกลาง (Main Content) */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row-reverse items-center z-10 h-full pb-0 lg:pb-6">

        {/* 2.1 ส่วนข้อความและปุ่มกด (ฝั่งซ้ายของจอใหญ่) */}
        <div className="w-full px-6 flex flex-col items-center lg:text-left pt-2 lg:pt-0 lg:w-1/2 justify-center">

          {/* ข้อความต้อนรับ */}
          <div className="space-y-4 mb-5 lg:mb-8 ">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-blue-950 leading-tight">
              ยินดีต้อนรับสู่<br />
              <span className="text-blue-600">ชุมชนออนไลน์</span>
            </h1>

            <p className="text-sm lg:text-lg text-gray-600 font-light max-w-md mx-auto lg:mx-0 leading-tight">
              แพลตฟอร์มสำหรับการเชื่อมต่อ แบ่งปันประสบการณ์ และสร้างสรรค์สิ่งใหม่ๆ
            </p>

            {/* กลุ่มปุ่มกด (Login / Register) */}
            <div className="flex flex-row gap-3 w-full max-w-md sm:max-w-none lg:w-auto mb-4 mt-15 lg:mb-8">
              
              {/* ปุ่มเข้าสู่ระบบ */}
              <button 
                type="button"
                onClick={() => router.push('/login')} // คลิกแล้วไปหน้า Login
                className="flex-1 sm:flex-none sm:w-auto px-4 sm:px-8 rounded-full bg-blue-600 hover:bg-blue-700 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                เข้าสู่ระบบ
              </button>

              {/* ปุ่มลงทะเบียน */}
              <button 
                type="button"
                onClick={() => router.push('/register')} // คลิกแล้วไปหน้า Register
                className="flex-1 sm:flex-none sm:w-auto px-4 sm:px-8 rounded-full bg-white hover:bg-gray-50 py-3 text-sm font-semibold text-blue-600 shadow-sm ring-1 ring-inset ring-gray-300 transition-all active:scale-95 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                ลงทะเบียน
              </button>
            </div>
          </div>

          {/* กล่องเลื่อนข้อมูล (Carousel Slider) */}
          <div className="w-full max-w-md h-32 sm:h-44 relative bg-blue-50/60 backdrop-blur-sm rounded-2xl p-2 border border-blue-100/50 mb-8 lg:mb-0 flex items-center justify-center">
            <div className="overflow-hidden h-full rounded-xl relative w-full">
              
              {/* รางเลื่อนสไลด์ (ใช้ transform เลื่อนตำแหน่งตาม currentSlide) */}
              <div
                className="flex transition-transform duration-700 ease-in-out h-full"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }} 
              >
                {/* วนลูปสร้างการ์ดแต่ละใบจากข้อมูล features */}
                {features.map((item, index) => (
                  <div key={index} className="min-w-full h-full p-2 flex items-center justify-center">
                    <div className="w-full bg-white/80 rounded-lg shadow-sm border border-blue-100 h-full flex flex-row items-center p-3 gap-3">
                      <div className="text-3xl bg-blue-100 p-2 rounded-full shrink-0">{item.icon}</div>
                      <div className="text-left overflow-hidden">
                        <h3 className="text-sm font-bold text-blue-900 truncate">{item.title}</h3>
                        <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* จุดบอกตำแหน่งสไลด์ (Dots) ที่มุมขวาล่าง */}
            <div className="absolute bottom-2 right-4 flex space-x-1">
              {features.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  // ถ้าเป็นสไลด์ปัจจุบัน ให้จุดยาวขึ้นและเป็นสีเข้ม
                  className={`h-1 rounded-full transition-all duration-500 ${
                    currentSlide === index ? 'bg-blue-600 w-4' : 'bg-blue-200 w-1'
                  }`} 
                  onClick={() => setCurrentSlide(index)} // คลิกจุดเพื่อข้ามไปสไลด์นั้น
                />
              ))}
            </div>
          </div>

        </div>

        {/* 2.2 ส่วนรูปภาพประกอบ (ฝั่งขวาของจอใหญ่) */}
        <div className="flex-1 w-full relative min-h-0 lg:h-full lg:w-1/2 flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full lg:max-h-[80%]">
            <Image
              src="/Start-Photo.png" 
              alt="Community Illustration" 
              fill // ให้รูปขยายเต็มพื้นที่
              className="object-contain object-bottom lg:object-center" 
              priority // โหลดรูปนี้เป็นอันดับแรก
            />
          </div>
        </div>

      </main>

      {/* 3. ส่วนตกแต่งพื้นหลัง (Animation คลื่น) */}
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
  )
}