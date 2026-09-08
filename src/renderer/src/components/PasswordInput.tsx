import { useState } from 'react'

export function PasswordInput({
  value,
  onChange,
  className,
  autoComplete,
  autoFocus
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  autoComplete?: string
  autoFocus?: boolean
}): React.JSX.Element {
  const [visible, setVisible] = useState(true)

  return (
    <div className="relative mt-1">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        autoComplete={autoComplete ?? 'off'}
        onChange={(event) => onChange(event.target.value)}
        className={[
          'w-full rounded-md border border-navy/20 px-3 py-2 pr-16 text-navy outline-none focus:border-gold',
          className ?? ''
        ].join(' ')}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((open) => !open)}
        className="absolute inset-y-0 right-2 text-sm font-semibold text-navy-mid hover:text-navy"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
