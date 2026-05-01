import { NextResponse } from 'next/server'

export const ok = (data: unknown, status = 200) =>
  NextResponse.json({ success: true, data }, { status })

export const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: message }, { status })

export const serverErr = (e: unknown) => {
  const message = e instanceof Error ? e.message : 'Internal server error'
  console.error('[API Error]', message, e)
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
}
