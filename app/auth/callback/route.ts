import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth Callback Route
 * Previously handled Supabase Magic Link auth.
 * Now redirects to /menu (entry point) since we use PIN-based auth via Prisma.
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    return NextResponse.redirect(new URL('/menu', requestUrl.origin))
}
