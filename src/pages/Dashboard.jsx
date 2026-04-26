import { useState } from 'react'
import { supabase } from '../supabaseClient'
import CreateOrg from '../components/CreateOrg'
import OrgPanel from '../components/OrgPanel'
import Invitations from '../components/Invitations'
import useOrganizations from '../hooks/useOrganizations'

function Dashboard({ user, showToast }) {
  const { organizations, loading, fetchOrganizations } = useOrganizations()
  const [selectedOrg, setSelectedOrg] = useState(null)

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
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">MyApp</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg transition"
          >
            Log Out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <Invitations user={user} onAccepted={fetchOrganizations} showToast={showToast} />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Organizations</h2>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : organizations.length === 0 ? (
          <p className="text-gray-400">You have no organizations yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {organizations.map(org => (
              <div
                key={org.id}
                onClick={() => setSelectedOrg(org)}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-indigo-500 transition"
              >
                <h3 className="text-lg font-semibold text-white">{org.name}</h3>
                <p className="text-sm text-gray-400 mt-1">Slug: {org.slug}</p>
                <p className="text-sm text-gray-400">Country: {org.country}</p>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-800 pt-8">
          <CreateOrg onCreated={fetchOrganizations} showToast={showToast} />
        </div>
      </div>

      {selectedOrg && (
        <OrgPanel
          org={selectedOrg}
          user={user}
          onClose={() => setSelectedOrg(null)}
          onLeft={fetchOrganizations}
          showToast={showToast}
        />
      )}
    </div>
  )
}

export default Dashboard