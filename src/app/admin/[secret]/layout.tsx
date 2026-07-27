import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

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
      <AdminNav base={base} />
      {children}
    </div>
  );
}
