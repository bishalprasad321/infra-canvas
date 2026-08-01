package main

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const userContextKey contextKey = "user"

// AuthMiddleware extracts JWT token from Authorization header or Query params and puts claims in context
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers for preflight or regular request
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		tokenStr := r.Header.Get("Authorization")
		if tokenStr != "" {
			tokenStr = strings.TrimPrefix(tokenStr, "Bearer ")
		} else {
			tokenStr = r.URL.Query().Get("token")
		}

		if tokenStr == "" {
			http.Error(w, "Unauthorized: Authorization token is required", http.StatusUnauthorized)
			return
		}

		claims, err := VerifyToken(tokenStr)
		if err != nil {
			http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserFromContext helper to extract claims from context
func GetUserFromContext(r *http.Request) (*TokenClaims, bool) {
	claims, ok := r.Context().Value(userContextKey).(*TokenClaims)
	return claims, ok
}

// RequireProjectRole checks if the user has access to the project with at least the minimum role (Viewer <= Editor <= Admin)
// role level helper mapping: Viewer: 1, Editor: 2, Admin: 3
func RequireProjectRole(minRole string) func(http.Handler) http.Handler {
	roleLevels := map[string]int{
		"VIEWER": 1,
		"EDITOR": 2,
		"ADMIN":  3,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := GetUserFromContext(r)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Parse projectId from path value (Go 1.22 path wildcard)
			projectId := r.PathValue("id")
			if projectId == "" {
				projectId = r.PathValue("projectId")
			}
			if projectId == "" {
				projectId = r.URL.Query().Get("projectId")
			}

			if projectId == "" {
				http.Error(w, "Bad Request: Project ID is required", http.StatusBadRequest)
				return
			}

			// 1. Check if the project is public. If it is public and minRole is VIEWER, let them through
			var visibility string
			var createdBy string
			var teamId string
			err := db.QueryRow("SELECT visibility, created_by, team_id FROM projects WHERE id = ?", projectId).Scan(&visibility, &createdBy, &teamId)
			if err != nil {
				http.Error(w, "Project not found", http.StatusNotFound)
				return
			}

			// If user is the creator of the project, they have full access (Admin level)
			if createdBy == user.ID {
				next.ServeHTTP(w, r)
				return
			}

			// If project is public and minRole is VIEWER, allow access
			if visibility == "PUBLIC" && minRole == "VIEWER" {
				next.ServeHTTP(w, r)
				return
			}

			// 2. Query project memberships
			var userRole string
			err = db.QueryRow("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?", projectId, user.ID).Scan(&userRole)
			if err != nil {
				// If not a direct project member, check if they are in the team that owns the project
				var teamRole string
				err = db.QueryRow("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?", teamId, user.ID).Scan(&teamRole)
				if err == nil && (teamRole == "OWNER" || teamRole == "ADMIN") {
					// Team admins/owners act as project admins
					next.ServeHTTP(w, r)
					return
				}

				http.Error(w, "Forbidden: Access denied to this project", http.StatusForbidden)
				return
			}

			if roleLevels[userRole] < roleLevels[minRole] {
				http.Error(w, "Forbidden: Insufficient privileges", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
