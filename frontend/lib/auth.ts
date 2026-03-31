import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Demo users — replace with DB lookup in production
const DEMO_USERS = [
  { id: "1", email: "admin@nbb.bh", name: "Admin User", role: "Admin", password: "Admin@123!" },
  { id: "2", email: "rm@nbb.bh", name: "Relationship Manager", role: "RM", password: "RM@123!" },
  { id: "3", email: "analyst@nbb.bh", name: "Data Analyst", role: "Analyst", password: "Analyst@123!" },
];

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? "nbb-nbo-secret-change-in-production",
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === credentials.email.toLowerCase()
        );
        if (!user) return null;
        // Direct compare for demo; use bcrypt.compare in production
        const valid = credentials.password === user.password;
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as typeof user & { role: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
