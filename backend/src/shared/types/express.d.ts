import type { User } from "../../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: Pick<User, "id" | "role" | "isActive" | "name" | "email" | "createdAt" | "updatedAt">;
      uploadCapacityRelease?: (() => void) | undefined;
    }
  }
}

export {};
