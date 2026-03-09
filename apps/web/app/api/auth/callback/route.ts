import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  // Redirect to client-side handler with the code
  // The client will call the backend to exchange the code
  const redirectUrl = new URL('/auth/callback', request.url)
  redirectUrl.searchParams.set('code', code)
  return NextResponse.redirect(redirectUrl)
}
