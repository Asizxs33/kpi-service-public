import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
      departments?: string[];
    } & DefaultSession["user"];
  }
}
