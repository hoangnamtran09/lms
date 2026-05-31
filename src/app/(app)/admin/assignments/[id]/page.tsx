"use client";

import TeacherAssignmentDetailPage from "@/app/(app)/teacher/assignments/[id]/page";

export default function AdminAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TeacherAssignmentDetailPage params={params} basePath="/admin" />;
}
