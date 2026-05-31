"use client";

import SubmissionsListPage from "@/app/(app)/teacher/assignments/[id]/submissions/page";

export default function AdminSubmissionsListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SubmissionsListPage params={params} />;
}
