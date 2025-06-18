"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect dashboard to panel
    router.push("/panel");
  }, [router]);
  
  return null;
}