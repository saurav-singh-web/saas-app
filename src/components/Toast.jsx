import { useEffect, useState } from 'react'

function Toast({ message, type, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300) // wait for animation
    }, 3000)

    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-indigo-600'
  }

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 
      ${colors[type] || colors.info} 
      text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3
      transition-all duration-300
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'}
      `}
    >
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(onClose, 300)
        }}
        className="text-white opacity-70 hover:opacity-100 text-lg leading-none"
      >
        ✕
      </button>
    </div>
  )
}

export default Toast