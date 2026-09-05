import storeLogo from '../assets/logo.png'

/** Swap this import (or assign another URL) to change the splash logo. */
export const PAGE_LOADING_LOGO_SRC = storeLogo

export function PageLoadingScreen({ fading }: { fading: boolean }): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(244, 241, 234, 0.94)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 80ms ease',
        pointerEvents: fading ? 'none' : 'auto'
      }}
    >
      <img
        src={PAGE_LOADING_LOGO_SRC}
        alt="Topline Stores"
        style={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          objectFit: 'cover',
          boxShadow: '0 0 0 3px #c9a227',
          animation: 'toplinePageLoadSpin 450ms linear infinite'
        }}
      />
      <style>
        {`
          @keyframes toplinePageLoadSpin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
