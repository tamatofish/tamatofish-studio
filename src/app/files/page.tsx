'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileManager } from '@/components/file-manager';
import { callAuthenticatedApi } from '@/lib/auth-client';

export default function FilesPage() {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'console' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await callAuthenticatedApi('/api/me');
        if (!active) return;
        if (!res || !res.ok) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        const memberRole = data?.member?.role;
        if (memberRole !== 'admin' && memberRole !== 'console') {
          router.replace('/login');
          return;
        }
        setRole(memberRole);
      } catch {
        router.replace('/login');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f3f5] text-sm font-light text-[#9b9ea4]">
        加载中…
      </div>
    );
  }

  if (!role) return null;

  return (
    <div className="min-h-screen bg-[#f2f3f5] font-sans text-[#1b1c1e] antialiased">
      <FileManager role={role} />
    </div>
  );
}