import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        isAdmin: { label: "Is Admin", type: "boolean" },
        code: { label: "Auth Code", type: "text" },
      },
      async authorize(credentials) {
        console.log(`[Auth] Authorize called with credentials:`, {
          username: credentials?.username,
          isAdmin: credentials?.isAdmin,
          hasCode: !!credentials?.code,
          hasPassword: !!credentials?.password,
          allCredentials: credentials
        });

        if (!credentials?.username) {
          console.log(`[Auth] Error: Username is required`);
          throw new Error("Username is required");
        }

        const isAdmin = credentials.isAdmin === "true";
        console.log(`[Auth] Is admin login:`, isAdmin);

        if (isAdmin) {
          // Admin authentication
          console.log(`[Auth] Looking for admin: ${credentials.username}`);
          try {
            const admin = await prisma.admin.findUnique({
              where: { username: credentials.username },
            });
            
            console.log(`[Auth] Admin query result:`, admin ? 'Found' : 'Not found');

            if (!admin || !credentials.password) {
              console.log(`[Auth] Admin not found or no password provided`);
              throw new Error("Invalid credentials");
            }

            console.log(`[Auth] Comparing passwords...`);
            const isValid = await bcrypt.compare(credentials.password, admin.password);
            console.log(`[Auth] Password comparison result:`, isValid);

            if (!isValid) {
              console.log(`[Auth] Invalid admin password`);
              throw new Error("Invalid credentials");
            }

            console.log(`[Auth] Admin login successful: ${admin.username}`);
            return {
              id: admin.id,
              username: admin.username,
              role: "ADMIN",
            };
          } catch (dbError) {
            console.error(`[Auth] Database error:`, dbError);
            throw new Error("Database connection failed");
          }
        } else {
          // User authentication with auth code
          if (!credentials.code) {
            console.log(`[Auth] Error: Auth code is required for user login`);
            throw new Error("Auth code is required");
          }

          console.log(`[Auth] Looking for auth code: ${credentials.code}`);
          const authCode = await prisma.authCode.findFirst({
            where: {
              code: credentials.code,
            },
            include: {
              user: true,
            },
          });

          if (!authCode) {
            console.log(`[Auth] Auth code not found: ${credentials.code}`);
            throw new Error("Invalid auth code");
          }

          // Check if auth code is expired
          if (authCode.expiresAt && new Date(authCode.expiresAt) < new Date()) {
            console.log(`[Auth] Auth code expired: ${credentials.code}, expires: ${authCode.expiresAt}`);
            throw new Error("Auth code has expired");
          }

          console.log(`[Auth] Valid auth code found: ${authCode.code} for user: ${credentials.username}`);

          // Check if user already exists with this username
          let user = await prisma.user.findFirst({
            where: { username: credentials.username },
          });

          if (user) {
            console.log(`[Auth] Existing user found: ${credentials.username}, authCodeId: ${user.authCodeId}`);
            // User exists - check if this auth code belongs to this user
            if (user.authCodeId !== authCode.id) {
              console.log(`[Auth] User trying to use different auth code. User authCodeId: ${user.authCodeId}, current authCode: ${authCode.id}`);
              throw new Error("This username is registered with a different auth code");
            }
            // User exists and using correct auth code - allow login
            console.log(`[Auth] User ${credentials.username} logging in with their registered auth code`);
          } else {
            // New user - check if auth code is already used by someone else
            if (authCode.isUsed && authCode.user) {
              console.log(`[Auth] Auth code already used by different user: ${authCode.user.username}`);
              throw new Error("This auth code is already registered to another user");
            }

            // Create new user with this auth code
            console.log(`[Auth] Creating new user: ${credentials.username} with authCodeId: ${authCode.id}`);
            try {
              user = await prisma.user.create({
                data: {
                  username: credentials.username,
                  authCodeId: authCode.id,
                },
              });
              console.log(`[Auth] New user created successfully: ${user.id}`);

              // Mark auth code as used only for new users
              console.log(`[Auth] Marking auth code ${authCode.code} as used for new user`);
              await prisma.authCode.update({
                where: { id: authCode.id },
                data: { isUsed: true },
              });
            } catch (createError) {
              console.error(`[Auth] Error creating user:`, createError);
              throw new Error("Failed to create user account");
            }
          }

          console.log(`[Auth] User login successful:`, {
            id: user.id,
            username: user.username,
            role: "USER"
          });

          return {
            id: user.id,
            username: user.username,
            role: "USER",
          };
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT, user: any }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: Session, token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.email = token.username as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "default-secret-change-in-production",
  debug: process.env.NODE_ENV === "development",
  logger: {
    error(code, metadata) {
      console.error(`[NextAuth Error] ${code}:`, metadata);
    },
    warn(code) {
      console.warn(`[NextAuth Warning] ${code}`);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[NextAuth Debug] ${code}:`, metadata);
      }
    },
  },
}; 