package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/lms/backend/internal/config"
	"github.com/lms/backend/internal/router"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	cfg := config.Load()

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate all models
	if err := migrate(db); err != nil {
		log.Fatalf("Failed to migrate: %v", err)
	}

	// Seed initial data
	if err := seed(db); err != nil {
		log.Printf("Seed warning: %v", err)
	}

	r := router.New(db, cfg)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
