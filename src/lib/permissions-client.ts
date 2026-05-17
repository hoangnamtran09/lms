type Role = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "PARENT" | "STUDENT";
type Resource =
  | "users" | "courses" | "lessons" | "subjects"
  | "assignments" | "grades" | "analytics" | "achievements"
  | "settings" | "ai" | "children";
type Action = "read" | "write" | "delete" | "manage" | "grade" | "export";

const permissionMatrix: Record<Role, Partial<Record<Resource, Action[]>>> = {
  SUPER_ADMIN: {
    users: ["manage"], courses: ["manage"], lessons: ["manage"],
    subjects: ["manage"], assignments: ["manage"], grades: ["manage"],
    analytics: ["manage", "export"], achievements: ["manage"], settings: ["manage"],
    ai: ["manage"], children: ["manage"],
  },
  ADMIN: {
    users: ["read", "write"], courses: ["manage"], lessons: ["manage"],
    subjects: ["manage"], assignments: ["manage"], grades: ["manage"],
    analytics: ["read", "export"], achievements: ["manage"], settings: ["read"],
    ai: ["manage"], children: ["manage"],
  },
  TEACHER: {
    users: ["read", "write"], courses: ["read", "write"], lessons: ["manage"],
    subjects: ["read"], assignments: ["read", "write", "grade"],
    grades: ["grade"], analytics: ["read"], achievements: ["read"],
    ai: ["read"], children: ["read"],
  },
  PARENT: {
    courses: ["read"], lessons: ["read"], subjects: ["read"],
    assignments: ["read"], grades: ["read"], analytics: ["read"],
    achievements: ["read"], children: ["manage"],
  },
  STUDENT: {
    courses: ["read"], lessons: ["read"], subjects: ["read"],
    assignments: ["read", "write"], grades: ["read"], analytics: ["read"],
    achievements: ["read"], ai: ["read"],
  },
};

export function hasPermission(role: Role | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false;
  const actions = permissionMatrix[role]?.[resource];
  if (!actions) return false;
  return actions.some((a) => a === action || a === "manage");
}
