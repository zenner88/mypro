import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      plan?: string;
      maxProjects?: number;
      maxInvoices?: number;
    };
  }
  interface User {
    id: string;
    role?: string;
    plan?: string;
    maxProjects?: number;
    maxInvoices?: number;
  }
}
