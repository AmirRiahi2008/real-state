/** A decorative, lightweight cloth flag. The red hoist stays on the left in both locales. */
export function NavUaeFlag() {
  return (
    <span className="nav-uae-flag" aria-hidden="true">
      <span className="nav-uae-flag-pole" />
      <span className="nav-uae-flag-cloth">
        <span className="nav-uae-flag-fold" />
      </span>
    </span>
  );
}
