import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Toast from './components/Toast'
import useToast from './hooks/useToast'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <>
      {user
        ? <Dashboard user={user} showToast={showToast} />
        : <Login showToast={showToast} />
      }
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </>
  )
}

export default App