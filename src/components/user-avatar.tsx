"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { HiUserCircle } from "react-icons/hi2";

export function UserAvatar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isMenuOpen]);

  if (loading) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />;
  }

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600"
        aria-label="Sign in with Google"
      >
        <HiUserCircle className="h-6 w-6" />
      </button>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="relative self-center" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full shadow-lg transition-all hover:shadow-xl focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        aria-label="User menu"
        aria-expanded={isMenuOpen}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 font-medium text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {isMenuOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <div className="border-b border-gray-200 px-4 py-2">
            <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              setIsMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
