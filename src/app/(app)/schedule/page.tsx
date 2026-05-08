import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function SchedulePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Schedule</h1>
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">
            Schedule Management
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="size-12 text-gray-300 mb-4" />
          <p className="text-gray-500">No schedule entries yet. This feature is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
