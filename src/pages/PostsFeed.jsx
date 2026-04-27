import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function PostsFeed({ user }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState('all')
  const [orgs, setOrgs] = useState([])
  const [likedPosts, setLikedPosts] = useState(new Set())
  const [likeCounts, setLikeCounts] = useState({})

  useEffect(() => {
    fetchPosts()
    fetchOrgs()
  }, [])
  useEffect(() => {
    if (user && posts.length > 0) {
      fetchUserLikes()
    }
  }, [posts, user])

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        status,
        is_public,
        created_at,
        org_id,
        organizations(name, slug),
        profiles!posts_created_by_fkey(email)
      `)
      .eq('status', 'approved')
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.log('Error fetching posts:', error.message)
      return
    }

    setPosts(data)

    const counts = {}
    await Promise.all(data.map(async (post) => {
      const { count } = await supabase
        .from('likes')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id)
      counts[post.id] = count || 0
    }))
    setLikeCounts(counts)
    setLoading(false)
  }

  async function fetchOrgs() {
  const { data, error } = await supabase
    .from('posts')
    .select('org_id, organizations(id, name)')
    .eq('status', 'approved')
    .eq('is_public', true)

  if (error) return

  // get unique orgs
  const unique = []
  const seen = new Set()
  data.forEach(p => {
    if (p.organizations && !seen.has(p.org_id)) {
      seen.add(p.org_id)
      unique.push({ id: p.org_id, name: p.organizations.name })
    }
  })
  setOrgs(unique)
}
  async function fetchUserLikes() {
    const { data, error } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)

    if (error) return
    setLikedPosts(new Set(data.map(l => l.post_id)))
  }

  async function handleLike(postId) {
    if (!user) {
      window.location.href = '/'
      return
    }

    const alreadyLiked = likedPosts.has(postId)

    if (alreadyLiked) {
      // Unlike
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)

      setLikedPosts(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 1) - 1 }))
    } else {
      // Like
      await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: user.id })

      setLikedPosts(prev => new Set([...prev, postId]))
      setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }))
    }
  }

  const filteredPosts = selectedOrg === 'all'
    ? posts
    : posts.filter(p => p.org_id === selectedOrg)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <div className="border-b border-gray-800 bg-gray-900 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-bold text-white">Public Feed</h1>
        {user && (
        <a
        href="/"
        className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition"
        >
        Dashboard
        </a>
       )}

        {!user && (
         <a
         href="/"
         className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg transition"
       >
         Sign In
        </a>
   )}      
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Org filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => setSelectedOrg('all')}
            className={`text-sm px-4 py-1.5 rounded-full transition ${
              selectedOrg === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {orgs.map(org => (
            <button
              key={org.id}
              onClick={() => setSelectedOrg(org.id)}
              className={`text-sm px-4 py-1.5 rounded-full transition ${
                selectedOrg === org.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <p className="text-gray-400">Loading posts...</p>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No public posts yet.</p>
            <p className="text-gray-600 text-sm mt-2">Posts will appear here once they are approved.</p>
          </div>
        ) : (
         <div className="space-y-4">
            {filteredPosts.map(post => {
              const liked = likedPosts.has(post.id)
              const likeCount = likeCounts[post.id] || 0

              return (
                <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-indigo-400 bg-indigo-950 px-3 py-1 rounded-full">
                      {post.organizations?.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </span>
                  </div>

                {/* Content */}
                  <h2 className="text-lg font-bold text-white mb-2">{post.title}</h2>
                  <p className="text-gray-400 text-sm leading-relaxed">{post.content}</p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500">
                      by <span className="text-gray-400">{post.profiles?.email}</span>
                    </p>

                    {/* Like button */}
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${
                        liked
                          ? 'bg-red-900 text-red-400 hover:bg-red-800'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <span>{liked ? '❤️' : '🤍'}</span>
                      <span>{likeCount}</span>
                       </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


export default PostsFeed