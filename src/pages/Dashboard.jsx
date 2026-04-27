import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import CreateOrg from '../components/CreateOrg'
import OrgPanel from '../components/OrgPanel'
import { useNavigate } from 'react-router-dom'
import Invitations from '../components/Invitations'
import useOrganizations from '../hooks/useOrganizations'

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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <div className="border-b border-gray-800 bg-gray-900 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-bold text-white">MyApp</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-xs sm:text-sm text-gray-400 truncate max-w-[140px] sm:max-w-none">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs sm:text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 sm:px-4 py-1.5 rounded-lg transition"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Invitations user={user} onAccepted={fetchOrganizations} showToast={showToast} />

        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Your Organizations</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition"
          >
            {showCreate ? 'Cancel' : '+ New Org'}
          </button>
        </div>

        {showCreate && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <CreateOrg onCreated={() => { fetchOrganizations(); setShowCreate(false) }} showToast={showToast} />
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : organizations.length === 0 ? (
          <p className="text-gray-400">You have no organizations yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {organizations.map(org => (
              <div
                key={org.id}
                onClick={() => navigate(`/org/${org.slug}`)}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-indigo-500 transition"
              >
                <h3 className="text-base sm:text-lg font-semibold text-white">{org.name}</h3>
                <p className="text-sm text-gray-400 mt-1">Slug: {org.slug}</p>
                <p className="text-sm text-gray-400">Country: {org.country}</p>
              </div>
            ))}
          </div>
        )}
      </div>

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