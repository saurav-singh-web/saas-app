import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function OrgPanel({ org, onClose, user, onLeft, showToast }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')

  const currentMember = members.find(m => m.user_id === user.id)
  const canInvite = currentMember?.role === 'owner' || currentMember?.role === 'admin'

  useEffect(() => {
    if (org) fetchMembers()
  }, [org])

  async function fetchMembers() {
    const { data, error } = await supabase
      .from('organization_members')
      .select('role, user_id, profiles(email)')
      .eq('org_id', org.id)

    if (error) {
      console.log('Error fetching members:', error.message)
      return
    }

    setMembers(data)
    setLoading(false)
  }

  async function handleInvite() {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail)
      .maybeSingle()

    if (profileError || !profileData) {
      showToast('No user found with that email.', 'error')
      return
    }

    const isAlreadyMember = members.some(m => m.user_id === profileData.id)
    if (isAlreadyMember) {
      showToast('This user is already a member.', 'error')
      return
    }

    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('status')
      .eq('org_id', org.id)
      .eq('invited_user_id', profileData.id)
      .maybeSingle()

    if (existingInvite?.status === 'accepted') {
      showToast('This user is already a member.', 'error')
      return
    }

    if (existingInvite?.status === 'pending') {
      showToast('Invite already sent. Waiting for user to accept.', 'info')
      return
    }

    await supabase
      .from('invitations')
      .delete()
      .eq('org_id', org.id)
      .eq('invited_user_id', profileData.id)

    const { error: insertError } = await supabase
      .from('invitations')
      .insert({
        org_id: org.id,
        invited_by: user.id,
        invited_user_id: profileData.id
      })

    if (insertError) {
      showToast(insertError.message, 'error')
      return
    }

    showToast('Invite sent! Waiting for user to accept.', 'success')
    setInviteEmail('')
  }

  async function handleLeave() {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('org_id', org.id)
      .eq('user_id', user.id)

    if (error) {
      showToast('Error leaving org.', 'error')
      return
    }

    await supabase
      .from('invitations')
      .delete()
      .eq('org_id', org.id)
      .eq('invited_user_id', user.id)

    showToast('You have left the organization.', 'info')
    if (onLeft) onLeft()
    onClose()
  }

  return (
    <div className="fixed top-0 right-0 w-96 h-screen bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h2 className="text-lg font-bold text-white">{org.name}</h2>
          <p className="text-sm text-gray-400">{org.slug} · {org.country}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl transition">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Members</h3>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-gray-400 text-sm">No members found.</p>
        ) : (
          <div className="space-y-3">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{member.profiles?.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                </div>
                {member.user_id === user.id && member.role !== 'owner' && (
                  <button
                    onClick={handleLeave}
                    className="text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Leave
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canInvite && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Invite a Member</h3>
            <input
              type="email"
              placeholder="Enter their email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
            />
            <button
              onClick={handleInvite}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition"
            >
              Send Invite
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrgPanel