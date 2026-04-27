import { Routes, Route } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import PostsFeed from '../pages/PostsFeed'
import OrgPage from '../pages/OrgPage'

function AppRoutes({ user, showToast }) {
  return (
    <Routes>
      <Route
        path="/posts"
        element={<PostsFeed user={user} showToast={showToast} />}
      />
      <Route
        path="/org/:slug"
        element={
          user
            ? <OrgPage user={user} showToast={showToast} />
            : <Login showToast={showToast} />
        }
      />
      <Route
        path="*"
        element={
          user
            ? <Dashboard user={user} showToast={showToast} />
            : <Login showToast={showToast} />
        }
      />
    </Routes>
  )
}

export default AppRoutes