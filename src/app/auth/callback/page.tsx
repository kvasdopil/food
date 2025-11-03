"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (!supabase) {
      router.push("/feed");
      return;
    }

    // Handle the OAuth callback
    supabase.auth.getSession().then(() => {
      // Redirect to feed after session is established
      router.push("/feed");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
