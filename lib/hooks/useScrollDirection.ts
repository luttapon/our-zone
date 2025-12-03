import { useEffect, useState } from "react";

/**
 * Hook เพื่อตรวจสอบทิศทางการเลื่อนหน้าจอ
 * @returns boolean - true ถ้าเลื่อนขึ้น, false ถ้าเลื่อนลง
 */
export const useScrollDirection = () => {
  const [isScrollingUp, setIsScrollingUp] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // ถ้า Scroll Y น้อยกว่า lastScrollY แสดงว่าเลื่อนขึ้น
      // ตั้งค่าเป็น true (Navbar ปรากฏ)
      if (currentScrollY < lastScrollY) {
        setIsScrollingUp(true);
      } else {
        // เลื่อนลง = false (Navbar หาย)
        setIsScrollingUp(false);
      }

      setLastScrollY(currentScrollY);
    };

    // เพิ่ม Event Listener
    window.addEventListener("scroll", handleScroll);

    // Cleanup
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return isScrollingUp;
};
