import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  if (process.env.PLATFORM_ROLE !== "runtime") return NextResponse.next();
  const id = process.env.RUNTIME_APP_ID;
  if (request.nextUrl.pathname === "/" && id && /^[a-f0-9]{24}$/.test(id)) {
    const target = request.nextUrl.clone(); target.pathname = `/rooms/${id}`;
    return NextResponse.rewrite(target);
  }
  return new NextResponse("Not found", { status: 404 });
}
export const config = { matcher: ["/", "/dashboard/:path*", "/preview/:path*"] };
