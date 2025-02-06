export function StickerIcon({ className = "h-5 w-5" }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      className={className}
    >
      {/* Main sticker square */}
      <path 
        d="M4 4h16v16H4z" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Peeling corner effect */}
      <path 
        d="M16 4c2 0 4 2 4 4" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Curved line to show bend */}
      <path 
        d="M16 4c-1 0-2 .5-2.5 1.5-.5 1-.5 2.5.5 3.5 1 1 2.5 1 3.5.5C18.5 9 19 8 19 7" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  )
} 