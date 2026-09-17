import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    // Protect everything except auth pages, api auth, static assets
    "/((?!api/auth|api/register|api/setup-status|login|register|_next/static|_next/image|favicon.ico|fonts|logo).*)",
  ],
};
