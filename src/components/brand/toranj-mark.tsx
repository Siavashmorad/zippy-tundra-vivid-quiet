export function ToranjMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M40.2 8.4c6.8-3.2 16.2 1.4 16.6 9.4-7.4.6-13.6 4.8-18.2 10.2-2.6-7.6-3.2-16.2 1.6-19.6z"
      />
      <circle cx="30" cy="38" r="21" fill="currentColor" />
      <path
        fill="#fff"
        opacity=".22"
        d="M22 28c4.8-6 12-8 14-4 1.4 2.8-2.2 6.8-8 9.2-5.2 2.2-9.6.8-6-5.2z"
      />
    </svg>
  );
}
