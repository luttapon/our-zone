// app/layouts/MainLayout.tsx (หรือไฟล์ Layout ของคุณ)
import { NavbarTop } from "@/app/components/NavbarTop";
import { NavbarSub } from "@/app/components/NavbarSub";
import { FollowedGroupsProvider } from "@/lib/context/FollowedGroupsContext";


export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FollowedGroupsProvider>
      <NavbarTop />
      <NavbarSub />
      <main className="min-h-screen pt-25">
        {children}
      </main>
    </FollowedGroupsProvider>
  );
}
