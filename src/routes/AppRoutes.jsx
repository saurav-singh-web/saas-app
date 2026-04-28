import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import PostsFeed from '../pages/PostsFeed'
import OrgPage from '../pages/OrgPage'

function AppRoutes({ user, showToast }) {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          user
            ? <Navigate to="/" replace />
            : <Login showToast={showToast} />
        }
      />

      <Route
        path="/posts"
        element={<PostsFeed user={user} showToast={showToast} />}
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute user={user}>
            <Dashboard user={user} showToast={showToast} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/org/:slug"
        element={
          <ProtectedRoute user={user}>
            <OrgPage user={user} showToast={showToast} />
          </ProtectedRoute>
        }
      />

      {/* Catch all — redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AppRoutes