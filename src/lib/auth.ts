import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Simple file-based user store (localStorage on server via JSON file)
// In production, replace with a real database
const USERS_FILE = process.cwd() + "/data/users.json";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string; // In production, hash with bcrypt
  createdAt: number;
}

function getUsers(): StoredUser[] {
  try {
    const fs = require("fs");
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  const fs = require("fs");
  const path = require("path");
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        mode: { label: "Mode", type: "text" }, // "signin" or "signup"
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.trim().toLowerCase();
        const password = credentials?.password as string;
        const name = (credentials?.name as string)?.trim();
        const mode = credentials?.mode as string;

        if (!email || !password) return null;

        const users = getUsers();

        if (mode === "signup") {
          // Check if email already exists
          if (users.find((u) => u.email === email)) {
            throw new Error("Email already registered");
          }
          if (password.length < 6) {
            throw new Error("Password must be at least 6 characters");
          }
          // Create new user
          const newUser: StoredUser = {
            id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: name || email.split("@")[0],
            email,
            password, // In production, hash this
            createdAt: Date.now(),
          };
          users.push(newUser);
          saveUsers(users);
          return { id: newUser.id, name: newUser.name, email: newUser.email };
        } else {
          // Sign in
          const user = users.find((u) => u.email === email);
          if (!user) {
            throw new Error("No account found with this email");
          }
          if (user.password !== password) {
            throw new Error("Incorrect password");
          }
          return { id: user.id, name: user.name, email: user.email };
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "drafta-ai-dev-secret-change-in-production",
});
