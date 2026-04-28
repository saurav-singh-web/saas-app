import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function OrgPanel({ org, onClose, user, onLeft, showToast }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [currentRole, setCurrentRole] = useState(null)

  useEffect(() => {
    if (org) fetchMembers()
  }, [org])

  async function fetchMembers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organization_members')
      .select('role, user_id, profiles!fk_user_profile(email)')
      .eq('org_id', org.id)

    if (error) {
      console.log('Error fetching members:', error.message)
      return
    }

    setMembers(data)

    const me = data.find(m => m.user_id === user.id)
    setCurrentRole(me?.role || null)

    setLoading(false)
  }

  const canInvite = currentRole === 'owner' || currentRole === 'admin'

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

  const roleBadgeColor = {
    owner: 'bg-yellow-500 text-yellow-950',
    admin: 'bg-blue-500 text-blue-950',
    member: 'bg-green-500 text-green-950',
    viewer: 'bg-gray-500 text-gray-300',
    content_maker: 'bg-purple-500 text-purple-950',
    team_leader: 'bg-orange-500 text-orange-950',
  }

 return (
  <>
    {/* Overlay */}
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 sm:hidden"
      onClick={onClose}
    />

    {/* Panel */}
    <div className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:w-96 sm:h-screen 
    bg-gray-900/90 backdrop-blur-xl border-l border-gray-800 shadow-2xl 
    flex flex-col z-50">

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-800 gap-3">

        <div className="min-w-0">
          <h2 className="text-sm sm:text-lg font-semibold text-white truncate">
            {org.name}
          </h2>

          <p className="text-[10px] sm:text-sm text-gray-400 break-words">
            {org.slug} · {org.country}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg sm:text-xl transition p-1 shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">

        <h3 className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Members
        </h3>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-gray-400 text-sm">No members found.</p>
        ) : (
          <div className="space-y-2">
            {members.map(member => {
              const email = member.profiles?.email || 'Unknown'
              const initials = email.slice(0, 2).toUpperCase()
              const badgeColor = roleBadgeColor[member.role] || 'bg-gray-500 text-gray-300'

              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 bg-gray-800/80 rounded-xl px-3 sm:px-4 py-3"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {email}
                    </p>

                    <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${badgeColor}`}>
                      {member.role}
                    </span>
                  </div>

                  {member.user_id === user.id && member.role !== 'owner' && (
                    <button
                      onClick={handleLeave}
                      className="text-[10px] sm:text-xs text-red-400 hover:text-red-300 
                      border border-red-800 hover:border-red-600 px-2 py-1 rounded-lg transition shrink-0"
                    >
                      Leave
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Invite */}
        {canInvite && (
          <div className="mt-6">
            <h3 className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Invite a Member
            </h3>

            <input
              type="email"
              placeholder="Enter their email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full bg-gray-800/70 border border-gray-700 text-white rounded-lg px-3 sm:px-4 py-2.5 text-sm 
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition mb-2"
            />

            <button
              onClick={handleInvite}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium 
              rounded-lg px-4 py-2.5 transition active:scale-95 shadow-md shadow-indigo-600/20"
            >
              Send Invite
            </button>
          </div>
        )}
      </div>
    </div>
  </>
)
}

export default OrgPanel