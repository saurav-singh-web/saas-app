import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Loading from '../components/Loading'

function OrgPage({ user, showToast }) {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [org, setOrg] = useState(null)
  const [role, setRole] = useState(null)
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState({})
  const [commentInputs, setCommentInputs] = useState({})
  const [showComments, setShowComments] = useState({})
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [likedPosts, setLikedPosts] = useState(new Set())
  const [likeCounts, setLikeCounts] = useState({})
  const [inviteEmail, setInviteEmail] = useState('')
  const [editingPost, setEditingPost] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [contentMakers, setContentMakers] = useState([]) 
  const [showMembers, setShowMembers] = useState(false)
  useEffect(() => {
    fetchOrgData()
  }, [slug])

  async function fetchOrgData() {
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (orgError || !orgData) {
      showToast('Organization not found.', 'error')
      navigate('/')
      return
    }

    setOrg(orgData)

    // Step 2 — get current user's role
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('role, user_id, manager_id, team_size_limit, profiles!fk_user_profile(email)')
      .eq('org_id', orgData.id)
      .eq('user_id', user.id)
      .maybeSingle()

    setRole(memberData?.role || null)

    // Step 3 — get members
    const { data: membersData } = await supabase
      .from('organization_members')
      .select('role, user_id, manager_id, team_size_limit, profiles!fk_user_profile(email)')
      .eq('org_id', orgData.id)

    setMembers(membersData || [])

    // Step 4 — get posts
    await fetchPosts(orgData.id)

    setLoading(false)
  }

  async function fetchPosts(orgId) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      content,
      status,
      is_public,
      created_at,
      assigned_to,
      profiles!posts_created_by_fkey(email)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.log('Error fetching posts:', error.message)
    return
  }

  setPosts(data)
  if (data.length > 0) fetchLikes(data.map(p => p.id))
}

  async function fetchLikes(postIds) {
  if (postIds.length === 0) return

  const counts = {}
  await Promise.all(postIds.map(async (id) => {
    const { count } = await supabase
      .from('likes')
      .select('id', { count: 'exact' })
      .eq('post_id', id)
    counts[id] = count || 0
  }))
  setLikeCounts(counts)

  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds)

  if (data) setLikedPosts(new Set(data.map(l => l.post_id)))
}

async function handleLike(postId) {
  const alreadyLiked = likedPosts.has(postId)

  if (alreadyLiked) {
    await supabase.from('likes').delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)

    setLikedPosts(prev => { const next = new Set(prev); next.delete(postId); return next })
    setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 1) - 1 }))
  } else {
    await supabase.from('likes').insert({ post_id: postId, user_id: user.id })

    setLikedPosts(prev => new Set([...prev, postId]))
    setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }))
  }
}

  async function handleCreatePost() {
    if (!title || !content) {
      showToast('Please fill in title and content.', 'error')
      return
    }

    const isTeamLeaderOrAbove = ['team_leader', 'admin', 'owner'].includes(role)

    const { error } = await supabase
      .from('posts')
      .insert({
        org_id: org.id,
        created_by: user.id,
        title,
        content,
        status: isTeamLeaderOrAbove ? 'approved' : 'pending',
        is_public: isTeamLeaderOrAbove ? true : false
      })

    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast(
      isTeamLeaderOrAbove
        ? 'Post published successfully!'
        : 'Post submitted for approval.',
      'success'
    )

    setTitle('')
    setContent('')
    setShowForm(false)
    fetchPosts(org.id)
  }

  async function handleApprove(postId) {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'approved', is_public: true })
      .eq('id', postId)

    if (error) {
      showToast('Failed to approve post.', 'error')
      return
    }

    showToast('Post approved!', 'success')
    fetchPosts(org.id)
  }

  const canCreatePost = ['content_maker', 'team_leader', 'admin', 'owner'].includes(role)
  const canApprove = ['team_leader', 'admin', 'owner'].includes(role)
  const contentMakersList = members.filter(m => m.role === 'content_maker')

  const statusBadge = {
    approved: 'bg-green-500 text-green-950',
    pending: 'bg-yellow-500 text-yellow-950'
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loading fullScreen text="Loading posts..." />
    </div>
  )
  async function handleRoleChange(userId, newRole) {
  if (!window.confirm(`Change role to "${newRole}"?`)) return

  // If changing to content_maker — need to assign a team leader
  if (newRole === 'content_maker') {
    const teamLeaders = members.filter(m => m.role === 'team_leader')
    
    if (teamLeaders.length === 0) {
      showToast('No team leaders available. Assign a team leader first.', 'error')
      return
    }

    // Show team leader selection
    const teamLeaderEmail = window.prompt(
      'Enter team leader email to assign this content maker to:\n' +
      teamLeaders.map(tl => `- ${tl.profiles?.email}`).join('\n')
    )

    if (!teamLeaderEmail) return

    const selectedLeader = teamLeaders.find(tl => tl.profiles?.email === teamLeaderEmail)

    if (!selectedLeader) {
      showToast('Team leader not found.', 'error')
      return
    }

    // Check team leader's current content maker count
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact' })
      .eq('org_id', org.id)
      .eq('manager_id', selectedLeader.user_id)
      .eq('role', 'content_maker')

    const limit = selectedLeader.team_size_limit || 0
    if (count >= limit) {
      showToast(`This team leader has reached their limit of ${limit} content makers. Current count is ${count}.`, 'error')
      return
    }

    // Assign role and manager
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole, manager_id: selectedLeader.user_id })
      .eq('org_id', org.id)
      .eq('user_id', userId)

    if (error) {
      showToast('Failed to update role.', 'error')
      return
    }

    showToast('Role updated and assigned to team leader.', 'success')
    fetchOrgData()
    return
  }

  // For all other roles
  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole, manager_id: null })
    .eq('org_id', org.id)
    .eq('user_id', userId)

  if (error) {
    showToast('Failed to update role.', 'error')
    return
  }
  const wasTeamLeader = members.find(m => m.user_id === userId)?.role === 'team_leader'
  if (wasTeamLeader) {
    const { error: cmError } = await supabase
      .from('organization_members')
      .update({ role: 'member', manager_id: null })
      .eq('org_id', org.id)
      .eq('manager_id', userId)

    if (cmError) {
      showToast('Role updated but failed to reassign content makers.', 'error')
    } else {
      showToast('Role updated. Content makers have been moved to member.', 'success')
    }

    fetchOrgData()
    return
  }
  showToast('Role updated.', 'success')
  fetchOrgData()
}

async function handleUpdateTeamLimit(userId, newLimit) {
  const limit = parseInt(newLimit)
  if (isNaN(limit) || limit < 1) {
    showToast('Invalid limit.', 'error')
    return
  }

  // Check current count first
  const { count } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact' })
    .eq('org_id', org.id)
    .eq('manager_id', userId)
    .eq('role', 'content_maker')

  if (!window.confirm(`Are you sure you want to change the team limit to ${limit}? There are currently ${count} content makers in this team.`)) {
    fetchOrgData()
    return
  }

  if (limit < count) {
    const toRemove = count - limit
    if (!window.confirm(`This team leader has ${count} content makers, which exceeds the new limit of ${limit}. You must remove ${toRemove} member(s) before updating. Proceed to select members to remove?`)) {
      fetchOrgData()
      return
    }

    const { data: teamMembers } = await supabase
      .from('organization_members')
      .select('user_id, profiles!fk_user_profile(email)')
      .eq('org_id', org.id)
      .eq('manager_id', userId)
      .eq('role', 'content_maker')

    let removed = 0
    let currentTeam = [...(teamMembers || [])]

    while (removed < toRemove) {
      const email = window.prompt(
        `Enter the email of the member to remove (${removed + 1}/${toRemove}):\n` +
        currentTeam.map(m => `- ${m.profiles?.email}`).join('\n')
      )

      if (!email) break

      const memberIndex = currentTeam.findIndex(m => m.profiles?.email === email)
      if (memberIndex === -1) {
        alert('Member not found in this team. Please type the exact email from the list.')
        continue
      }
     //done
      const member = currentTeam[memberIndex]
      const { error: removeError } = await supabase
        .from('organization_members')
        .update({ manager_id: null, role: 'member' })
        .eq('org_id', org.id)
        .eq('user_id', member.user_id)

      if (removeError) {
        alert('Failed to remove member: ' + removeError.message)
        break
      }

      currentTeam.splice(memberIndex, 1)
      removed++
    }

    if (removed < toRemove) {
      showToast('Limit not updated. You must remove all extra members first.', 'error')
      fetchOrgData()
      return
    }
  }

  const { error } = await supabase
    .from('organization_members')
    .update({ team_size_limit: limit })
    .eq('org_id', org.id)
    .eq('user_id', userId)

  if (error) {
    showToast('Failed to update limit.', 'error')
    return
  }

  showToast('Team size limit updated.', 'success')
  fetchOrgData()
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

  // Check directly from database if already a member
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('org_id', org.id)
    .eq('user_id', profileData.id)
    .maybeSingle()

  if (existingMember) {
    showToast('This user is already a member.', 'error')
    return
  }

  // Delete any old invite
  await supabase
    .from('invitations')
    .delete()
    .eq('org_id', org.id)
    .eq('invited_user_id', profileData.id)

  // Create fresh invite
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

async function handleRemoveMember(userId) {
  if (!window.confirm('Remove this member from the organization?')) return

  const wasTeamLeader = members.find(m => m.user_id === userId)?.role === 'team_leader'

  // If team leader — reassign their content makers to member first
  if (wasTeamLeader) {
    await supabase
      .from('organization_members')
      .update({ role: 'member', manager_id: null })
      .eq('org_id', org.id)
      .eq('manager_id', userId)
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('org_id', org.id)
    .eq('user_id', userId)

  if (error) {
    showToast('Failed to remove member.', 'error')
    return
  }
  await supabase
    .from('invitations')
    .delete()
    .eq('org_id', org.id)
    .eq('invited_user_id', userId)

  showToast('Member removed.', 'info')
  fetchOrgData()
}

async function handleDeletePost(postId) {
  if (!window.confirm('Delete this post?')) return

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)

  if (error) {
    showToast('Failed to delete post.', 'error')
    return
  }

  showToast('Post deleted.', 'info')
  fetchPosts(org.id)
}

async function handleEditPost(post) {
  setEditingPost(post.id)
  setEditTitle(post.title)
  setEditContent(post.content)
}

async function handleSaveEdit(postId) {
  const { error } = await supabase
    .from('posts')
    .update({ title: editTitle, content: editContent })
    .eq('id', postId)

  if (error) {
    showToast('Failed to update post.', 'error')
    return
  }

  showToast('Post updated successfully.', 'success')
  setEditingPost(null)
  fetchPosts(org.id)
}

async function handleAssign(postId, userId) {
  const { error } = await supabase
    .from('posts')
    .update({ assigned_to: userId || null })
    .eq('id', postId)

  if (error) {
    showToast('Failed to assign post.', 'error')
    return
  }

  showToast(userId ? 'Post assigned.' : 'Assignment removed.', 'success')
  fetchPosts(org.id)
}

  async function handleTransferOwnership(userId) {
    if (!window.confirm('Transfer ownership to this admin? You will become an admin.')) return

    const { error: oldOwnerError } = await supabase
      .from('organization_members')
      .update({ role: 'admin' })
      .eq('org_id', org.id)
      .eq('user_id', user.id)

    if (oldOwnerError) {
      showToast('Failed to update your role.', 'error')
      return
    }

    const { error: newOwnerError } = await supabase
      .from('organization_members')
      .update({ role: 'owner' })
      .eq('org_id', org.id)
      .eq('user_id', userId)

    if (newOwnerError) {
      showToast('Failed to transfer ownership.', 'error')
      return
    }

    showToast('Ownership transferred successfully.', 'success')
    fetchOrgData()
  }

  async function handleDeleteOrg() {
    if (!window.confirm(`Are you sure you want to delete "${org.name}"? This cannot be undone.`)) return
    if (!window.confirm('This will delete all posts, members and invites. Are you absolutely sure?')) return

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', org.id)

    if (error) {
      showToast('Failed to delete organization.', 'error')
      return
    }

    showToast('Organization deleted.', 'info')
    navigate('/')
  }



async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, content, created_at, user_id, profiles!comments_user_id_fkey(email)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.log('Error fetching comments:', error.message)
    return
  }

  setComments(prev => ({ ...prev, [postId]: data }))
}

async function handleAddComment(postId) {
  const content = commentInputs[postId]?.trim()
  if (!content) return

  const { error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      content
    })

  if (error) {
    showToast(error.message, 'error')
    return
  }

  setCommentInputs(prev => ({ ...prev, [postId]: '' }))
  fetchComments(postId)
}

async function handleDeleteComment(commentId, postId) {
  if (!window.confirm('Delete this comment?')) return

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    showToast('Failed to delete comment.', 'error')
    return
  }

  showToast('Comment deleted.', 'info')
  fetchComments(postId)
}

function toggleComments(postId) {
  setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }))
  if (!comments[postId]) fetchComments(postId)
}

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white overflow-hidden">
  <div className="absolute w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-600/10 blur-3xl rounded-full top-[-100px] left-[-100px]" />
      {/* Navbar */}
      {/* Navbar */}
<div className="relative border-b border-gray-800 bg-gray-900/70 backdrop-blur-xl px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

  {/* Left — Logo as back button */}
  <div
    onClick={() => navigate('/')}
    className="flex items-center gap-2 cursor-pointer group"
  >
    <div className="h-8 w-8 sm:h-9 sm:w-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold group-hover:bg-indigo-500 transition">
      A
    </div>
    <div>
      <h1 className="text-base sm:text-xl font-semibold tracking-tight">{org?.name}</h1>
      <p className="text-[10px] text-gray-400">{org?.country}</p>
    </div>
  </div>

  {/* Right — Actions */}
  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
    <button
      onClick={() => navigate('/posts')}
      className="text-xs sm:text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition"
    >
      All Posts
    </button>
    <button
      onClick={() => setShowMembers(true)}
      className="text-xs sm:text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 sm:px-4 py-1.5 rounded-lg transition"
    >
      👥 Members
    </button>
    {canCreatePost && (
      <button
        onClick={() => setShowForm(!showForm)}
        className="text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition shadow"
      >
        {showForm ? 'Cancel' : '+ New Post'}
      </button>
    )}
  </div>
</div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Left — Posts */}
        <div className="lg:col-span-2 space-y-4">

          {/* Create post form */}
          {showForm && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-4">Create a Post</h2>
              <input
                type="text"
                placeholder="Post title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              />
              <textarea
                placeholder="Write your post content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 resize-none"
              />
              <button
                onClick={handleCreatePost}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition"
              >
                {['team_leader', 'admin', 'owner'].includes(role) ? 'Publish' : 'Submit for Approval'}
              </button>
            </div>
          )}

          {/* Posts list */}
          {!showForm && (
            <>
  
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Posts</h2>

          {posts.length === 0 ? (
            <p className="text-gray-500 text-sm">No posts yet.</p>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadge[post.status] || 'bg-gray-700 text-gray-300'}`}>
                    {post.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Content */}
                {/* Content — show edit form or normal view */}
{editingPost === post.id ? (
  <div className="space-y-2 mb-3">
    <input
      type="text"
      value={editTitle}
      onChange={(e) => setEditTitle(e.target.value)}
      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
    <textarea
      value={editContent}
      onChange={(e) => setEditContent(e.target.value)}
      rows={3}
      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
    />
    <div className="flex gap-2">
      <button
        onClick={() => handleSaveEdit(post.id)}
        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition"
      >
        Save
      </button>
      <button
        onClick={() => setEditingPost(null)}
        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition"
      >
        Cancel
      </button>
    </div>
  </div>
) : (
  <>
    <h3 className="text-base font-bold text-white mb-1">{post.title}</h3>
    <p className="text-gray-400 text-sm leading-relaxed">{post.content}</p>
  </>
)}

{/* Assign to content maker — team_leader, admin, owner only */}
{['team_leader', 'admin', 'owner'].includes(role) && contentMakersList.length > 0 && (
  <div className="mt-2 flex items-center gap-2">
    <span className="text-xs text-gray-500">Assigned to:</span>
    <select
      value={post.assigned_to || ''}
      onChange={(e) => handleAssign(post.id, e.target.value)}
      className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <option value="">None</option>
      {contentMakersList.map(m => (
        <option key={m.user_id} value={m.user_id}>
          {m.profiles?.email}
        </option>
      ))}
    </select>
  </div>
)}

                {/* Footer */}
                {/* Footer */}
<div className="mt-4 pt-3 border-t border-gray-800">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <p className="text-xs text-gray-500">
      by <span className="text-gray-400">{post.profiles?.email}</span>
    </p>
    <div className="flex flex-wrap gap-2">
  {canApprove && post.status === 'pending' && (
    <button
      onClick={() => handleApprove(post.id)}
      className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition"
    >
      Approve
    </button>
  )}
  {['admin', 'owner'].includes(role) && (
    <button
      onClick={() => handleDeletePost(post.id)}
      className="text-xs bg-red-900 hover:bg-red-800 text-red-400 px-3 py-1.5 rounded-lg transition"
    >
      Delete
    </button>
  )}
  <button
    onClick={() => handleLike(post.id)}
    className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition ${
      likedPosts.has(post.id)
        ? 'bg-red-900 text-red-400 hover:bg-red-800'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`}
  >
    <span>{likedPosts.has(post.id) ? '❤️' : '🤍'}</span>
    <span>{likeCounts[post.id] || 0}</span>
  </button>
  <button
    onClick={() => toggleComments(post.id)}
    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-lg transition"
  >
    💬 {showComments[post.id] ? 'Hide' : 'Comments'}
  </button>
</div>
  </div>
{/* Edit button */}
{(['team_leader', 'admin', 'owner'].includes(role) ||
  (role === 'content_maker' && post.assigned_to === user.id)) && (
  <button
    onClick={() => handleEditPost(post)}
    className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition mt-3"
  >
    Edit
  </button>
)}
  {/* Comments section */}
  {showComments[post.id] && (
    <div className="mt-4 space-y-3">
      {/* Comments list */}
      {(comments[post.id] || []).length === 0 ? (
        <p className="text-xs text-gray-500">No comments yet.</p>
      ) : (
        (comments[post.id] || []).map(comment => (
          <div key={comment.id} className="flex items-start gap-2 bg-gray-800 rounded-lg px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {comment.profiles?.email?.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 sm:w-auto">
              <p className="text-xs text-gray-400 font-medium">{comment.profiles?.email}</p>
              <p className="text-sm text-white mt-0.5">{comment.content}</p>
            </div>
            {(comment.user_id === user.id || ['admin', 'owner'].includes(role)) && (
              <button
                onClick={() => handleDeleteComment(comment.id, post.id)}
                className="text-xs text-red-400 hover:text-red-300 transition shrink-0 ml-auto sm:ml-0"
              >
                ✕
              </button>
            )}
          </div>
        ))
      )}

      {/* Add comment input */}
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <input
          type="text"
          placeholder="Write a comment..."
          value={commentInputs[post.id] || ''}
          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
          className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => handleAddComment(post.id)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg transition"
        >
          Post
        </button>
      </div>
    </div>
  )}
</div>
</div> 
))
)}
</>
)}
</div>

{/* Members slide panel */}
<>
  {showMembers && (
    <div
      className="fixed inset-0 bg-black/50 z-40"
      onClick={() => setShowMembers(false)}
    />
  )}

  <div className={`fixed top-0 right-0 h-screen w-full sm:w-96 bg-gray-900 border-l border-gray-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${showMembers ? 'translate-x-0' : 'translate-x-full'}`}>

    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800">
      <h2 className="text-base font-bold text-white">Members ({members.length})</h2>
      <button onClick={() => setShowMembers(false)} className="text-gray-400 hover:text-white transition text-xl">✕</button>
    </div>

    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">

      {/* Owner */}
{members.filter(m => m.role === 'owner').length > 0 && (
  <div>
    <h3 className="text-xs font-semibold text-yellow-500 uppercase tracking-wider mb-2">👑 Owner</h3>
    <div className="space-y-2">
      {members.filter(m => m.role === 'owner').map(member => (
        <MemberCard key={member.user_id} member={member} members={members} role={role} user={user} handleRoleChange={handleRoleChange} handleRemoveMember={handleRemoveMember} handleUpdateTeamLimit={handleUpdateTeamLimit} />
      ))}
    </div>
  </div>
)}

{/* Admins */}
{members.filter(m => m.role === 'admin').length > 0 && (
  <div>
    <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">🛡️ Admins</h3>
    <div className="space-y-2">
      {members.filter(m => m.role === 'admin').map(member => (
        <MemberCard key={member.user_id} member={member} members={members} role={role} user={user} handleRoleChange={handleRoleChange} handleRemoveMember={handleRemoveMember} handleUpdateTeamLimit={handleUpdateTeamLimit} />
      ))}
    </div>
  </div>
)}

{/* Team Leaders and their Content Makers */}
{members.filter(m => m.role === 'team_leader').length > 0 && (
  <div>
    <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">🏆 Teams</h3>
    <div className="space-y-3">
      {members.filter(m => m.role === 'team_leader').map(leader => {
        const teamMembers = members.filter(m => m.manager_id === leader.user_id)
        return (
          <div key={leader.user_id} className="border border-gray-700 rounded-xl p-3">
            <MemberCard member={leader} members={members} role={role} user={user} handleRoleChange={handleRoleChange} handleRemoveMember={handleRemoveMember} handleUpdateTeamLimit={handleUpdateTeamLimit} />
            {teamMembers.length > 0 && (
              <div className="mt-2 pl-3 border-l border-gray-700 space-y-2">
                <p className="text-xs text-gray-500">Content Makers</p>
                {teamMembers.map(cm => (
                  <MemberCard key={cm.user_id} member={cm} members={members} role={role} user={user} handleRoleChange={handleRoleChange} handleRemoveMember={handleRemoveMember} handleUpdateTeamLimit={handleUpdateTeamLimit} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  </div>
)}

{/* Content Makers without a team leader */}
{members.filter(m => m.role === 'content_maker' && !m.manager_id).length > 0 && (
  <div>
    <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">🎨 Unassigned Content Makers</h3>
    <div className="space-y-2">
      {members.filter(m => m.role === 'content_maker' && !m.manager_id).map(member => (
        <MemberCard key={member.user_id} member={member} members={members} role={role} user={user} handleRoleChange={handleRoleChange} handleRemoveMember={handleRemoveMember} handleUpdateTeamLimit={handleUpdateTeamLimit} />
      ))}
    </div>
  </div>
)}

{/* Members */}
{members.filter(m => m.role === 'member').length > 0 && (
  <div>
    <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">👥 Members</h3>
    <div className="space-y-2">
      {members.filter(m => m.role === 'member').map(member => (
        <MemberCard key={member.user_id} member={member} members={members} role={role} user={user} handleRoleChange={handleRoleChange} handleRemoveMember={handleRemoveMember} handleUpdateTeamLimit={handleUpdateTeamLimit} />
      ))}
    </div>
  </div>
)}

      {(role === 'owner' || role === 'admin') && (
        <div className="mt-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Invite a Member</h3>
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

      {role === 'owner' && (
        <div className="mt-2 border border-red-900 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">Danger Zone</h2>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Transfer ownership to an admin:</p>
            <div className="space-y-2">
              {members.filter(m => m.role === 'admin').map(member => (
                <div key={member.user_id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-white truncate">{member.profiles?.email}</p>
                  <button
                    onClick={() => handleTransferOwnership(member.user_id)}
                    className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-2 py-1 rounded-lg transition ml-2 shrink-0"
                  >
                    Transfer
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleDeleteOrg}
            className="w-full bg-red-900 hover:bg-red-800 text-red-400 text-sm font-medium rounded-lg px-4 py-2.5 transition"
          >
            Delete Organization
          </button>
        </div>
      )}

    </div>
  </div>
</>


      </div>
    </div>
    
  )
}


function MemberCard({ member, members, role, user, handleRoleChange, handleRemoveMember, handleUpdateTeamLimit }) {
  const email = member.profiles?.email || 'Unknown'
  const initials = email.slice(0, 2).toUpperCase()
  const roleBadgeColor = {
    owner: 'bg-yellow-500 text-yellow-950',
    admin: 'bg-blue-500 text-blue-950',
    member: 'bg-green-500 text-green-950',
    viewer: 'bg-gray-500 text-gray-300',
    content_maker: 'bg-purple-500 text-purple-950',
    team_leader: 'bg-orange-500 text-orange-950',
  }[member.role] || 'bg-gray-500 text-gray-300'

  const myContentMakers = members.filter(m => m.manager_id === member.user_id)

  return (
    <div className="bg-gray-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white truncate">{email}</p>
          {(role === 'owner' || role === 'admin') && member.role !== 'owner' ? (
            <select
              value={member.role}
              onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
              className="mt-1 bg-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
            >
              <option value="member">Member</option>
              <option value="content_maker">Content Maker</option>
              <option value="team_leader">Team Leader</option>
              <option value="admin">Admin</option>
            </select>
          ) : (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${roleBadgeColor}`}>
              {member.role}
            </span>
          )}

          {member.role === 'team_leader' && (
            <div className="mt-1">
              <p className="text-xs text-indigo-400 font-semibold">
                Team: <span className="text-white">{myContentMakers.length} / {member.team_size_limit || 0}</span>
              </p>
              {(role === 'owner' || role === 'admin') && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-500">Limit:</span>
                  <input
                    type="number"
                    defaultValue={member.team_size_limit || 0}
                    min={myContentMakers.length || 1}
                    onBlur={(e) => handleUpdateTeamLimit(member.user_id, e.target.value)}
                    className="w-14 bg-gray-700 text-white text-xs rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {(role === 'owner' || (role === 'admin' && !['owner', 'admin'].includes(member.role)))
          && member.user_id !== user.id && (
          <button
            onClick={() => handleRemoveMember(member.user_id)}
            className="text-xs text-red-400 hover:text-red-300 transition shrink-0"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

export default OrgPage

