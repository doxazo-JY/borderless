import { notFound } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  if (!process.env.ADMIN_SECRET_PATH || secret !== process.env.ADMIN_SECRET_PATH) {
    notFound();
  }

  const base = `/admin/${secret}`;

  return (
    <div className="flex flex-1 flex-col">
      <nav className="sticky top-0 z-30 flex flex-wrap gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm">
        <Link href={`${base}/setup`} className="underline underline-offset-2">
          설정
        </Link>
        <Link href={`${base}/team`} className="underline underline-offset-2">
          팀
        </Link>
      </nav>
      {children}
    </div>
  );
}
