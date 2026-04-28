import { useState , useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { FcGoogle } from "react-icons/fc"

function Login({ showToast }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')


  useEffect(() => {
  async function handleUser() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      await ensureProfile(session.user)
    }
  }

  handleUser()
}, [])

  async function handleSignUp() {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Sign-up successful! Please check your email.', 'success')
  }

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Login successful!', 'success')
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) {
      showToast(error.message, 'error')
    }
  }
  async function ensureProfile(user) {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email || ''
      },
      {
        onConflict: 'id'
      }
    )

  if (error) {
    console.error("Upsert failed:", error)
  }
}
return (
  <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-3 sm:px-6 overflow-hidden">

    {/* Glow */}
    <div className="absolute w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-600/20 blur-3xl rounded-full top-[-80px] left-[-80px]" />

    {/* Card */}
    <div className="relative w-full max-w-md bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl p-5 sm:p-8">

      {/* Logo */}
      <div className="mb-5 flex items-center gap-2">
        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
          A
        </div>
        <span className="text-white font-medium sm:font-semibold text-base sm:text-lg">
          AuthFlow
        </span>
      </div>

      {/* Heading */}
      <h1 className="text-2xl sm:text-4xl font-semibold text-white mb-1">
        Welcome back
      </h1>
      <p className="text-gray-400 text-xs sm:text-sm mb-6 sm:mb-8">
        Sign in to your account or create a new one
      </p>

      <div className="space-y-4">

        {/* Email */}
        <div>
          <label className="text-xs sm:text-sm text-gray-400 mb-1 block">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-lg px-3 sm:px-4 py-2.5 text-sm 
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        {/* Password */}
        <div>
          <label className="text-xs sm:text-sm text-gray-400 mb-1 block">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-lg px-3 sm:px-4 py-2.5 text-sm 
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleSignUp}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg py-2.5 transition"
          >
            Sign Up
          </button>

          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg py-2.5 transition shadow"
          >
            Log In
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="border-t border-gray-700"></div>
          <span className="absolute left-1/2 -translate-x-1/2 -top-2 text-[10px] sm:text-xs bg-gray-900 px-2 text-gray-400">
            OR
          </span>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 sm:gap-3 
          bg-white text-gray-900 text-sm font-medium 
          rounded-lg py-2.5 transition"
        >
          <FcGoogle size={18} />
          Continue with Google
        </button>

      </div>
    </div>
  </div>
)
}

export default Login