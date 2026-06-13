package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/lms/backend/internal/config"
	"github.com/lms/backend/internal/router"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	godotenv.Load()

	cfg := config.Load()

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  cfg.DatabaseURL,
		PreferSimpleProtocol: true, // PgBouncer does not support prepared statements
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}

	// Auto-migrate and seed only when not explicitly skipped.
	// Set SKIP_DB_MIGRATE=1 to avoid running migrations/seed (useful when pointing to prod DB).
	if os.Getenv("SKIP_DB_MIGRATE") == "" {
		// Auto-migrate all models
		if err := migrate(db); err != nil {
			slog.Error("Failed to migrate", "error", err)
			os.Exit(1)
		}

		// Seed initial data
		if err := seed(db, cfg); err != nil {
			slog.Warn("Seed warning", "error", err)
		}

		// Seed demo data (opt-in via SEED_DEMO=true)
		if os.Getenv("SEED_DEMO") == "true" {
			if err := seedDemo(db, cfg); err != nil {
				slog.Warn("Demo seed warning", "error", err)
			}
		}

		// Mock leaderboard data (always runs, idempotent)
		if err := seedMockLeaderboard(db, cfg, "", nil); err != nil {
			slog.Warn("Mock leaderboard warning", "error", err)
		}
	} else {
		slog.Info("SKIP_DB_MIGRATE set — skipping migrate and seed")
	}

	r := router.New(db, cfg)

	addr := fmt.Sprintf(":%s", cfg.Port)
	slog.Info("Server starting", "addr", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		slog.Error("Server failed", "error", err)
		os.Exit(1)
	}
}


