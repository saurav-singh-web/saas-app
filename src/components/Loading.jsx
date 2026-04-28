function Loading({ fullScreen = false, text = "Loading..." }) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-4
        ${fullScreen ? "h-[60vh]" : "py-10"}
      `}
    >
      {/* Glow Spinner */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30"></div>

        <div className="
          absolute inset-0
          rounded-full
          border-2 border-transparent
          border-t-indigo-500
          animate-spin
        "></div>

        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full blur-md bg-indigo-500/20"></div>
      </div>

      {/* Text */}
      <p className="text-gray-400 text-sm tracking-wide">
        {text}
      </p>
    </div>
  )
}

export default Loading