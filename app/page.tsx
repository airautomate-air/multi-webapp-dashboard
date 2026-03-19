import { auth } from "@/lib/auth"
import { signIn, signOut } from "@/lib/auth"
import { LogIn, LogOut } from "lucide-react"
import AppGrid from "@/components/app-grid"
import { WeatherBackground } from "@/components/weather-background"

export default async function Home() {
  const session = await auth()

  return (
    <WeatherBackground>
      {/* Header */}
      <header className="w-full border-b border-white/10 bg-black/25 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span
            className="text-xl font-semibold tracking-tight text-white"
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
      <main className="w-full max-w-5xl mx-auto px-6 pt-16 pb-24">
        <div className="mb-16 text-center">
          <h1
            className="text-5xl sm:text-6xl font-light text-white mb-4 tracking-tight leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              textShadow: "0 2px 20px rgba(0,0,0,0.4)",
            }}
          >
            Your Tools,
            <br />
            <span className="font-semibold italic">All in One Place</span>
          </h1>
          <p
            className="text-white/75 text-lg max-w-md mx-auto leading-relaxed"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
          >
            A personal suite of AI-powered tools. Select an app below to get
            started.
          </p>
          {!session && (
            <p className="mt-4 text-sm text-amber-200 bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 inline-block">
              Sign in with Google to use these tools and save files to Drive.
            </p>
          )}
        </div>

        <AppGrid isSignedIn={!!session} />
      </main>
    </WeatherBackground>
  )
}
