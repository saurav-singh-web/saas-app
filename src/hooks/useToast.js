import { useState } from 'react'

function useToast() {
  const [toast, setToast] = useState({ message: '', type: 'info' })

  function showToast(message, type = 'info') {
    setToast({ message, type })
  }

  function hideToast() {
    setToast({ message: '', type: 'info' })
  }

  return { toast, showToast, hideToast }
}

export default useToast