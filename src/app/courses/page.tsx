import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function CoursesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Courses</h1>
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">
            Course Management
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="size-12 text-gray-300 mb-4" />
          <p className="text-gray-500">No courses yet. This feature is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
