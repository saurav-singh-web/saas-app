import { useState } from 'react'
import { supabase } from '../supabaseClient'

function Login({ showToast }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-gray-400 mb-8">Sign in to your account or create a new one</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSignUp}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg px-4 py-2.5 transition"
            >
              Sign Up
            </button>
            <button
              onClick={handleLogin}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login