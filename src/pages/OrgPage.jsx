import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

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

  useEffect(() => {
    fetchOrgData()
  }, [slug])

  async function fetchOrgData() {
    // Step 1 — get org by slug
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
      .select('role')
      .eq('org_id', orgData.id)
      .eq('user_id', user.id)
      .maybeSingle()

    setRole(memberData?.role || null)

    // Step 3 — get members
    const { data: membersData } = await supabase
      .from('organization_members')
      .select('role, user_id, profiles!fk_user_profile(email)')
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

  const statusBadge = {
    approved: 'bg-green-500 text-green-950',
    pending: 'bg-yellow-500 text-yellow-950'
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )
  async function handleRoleChange(userId, newRole) {
  if (!window.confirm(`Change role to "${newRole}"?`)) return

  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole })
    .eq('org_id', org.id)
    .eq('user_id', userId)

  if (error) {
    showToast('Failed to update role', 'error')
    return
  }

  showToast('Role updated successfully', 'success')
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <div className="border-b border-gray-800 bg-gray-900 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition text-sm"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-white">{org?.name}</h1>
          <span className="text-xs text-gray-500">{org?.country}</span>
        </div>
        {canCreatePost && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition"
          >
            {showForm ? 'Cancel' : '+ New Post'}
          </button>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

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
                <h3 className="text-base font-bold text-white mb-1">{post.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{post.content}</p>

                {/* Footer */}
                {/* Footer */}
<div className="mt-4 pt-3 border-t border-gray-800">
  <div className="flex items-center justify-between">
    <p className="text-xs text-gray-500">
      by <span className="text-gray-400">{post.profiles?.email}</span>
    </p>
    <div className="flex items-center gap-2">
  {canApprove && post.status === 'pending' && (
    <button
      onClick={() => handleApprove(post.id)}
      className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition"
    >
      Approve
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
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 font-medium">{comment.profiles?.email}</p>
              <p className="text-sm text-white mt-0.5">{comment.content}</p>
            </div>
            {(comment.user_id === user.id || ['admin', 'owner'].includes(role)) && (
              <button
                onClick={() => handleDeleteComment(comment.id, post.id)}
                className="text-xs text-red-400 hover:text-red-300 transition shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        ))
      )}

      {/* Add comment input */}
      <div className="flex gap-2 mt-2">
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
        </div>

        {/* Right — Members */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Members</h2>
          <div className="space-y-2">
            {members.map(member => {
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

              return (
                <div key={member.user_id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials}
                  </div>                     
                  <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{email}</p>
                 {(role === 'owner' || role === 'admin') && member.role !== 'owner' ? (
                 <select
                 value={member.role}
                 onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                 className="mt-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
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
                </div>
                  
                </div>
              )
            })}
          </div>
          {/* Invite section */}
{(role === 'owner' || role === 'admin') && (
  <div className="mt-4">
    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
      Invite a Member
    </h2>
    <input
      type="email"
      placeholder="Enter their email"
      value={inviteEmail}
      onChange={(e) => setInviteEmail(e.target.value)}
      className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
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
    </div>
  )
}

export default OrgPage

