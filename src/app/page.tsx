import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, ClipboardList, TrendingUp } from "lucide-react";

const stats = [
  { label: "Total Courses", value: "12", icon: BookOpen },
  { label: "Active Students", value: "248", icon: Users },
  { label: "Assignments", value: "36", icon: ClipboardList },
  { label: "Completion Rate", value: "87%", icon: TrendingUp },
];

const recentActivity = [
  {
    student: "Nguyen Van A",
    course: "Mathematics 101",
    action: "Submitted assignment",
    status: "completed",
    date: "2026-05-07",
  },
  {
    student: "Tran Thi B",
    course: "Physics 201",
    action: "Enrolled",
    status: "active",
    date: "2026-05-06",
  },
  {
    student: "Le Van C",
    course: "Chemistry 101",
    action: "Missed deadline",
    status: "overdue",
    date: "2026-05-05",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-xl ring-1 ring-foreground/10">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <stat.icon className="size-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="w-full text-sm">
            <TableHeader className="bg-gray-50 border-b">
              <TableRow>
                <TableHead className="px-4 py-3">Student</TableHead>
                <TableHead className="px-4 py-3">Course</TableHead>
                <TableHead className="px-4 py-3">Action</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3 text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.map((row) => (
                <TableRow key={`${row.student}-${row.date}`}>
                  <TableCell className="px-4 py-3 font-medium text-gray-900">
                    {row.student}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500">
                    {row.course}
                  </TableCell>
                  <TableCell className="px-4 py-3">{row.action}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant={
                        row.status === "completed"
                          ? "default"
                          : row.status === "overdue"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-gray-500">
                    {row.date}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
