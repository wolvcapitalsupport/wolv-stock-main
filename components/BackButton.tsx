"use client";

import { useRouter } from "next/navigation";

interface BackButtonProps {
  /** Where to go if there's no usable history to go back to (e.g. the
   *  page was opened directly via a shared link / new tab). */
  fallbackHref: string;
  className?: string;
}

/**
 * Real "go back" behavior instead of a hardcoded Link to a fixed route.
 *
 * Trade page -> Back should return to whatever the user was previously
 * looking at (a stock detail page, the markets list, etc.), not always
 * bounce to the homepage. router.back() does that using the browser's
 * actual navigation history.
 *
 * Edge case: if this page was opened directly (no prior in-app history),
 * history.length will be 1 (or very close to it), and router.back() would
 * either do nothing or leave the app entirely. In that case we fall back
 * to a sensible in-app route instead.
 *
 * This does not touch wallet state at all - it's pure navigation.
 */
export default function BackButton({ fallbackHref, className }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className={className}
    >
      ←
    </button>
  );
}
