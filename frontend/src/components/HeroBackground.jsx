export default function HeroBackground() {
  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    >
      <g transform="translate(60,40) rotate(-8)" opacity="0.08">
        <rect x="0" y="0" width="90" height="170" rx="14" fill="none" stroke="#0E6E52" strokeWidth="6" />
        <line x1="0" y1="140" x2="90" y2="140" stroke="#0E6E52" strokeWidth="6" />
        <circle cx="45" cy="155" r="6" fill="none" stroke="#0E6E52" strokeWidth="6" />
      </g>

      <g transform="translate(560,300) rotate(6)" opacity="0.08">
        <rect x="0" y="0" width="200" height="130" rx="8" fill="none" stroke="#3BAFAF" strokeWidth="6" />
        <rect x="-20" y="130" width="240" height="16" rx="6" fill="none" stroke="#3BAFAF" strokeWidth="6" />
      </g>

      <g transform="translate(650,60) rotate(10)" opacity="0.07">
        <path d="M10,80 A70,70 0 0 1 150,80" fill="none" stroke="#C9962C" strokeWidth="6" />
        <rect x="0" y="70" width="30" height="55" rx="10" fill="none" stroke="#C9962C" strokeWidth="6" />
        <rect x="130" y="70" width="30" height="55" rx="10" fill="none" stroke="#C9962C" strokeWidth="6" />
      </g>

      <g transform="translate(70,340) rotate(-5)" opacity="0.07">
        <rect x="0" y="20" width="150" height="100" rx="10" fill="none" stroke="#0E6E52" strokeWidth="6" />
        <rect x="45" y="0" width="60" height="24" rx="4" fill="none" stroke="#0E6E52" strokeWidth="6" />
        <circle cx="75" cy="70" r="32" fill="none" stroke="#0E6E52" strokeWidth="6" />
      </g>

      <g transform="translate(690,220) rotate(4)" opacity="0.06">
        <rect x="0" y="30" width="70" height="90" rx="16" fill="none" stroke="#3BAFAF" strokeWidth="6" />
        <rect x="18" y="0" width="34" height="30" rx="4" fill="none" stroke="#3BAFAF" strokeWidth="6" />
        <rect x="18" y="120" width="34" height="30" rx="4" fill="none" stroke="#3BAFAF" strokeWidth="6" />
      </g>
    </svg>
  );
}
