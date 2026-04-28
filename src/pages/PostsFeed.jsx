import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Loading from '../components/Loading'

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
      console.log(error.message)
      return
    }

    setPosts(data)

    const counts = {}
    await Promise.all(
      data.map(async (post) => {
        const { count } = await supabase
          .from('likes')
          .select('id', { count: 'exact' })
          .eq('post_id', post.id)

        counts[post.id] = count || 0
      })
    )

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

    const unique = []
    const seen = new Set()

    data.forEach((p) => {
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
    setLikedPosts(new Set(data.map((l) => l.post_id)))
  }

  async function handleLike(postId) {
    if (!user) {
      window.location.href = '/'
      return
    }

    const alreadyLiked = likedPosts.has(postId)

    if (alreadyLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)

      setLikedPosts((prev) => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })

      setLikeCounts((prev) => ({
        ...prev,
        [postId]: (prev[postId] || 1) - 1,
      }))
    } else {
      await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: user.id })

      setLikedPosts((prev) => new Set([...prev, postId]))

      setLikeCounts((prev) => ({
        ...prev,
        [postId]: (prev[postId] || 0) + 1,
      }))
    }
  }

  const filteredPosts =
    selectedOrg === 'all'
      ? posts
      : posts.filter((p) => p.org_id === selectedOrg)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">

      {/* Navbar */}
      <div className="border-b border-gray-800 bg-gray-900/70 backdrop-blur-xl px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold">Public Feed</h1>

        <a
          href="/"
          className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg"
        >
          {user ? 'Dashboard' : 'Sign In'}
        </a>
      </div>

      {/* Main */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setSelectedOrg('all')}
            className={`text-sm px-4 py-1.5 rounded-full ${
              selectedOrg === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            All
          </button>

          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => setSelectedOrg(org.id)}
              className={`text-sm px-4 py-1.5 rounded-full ${
                selectedOrg === org.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {loading ? (
          <Loading fullScreen text="Loading posts..." />
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">No posts</div>
        ) : (
          <div
  className="
    h-[calc(100vh-140px)]
    overflow-y-scroll
    no-scrollbar
    snap-y snap-mandatory
    scroll-smooth

    sm:h-auto
    sm:overflow-visible
    sm:snap-none
  "
  style={{ overscrollBehaviorY: 'contain' }}
>
  {filteredPosts.map((post) => {
    const liked = likedPosts.has(post.id)
    const likeCount = likeCounts[post.id] || 0

    return (
      <div
        key={post.id}
        className="
          snap-start snap-always
          h-[calc(100vh-140px)]
          w-full
          flex items-center justify-center
          px-2

          sm:h-auto
          sm:mb-0
        "
      >
        <div className="w-full h-full flex justify-center">

          <div className="
            w-full
            max-w-2xl
            h-full
            flex flex-col justify-between
            bg-gray-900
            border border-gray-800

            sm:rounded-xl
            sm:h-auto
            sm:p-5
            sm:bg-gray-900/80
          ">

            {/* Header */}
            <div className="flex justify-between px-4 pt-4 sm:px-0 sm:pt-0">
              <span className="text-xs text-indigo-400">
                {post.organizations?.name}
              </span>

              <span className="text-xs text-gray-500">
                {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Content */}
            <div className="flex-grow flex flex-col justify-center px-4 sm:px-0">
              <h2 className="text-xl font-semibold mb-3">
                {post.title}
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed">
                {post.content}
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-4 pb-4 sm:px-0 sm:pb-0 border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-500">
                {post.profiles?.email}
              </span>

              <button
                onClick={() => handleLike(post.id)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  liked
                    ? 'bg-red-900 text-red-400'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {liked ? '❤️' : '🤍'} {likeCount}
              </button>
            </div>

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