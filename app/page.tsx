import { auth } from "@/lib/auth"
import { signIn, signOut } from "@/lib/auth"
import { LogIn, LogOut } from "lucide-react"
import AppGrid from "@/components/app-grid"

export default async function Home() {
  const session = await auth()

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span
            className="text-xl font-semibold tracking-tight text-stone-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            My Dashboard
          </span>
          <div className="flex items-center gap-3">
            {session?.user && (
              <span className="text-sm text-stone-500 hidden sm:block">
                {session.user.email}
              </span>
            )}
            {session ? (
              <form
                action={async () => {
                  "use server"
                  await signOut()
                }}
              >
                <button
                  type="submit"
                  className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-100"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server"
                  await signIn("google")
                }}
              >
                <button
                  type="submit"
                  className="flex items-center gap-2 text-sm bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors"
                >
                  <LogIn size={15} />
                  Sign in with Google
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <div className="mb-16 text-center">
          <h1
            className="text-5xl sm:text-6xl font-light text-stone-900 mb-4 tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your Tools,
            <br />
            <span className="font-semibold italic">All in One Place</span>
          </h1>
          <p className="text-stone-500 text-lg max-w-md mx-auto leading-relaxed">
            A personal suite of AI-powered tools. Select an app below to get
            started.
          </p>
          {!session && (
            <p className="mt-4 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 inline-block">
              Sign in with Google to use these tools and save files to Drive.
            </p>
          )}
        </div>

        <AppGrid isSignedIn={!!session} />
      </main>
    </div>
  )
}
