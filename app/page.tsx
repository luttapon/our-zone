"use client"

// ----------------------------------------
// ส่วนที่ 1: การนำเข้าโมดูลและไลบรารีที่จำเป็น (Imports)
// ----------------------------------------
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
// นำเข้าไฟล์ Global CSS สำหรับ Styles ทั่วไป (เช่น wave-container, wave-blob)
import './globals.css'

// ----------------------------------------
// ส่วนที่ 2: การกำหนดโครงสร้างข้อมูล (Interface & Data)
// ----------------------------------------
// Interface สำหรับกำหนดโครงสร้างของแต่ละฟีเจอร์
interface Feature {
  icon: string;
  title: string;
  description: string;
}

// ข้อมูล Array ของฟีเจอร์หลัก 3 อย่าง ที่จะนำไปใช้ใน Carousel
const features: Feature[] = [
  { icon: "📰", title: "ติดตามข่าวสาร", description: "อัปเดตข้อมูลล่าสุดจากชุมชน" },
  { icon: "💬", title: "แลกเปลี่ยน", description: "พื้นที่พูดคุยและแบ่งปันความคิด" },
  { icon: "👥", title: "สร้างกลุ่ม", description: "รวมตัวกับผู้ที่มีความสนใจเดียวกัน" }
]

// ----------------------------------------
// ส่วนที่ 3: คอมโพเนนต์หลัก (Page Component)
// ----------------------------------------
export default function Page() {
  // Hook สำหรับจัดการการนำทาง (Routing) ใน Next.js
  const router = useRouter()
  // State สำหรับเก็บหมายเลขสไลด์ปัจจุบัน (เริ่มต้นที่ 0)
  const [currentSlide, setCurrentSlide] = useState<number>(0)

  // --- Logic การทำงาน: เลื่อน Slide อัตโนมัติทุก 4 วินาที ---
  useEffect(() => {
    // ตั้งค่า Interval เพื่อเปลี่ยนค่า currentSlide ทุก 4000 มิลลิวินาที (4 วินาที)
    const timer = setInterval(() => {
      // คำนวณสไลด์ถัดไปและวนกลับไป 0 เมื่อถึงสไลด์สุดท้าย
      setCurrentSlide((prev) => (prev + 1) % features.length)
    }, 4000)
    // Cleanup Function: ล้าง Interval เมื่อคอมโพเนนต์ถูกทำลาย (unmount)
    return () => clearInterval(timer)
  }, []) // Dependency Array ว่าง: ทำงานครั้งเดียวเมื่อ Mount

  return (
    // --- Container หลัก: กำหนดความสูงเต็มจอและห้าม Scroll ---
    <div className="h-screen w-full overflow-hidden bg-gray-50 flex flex-col relative">

      {/* --- ส่วนหัวเว็บไซต์ (Header) --- */}
      <header className="w-full p-6 flex items-center shrink-0 z-20">
        {/* โลโก้/ชื่อเว็บไซต์ */}
        <div className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight">
          Proximity Link
        </div>
      </header>

      {/* --- ส่วนเนื้อหาหลัก (Main Content) แบ่งซ้าย-ขวา สำหรับ Desktop --- */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row-reverse items-center z-10 h-full pb-0 lg:pb-6">
        
        {/* 1. ส่วนเนื้อหาฝั่งซ้าย (ข้อความ, Carousel, ปุ่ม) */}
        <div className="w-full px-6 flex flex-col flex-wrap items-center text-left lg:text-left pt-2 lg:pt-0 lg:w-1/2 shrink-0 justify-center">
          
          {/* ข้อความต้อนรับ (Text Content) */}
          <div className="space-y-4 mb-5 lg:mb-8 ">
            {/* หัวข้อหลัก */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-blue-950 leading-tight">
              ยินดีต้อนรับสู่<br />
              <span className="text-blue-600">ชุมชนออนไลน์</span>
            </h1>
            {/* คำอธิบายสั้นๆ */}
            <p className="text-sm lg:text-lg text-gray-600 font-light max-w-md mx-auto lg:mx-0 leading-tight">
              แพลตฟอร์มสำหรับการเชื่อมต่อ แบ่งปันประสบการณ์ และสร้างสรรค์สิ่งใหม่ๆ
            </p>

            {/* ปุ่มกดดำเนินการ (Login/Register) */}
            <div className="flex flex-row gap-3 w-full max-w-md sm:max-w-none  lg:w-auto mb-4 mt-15 lg:mb-8 order-3 lg:order-2">
              {/* ปุ่มเข้าสู่ระบบ */}
              <button 
                type="button" 
                onClick={() => router.push('/login')} 
                className="flex-1 sm:flex-none sm:w-auto px-4 sm:px-8 rounded-full bg-blue-600 hover:bg-blue-700 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                เข้าสู่ระบบ
              </button>
              {/* ปุ่มลงทะเบียน */}
              <button 
                type="button" 
                onClick={() => router.push('/register')} 
                className="flex-1 sm:flex-none sm:w-auto px-4 sm:px-8 rounded-full bg-white hover:bg-gray-50 py-3 text-sm font-semibold text-blue-600 shadow-sm ring-1 ring-inset ring-gray-300 transition-all active:scale-95 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                ลงทะเบียน
              </button>
            </div>
          </div>
          
          {/* ส่วนแสดงฟีเจอร์แบบสไลด์ (Carousel Box) */}
          <div className="w-full max-w-md h-32 sm:h-44 relative bg-blue-50/60 backdrop-blur-sm rounded-2xl p-2 border border-blue-100/50 mb-8 lg:mb-0 order-2 lg:order-3 items-center flex justify-center shadow-sm">
            <div className="overflow-hidden h-full rounded-xl relative w-full">
              {/* ตัวเลื่อน Slide: ใช้ 'transform' ในการเลื่อนตามค่า currentSlide */}
              <div className="flex transition-transform duration-700 ease-in-out h-full" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                {features.map((item, index) => (
                  // แต่ละ Slide item
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
            
            {/* จุดแสดงสถานะ Slide (Dots Indicator) */}
            <div className="absolute bottom-2 right-4 flex space-x-1">
              {features.map((_, index) => (
                <button 
                  key={index} 
                  type="button" 
                  aria-label={`Go to slide ${index + 1}`} 
                  // เปลี่ยนสี/ขนาดตามสไลด์ปัจจุบัน
                  className={`h-1 rounded-full transition-all duration-500 ${currentSlide === index ? 'bg-blue-600 w-4' : 'bg-blue-200 w-1'}`} 
                  onClick={() => setCurrentSlide(index)} 
                />
              ))}
            </div>
          </div>

        </div>

        {/* 2. ส่วนแสดงรูปภาพฝั่งขวา (Image Section) */}
        <div className="flex-1 w-full relative min-h-0 lg:h-full lg:w-1/2 flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full lg:max-h-[80%]">
            {/* Next.js Image Component สำหรับแสดงรูปภาพ */}
            <Image
              src="/Start-Photo.png"
              alt="Community Illustration"
              fill
              className="object-contain object-bottom lg:object-center"
              priority
            />
          </div>
        </div>

      </main>
      
      {/* --- พื้นหลังเอฟเฟกต์คลื่น (Wave Background) --- */}
      <div className="wave-container">
        {/* กลุ่มคลื่นใหญ่ (กำหนด Style ใน globals.css) */}
        <div className="wave-blob wave-1"></div>
        <div className="wave-blob wave-2"></div>
        <div className="wave-blob wave-3"></div>

        {/* กลุ่มคลื่นเล็กกระจายตัว (กำหนด Style ใน globals.css) */}
        <div className="wave-blob wave-small-1"></div>
        <div className="wave-blob wave-small-2"></div>
        <div className="wave-blob wave-small-3"></div>
        <div className="wave-blob wave-small-4"></div>
      </div>
      
    </div>
  )
}