type AppleSignInButtonProps = {
  disabled?: boolean;
  onClick: () => void;
};

export function AppleSignInButton({ disabled, onClick }: AppleSignInButtonProps) {
  return (
    <button
      type="button"
      className="social-btn appleSignInButton"
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 384 512" aria-hidden="true">
        <path d="M279.6 258.9c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-72.8-19.7C32.3 89.4 0 135.6 0 229.5c0 27.8 5.1 56.6 15.2 86.2 13.5 39.6 62.1 136.7 112.9 135.1 26.6-.6 45.4-18.9 80.4-18.9 34 0 51.4 18.9 81.4 18.9 51.2-.7 95.3-79 108.1-118.6-68.6-32.2-65-95-65-96.7zm-57.2-141.1c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 68.3 26.1 2 49.9-11.4 68.5-30.7z" />
      </svg>
      <span>Continue with Apple</span>
    </button>
  );
}
