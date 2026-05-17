package parent

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/users"
)

type Handler struct {
	service     *Service
	userService *users.Service
}

func NewHandler(service *Service, userService *users.Service) *Handler {
	return &Handler{service: service, userService: userService}
}

func (h *Handler) resolveUserID(ctx context.Context, supabaseID string) (string, error) {
	user, err := h.userService.FindBySupabaseID(ctx, supabaseID)
	if err != nil {
		// Fallback: maybe it's already a local ID (legacy token)
		user, err = h.userService.FindByID(ctx, supabaseID)
		if err != nil {
			return "", err
		}
	}
	return user.ID, nil
}

func (h *Handler) Children(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	userID, err := h.resolveUserID(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, "Không tìm thấy người dùng", http.StatusNotFound)
		return
	}
	children, err := h.service.GetChildren(r.Context(), userID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, children)
}

func (h *Handler) ChildDetail(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	userID, err := h.resolveUserID(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, "Không tìm thấy người dùng", http.StatusNotFound)
		return
	}
	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	childID := ""
	for i, p := range parts {
		if p == "children" && i+1 < len(parts) {
			childID = parts[i+1]
			break
		}
	}
	if childID == "" {
		jsonErr(w, "Missing child ID", http.StatusBadRequest)
		return
	}
	detail, err := h.service.GetChildDetail(r.Context(), userID, childID)
	if err != nil {
		jsonErr(w, "Không tìm thấy hoặc không có quyền xem", http.StatusNotFound)
		return
	}
	jsonOk(w, detail)
}

func (h *Handler) LinkChild(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	userID, err := h.resolveUserID(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, "Không tìm thấy người dùng", http.StatusNotFound)
		return
	}
	var req struct {
		ChildID string `json:"childId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.LinkChild(r.Context(), userID, req.ChildID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "linked"})
}

func (h *Handler) UnlinkChild(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	userID, err := h.resolveUserID(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, "Không tìm thấy người dùng", http.StatusNotFound)
		return
	}
	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	childID := parts[len(parts)-1]
	if childID == "" {
		jsonErr(w, "Missing child ID", http.StatusBadRequest)
		return
	}
	if err := h.service.UnlinkChild(r.Context(), userID, childID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "unlinked"})
}

func (h *Handler) ListLinks(w http.ResponseWriter, r *http.Request) {
	links, err := h.service.ListAllLinks(r.Context())
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, links)
}

func (h *Handler) AdminLinkChild(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ParentID string `json:"parentId"`
		ChildID  string `json:"childId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if req.ParentID == "" || req.ChildID == "" {
		jsonErr(w, "Thiếu parentId hoặc childId", http.StatusBadRequest)
		return
	}
	if err := h.service.LinkChild(r.Context(), req.ParentID, req.ChildID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "linked"})
}

func (h *Handler) AdminUnlinkChild(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	linkID := parts[len(parts)-1]
	if linkID == "" {
		jsonErr(w, "Missing link ID", http.StatusBadRequest)
		return
	}
	if err := h.service.DeleteLinkByID(r.Context(), linkID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "unlinked"})
}

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
