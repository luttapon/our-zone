import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers' // ✅ เปลี่ยนมาใช้ import ตรงนี้แทน

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/confirmEmail'

  if (code) {
    const cookieStore = cookies() // ✅ เรียกใช้ฟังก์ชัน cookies() ตรงนี้
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
            async getAll() {
                return (await cookieStore).getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(async ({ name, value, options }) =>
                        (await cookieStore).set(name, value, options)
                    )
                } catch {
                    // ป้องกัน Error กรณีรันในสภาพแวดล้อมที่ไม่รองรับการเขียน Cookie (เผื่อไว้)
                }
            },
        },
      }
    )
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}?status=success`)
    }
  }

  return NextResponse.redirect(`${origin}${next}?status=error`)
}