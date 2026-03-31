export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/scoring/:path*", "/retraining/:path*", "/reporting/:path*", "/settings/:path*"],
};
