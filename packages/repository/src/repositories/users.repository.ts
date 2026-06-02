import { Inject, Injectable } from "@nestjs/common";
import { users, type Database } from "@weber-nexus/database";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

const DEFAULT_ADMIN = {
  name: "Admin",
  email: "admin@admin.com",
  password: "12345678",
  role: "ADMIN",
} as const;

@Injectable()
export class UsersRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .all();

    return user;
  }

  async create(user: NewUser): Promise<User> {
    const [newUser] = await this.db.insert(users).values(user).returning();
    return newUser;
  }

  async ensureDefaultAdmin(): Promise<User> {
    const existingAdmin = await this.findByEmail(DEFAULT_ADMIN.email);

    if (existingAdmin) {
      return existingAdmin;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

    return this.create({
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      passwordHash,
      role: DEFAULT_ADMIN.role,
    });
  }

  async login(email: string, plaintextPassword: string): Promise<User> {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const isMatch = await bcrypt.compare(plaintextPassword, user.passwordHash);

    if (!isMatch) {
      throw new Error("Invalid email or password.");
    }

    return user;
  }
}
