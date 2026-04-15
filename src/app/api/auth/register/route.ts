import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

const registerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json() as unknown;
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(fieldErrors)[0];
      const message = firstField
        ? (fieldErrors[firstField as keyof typeof fieldErrors]?.[0] ?? "Invalid input")
        : "Invalid input";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { firstName, lastName, email, phone, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.user.create({
      data: {
        email,
        displayName: `${firstName} ${lastName}`,
        passwordHash,
        role: "PROVIDER",
        isActive: true,
        notificationPreferences: phone ? { phone } : undefined,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
