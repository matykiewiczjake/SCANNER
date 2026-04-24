import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifyPassword, createSessionCookie } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const from = String(formData.get("from") ?? "/");

    if (!verifyPassword(password)) {
      redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
    }

    const jar = await cookies();
    jar.set(SESSION_COOKIE, await createSessionCookie(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect(from || "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={login}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold">Memecoin Scanner</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter the dashboard password.
        </p>

        <label className="mb-2 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input type="hidden" name="from" value={params.from ?? "/"} />

        {params.error ? (
          <p className="mt-2 text-sm text-destructive">Incorrect password.</p>
        ) : null}

        <button
          type="submit"
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
