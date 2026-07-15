import { notFound } from "next/navigation";

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

  return <>{children}</>;
}
