"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Default redirect to accounts page
export default function DefaultPanelPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.push("/panel/accounts");
  }, [router]);
  
  return null;
}