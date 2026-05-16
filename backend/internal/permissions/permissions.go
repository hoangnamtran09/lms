package permissions

type Resource string

const (
	ResUsers        Resource = "users"
	ResCourses      Resource = "courses"
	ResLessons      Resource = "lessons"
	ResSubjects     Resource = "subjects"
	ResAssignments  Resource = "assignments"
	ResGrades       Resource = "grades"
	ResAnalytics    Resource = "analytics"
	ResAchievements Resource = "achievements"
	ResSettings     Resource = "settings"
	ResGradeLevels  Resource = "grade_levels"
	ResAI           Resource = "ai"
	ResChildren     Resource = "children"
)

type Action string

const (
	ActRead   Action = "read"
	ActWrite  Action = "write"
	ActDelete Action = "delete"
	ActManage Action = "manage"
	ActGrade  Action = "grade"
	ActExport Action = "export"
)

type Role string

const (
	RoleSuperAdmin Role = "SUPER_ADMIN"
	RoleAdmin      Role = "ADMIN"
	RoleTeacher    Role = "TEACHER"
	RoleParent     Role = "PARENT"
	RoleStudent    Role = "STUDENT"
)

var permissionMatrix = map[Role]map[Resource][]Action{
	RoleSuperAdmin: {
		ResUsers:        {ActManage},
		ResCourses:      {ActManage},
		ResLessons:      {ActManage},
		ResSubjects:     {ActManage},
		ResAssignments:  {ActManage},
		ResGrades:       {ActManage},
		ResAnalytics:    {ActManage, ActExport},
		ResAchievements: {ActManage},
		ResSettings:     {ActManage},
		ResGradeLevels:  {ActManage},
		ResAI:           {ActManage},
		ResChildren:     {ActManage},
	},
	RoleAdmin: {
		ResUsers:        {ActRead, ActWrite},
		ResCourses:      {ActManage},
		ResLessons:      {ActManage},
		ResSubjects:     {ActManage},
		ResAssignments:  {ActManage},
		ResGrades:       {ActManage},
		ResAnalytics:    {ActRead, ActExport},
		ResAchievements: {ActManage},
		ResSettings:     {ActRead},
		ResGradeLevels:  {ActManage},
		ResAI:           {ActManage},
		ResChildren:     {ActManage},
	},
	RoleTeacher: {
		ResUsers:        {ActRead},
		ResCourses:      {ActRead, ActWrite},
		ResLessons:      {ActManage},
		ResSubjects:     {ActRead},
		ResAssignments:  {ActRead, ActWrite, ActGrade},
		ResGrades:       {ActGrade},
		ResAnalytics:    {ActRead},
		ResAchievements: {ActRead},
		ResGradeLevels:  {ActRead},
		ResAI:           {ActRead},
		ResChildren:     {ActRead},
	},
	RoleParent: {
		ResCourses:      {ActRead},
		ResLessons:      {ActRead},
		ResSubjects:     {ActRead},
		ResAssignments:  {ActRead},
		ResGrades:       {ActRead},
		ResAnalytics:    {ActRead},
		ResAchievements: {ActRead},
		ResChildren:     {ActManage},
	},
	RoleStudent: {
		ResCourses:      {ActRead},
		ResLessons:      {ActRead},
		ResSubjects:     {ActRead},
		ResAssignments:  {ActRead, ActWrite},
		ResGrades:       {ActRead},
		ResAnalytics:    {ActRead},
		ResAchievements: {ActRead},
		ResAI:           {ActRead},
	},
}

func HasPermission(role Role, resource Resource, action Action) bool {
	actions, ok := permissionMatrix[role][resource]
	if !ok {
		return false
	}
	for _, a := range actions {
		if a == action || a == ActManage {
			return true
		}
	}
	return false
}

type ScopeFilter struct {
	OwnerID  string   // For STUDENT, TEACHER (own records)
	ClassID  string   // For TEACHER (class-level access)
	ChildIDs []string // For PARENT (linked children)
	All      bool     // For ADMIN, SUPER_ADMIN (no restriction)
}

func BuildScopeFilter(role Role, userID, classID string) *ScopeFilter {
	switch role {
	case RoleSuperAdmin, RoleAdmin:
		return &ScopeFilter{All: true}
	case RoleTeacher:
		return &ScopeFilter{OwnerID: userID, ClassID: classID}
	case RoleStudent:
		return &ScopeFilter{OwnerID: userID}
	case RoleParent:
		return &ScopeFilter{OwnerID: userID}
	default:
		return &ScopeFilter{OwnerID: userID}
	}
}
