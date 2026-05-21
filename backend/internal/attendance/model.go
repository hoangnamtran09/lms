package attendance

import "time"

const (
	StatusPresent = "PRESENT"
	StatusAbsent  = "ABSENT"
	StatusLate    = "LATE"
	StatusExcused = "EXCUSED"
)

type Attendance struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	ClassID   string    `gorm:"size:36;not null;uniqueIndex:idx_attendance_unique" json:"classId"`
	Date      string    `gorm:"size:10;not null;uniqueIndex:idx_attendance_unique" json:"date"`
	StudentID string    `gorm:"size:36;not null;uniqueIndex:idx_attendance_unique" json:"studentId"`
	Status    string    `gorm:"size:20;not null;default:PRESENT" json:"status"`
	Note      string    `gorm:"size:500" json:"note"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
