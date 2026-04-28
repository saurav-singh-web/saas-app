import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import CreateOrg from '../components/CreateOrg'
import OrgPanel from '../components/OrgPanel'
import { useNavigate } from 'react-router-dom'
import Invitations from '../components/Invitations'
import useOrganizations from '../hooks/useOrganizations'
import Loading from '../components/Loading'


function Dashboard({ user, showToast }) {
  const { organizations, loading, fetchOrganizations } = useOrganizations()
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [role, setRole] = useState('viewer')
  const navigate = useNavigate()

useEffect(() => {
  async function fetchRole() {
    if (!selectedOrg) return

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      setRole('viewer')
      return
    }

    const { data } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', selectedOrg.id) // ✅ FIXED
      .eq('user_id', user.id)
      .maybeSingle()

    setRole(data?.role || 'viewer')
  }

   fetchRole()
}, [selectedOrg])


  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      showToast('Error logging out', 'error')
      return
    }
    showToast('Logged out successfully', 'info')
  }

 return (
  <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white overflow-hidden">

    {/* Glow */}
    <div className="absolute w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-600/10 blur-3xl rounded-full top-[-100px] left-[-100px]" />

    {/* Navbar */}
    <div className="relative border-b border-gray-800 bg-gray-900/70 backdrop-blur-xl px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

      {/* Left */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 sm:h-9 sm:w-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold">
          A
        </div>
        <h1 className="text-base sm:text-xl font-semibold tracking-tight">
          MyApp
        </h1>
      </div>

      {/* Right */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">

        <span className="text-[11px] sm:text-sm text-gray-400 truncate max-w-[120px] sm:max-w-none">
          {user.email}
        </span>

        <button
          onClick={() => navigate('/posts')}
          className="text-xs sm:text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
        >
          Posts
        </button>

        <button
          onClick={handleLogout}
          className="text-xs sm:text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </div>

    {/* Main */}
    <div className="relative max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">

      {/* Invitations */}
      <div className="mb-5">
        <Invitations user={user} onAccepted={fetchOrganizations} showToast={showToast} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">

        <div>
          <h2 className="text-xl sm:text-3xl font-semibold tracking-tight">
            Organizations
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Manage your workspaces
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="w-full sm:w-auto text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition shadow"
        >
          {showCreate ? 'Cancel' : '+ New Org'}
        </button>
      </div>

      {/* Create */}
      {showCreate && (
        <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-xl p-4 sm:p-6 mb-6">
          <CreateOrg
            onCreated={() => {
              fetchOrganizations()
              setShowCreate(false)
            }}
            showToast={showToast}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Loading fullScreen text="Loading posts..." />
      ) : organizations.length === 0 ? (
        <div className="text-center py-12 border border-gray-800 rounded-xl bg-gray-900/40">
          <p className="text-gray-400 text-sm sm:text-base">
            No organizations yet.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Create your first workspace 
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {organizations.map(org => (
            <div
              key={org.id}
              onClick={() => navigate(`/org/${org.slug}`)}
              className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 sm:p-5 cursor-pointer transition hover:border-indigo-500"
            >
              <h3 className="text-base sm:text-lg font-semibold">
                {org.name}
              </h3>

              <p className="text-xs sm:text-sm text-gray-400 mt-1 break-all">
                Slug: {org.slug}
              </p>

              <p className="text-xs sm:text-sm text-gray-400">
                Country: {org.country}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Panel */}
    {selectedOrg && (
      <OrgPanel
        org={selectedOrg}
        user={user}
        onClose={() => setSelectedOrg(null)}
        onLeft={fetchOrganizations}
        showToast={showToast}
        role={role}
      />
    )}
  </div>
)
}

export default Dashboard