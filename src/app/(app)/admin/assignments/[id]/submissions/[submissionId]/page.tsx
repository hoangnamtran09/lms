"use client";

import SubmissionDetailPage from "@/app/(app)/teacher/assignments/[id]/submissions/[submissionId]/page";

export default function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  return <SubmissionDetailPage params={params} />;
}
