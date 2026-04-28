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
  <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white overflow-hidden">

    {/* Background Glow */}
    <div className="absolute w-[500px] h-[500px] bg-indigo-600/10 blur-3xl rounded-full top-[-120px] left-[-120px]" />
    <div className="absolute w-[400px] h-[400px] bg-purple-600/10 blur-3xl rounded-full bottom-[-120px] right-[-120px]" />

    {/* Navbar */}
    <div className="relative border-b border-gray-800 bg-gray-900/70 backdrop-blur-xl px-4 sm:px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Public Feed</h1>

      {user ? (
        <a
          href="/"
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-all duration-200 shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          Dashboard
        </a>
      ) : (
        <a
          href="/"
          className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg transition-all duration-200 active:scale-95"
        >
          Sign In
        </a>
      )}
    </div>

    {/* Main */}
    <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10">

      {/* Org Filter */}
      <div className="flex gap-2 flex-wrap mb-10">
        <button
          onClick={() => setSelectedOrg('all')}
          className={`text-sm px-4 py-1.5 rounded-full transition-all duration-200 ${
            selectedOrg === 'all'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-gray-800/70 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All
        </button>

        {orgs.map(org => (
          <button
            key={org.id}
            onClick={() => setSelectedOrg(org.id)}
            className={`text-sm px-4 py-1.5 rounded-full transition-all duration-200 ${
              selectedOrg === org.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-gray-800/70 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {org.name}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-gray-400 animate-pulse">Loading posts...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 border border-gray-800 rounded-xl bg-gray-900/40">
          <p className="text-gray-400 text-lg">No public posts yet.</p>
          <p className="text-gray-600 text-sm mt-2">
            Posts will appear here once they are approved.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredPosts.map(post => {
            const liked = likedPosts.has(post.id)
            const likeCount = likeCounts[post.id] || 0

            return (
              <div
                key={post.id}
                className="group relative bg-gray-900/60 backdrop-blur-lg border border-gray-800 
                rounded-xl p-6 transition-all duration-300 
                hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-600/10 hover:-translate-y-1"
              >
                {/* Hover Glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition bg-indigo-600/5" />

                <div className="relative">

                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full">
                      {post.organizations?.name}
                    </span>

                    <span className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-semibold tracking-tight text-white mb-2 group-hover:text-indigo-400 transition">
                    {post.title}
                  </h2>

                  {/* Content */}
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {post.content}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500">
                      by <span className="text-gray-400">{post.profiles?.email}</span>
                    </p>

                    {/* Like Button */}
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
                        liked
                          ? 'bg-red-900/80 text-red-400 hover:bg-red-800'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-base">{liked ? '❤️' : '🤍'}</span>
                      <span>{likeCount}</span>
                    </button>
                  </div>

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