import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function Invitations({ user, onAccepted, showToast }) {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvitations()
  }, [])

  async function fetchInvitations() {
    const { data, error } = await supabase
      .from('invitations')
      .select('id, status, org_id, organizations(name)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending')

    if (error) {
      console.log('Error fetching invitations:', error.message)
      return
    }

    setInvitations(data)
    setLoading(false)
  }

  async function handleAccept(invite) {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', invite.org_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingMember) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: 'member'
        })

      if (memberError) {
        showToast('Error joining organization.', 'error')
        return
      }
    }

    await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    showToast('You have joined the organization!', 'success')
    fetchInvitations()
    if (onAccepted) onAccepted()
  }

  async function handleDecline(invite) {
    await supabase
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', invite.id)

    showToast('Invitation declined.', 'info')
    fetchInvitations()
  }

  if (loading) return null
  if (invitations.length === 0) return null

  return (
    <div className="bg-indigo-950 border border-indigo-800 rounded-xl p-4 sm:p-5 mb-6">
      <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-3">Pending Invitations</h3>
      <div className="space-y-3">
        {invitations.map(invite => (
          <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-indigo-900 rounded-lg px-4 py-3 gap-3">
            <p className="text-sm text-white">
              Invited to <strong>{invite.organizations?.name}</strong>
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleAccept(invite)}
                className="flex-1 sm:flex-none text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition"
              >
                Accept
              </button>
              <button
                onClick={() => handleDecline(invite)}
                className="flex-1 sm:flex-none text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Invitations