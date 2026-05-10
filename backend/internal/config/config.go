package config

import "os"

type Config struct {
	Port                  string
	DatabaseURL           string
	JWTSecret             string
	SupabaseJWTSecret     string
	SupabaseURL           string
	SupabaseServiceRole   string
	AIAPIURL              string
	AIAPIKey              string
	AIModel               string
	CORSOrigin            string
	R2BaseURL             string
	R2AccountID           string
	R2AccessKeyID         string
	R2SecretAccessKey     string
	R2BucketName          string
	R2PublicURL           string
}

func Load() *Config {
	return &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://lms:lms_secret@localhost:5433/lms?sslmode=disable"),
		JWTSecret:         getEnv("JWT_SECRET", "dev-jwt-secret-change-in-production"),
		SupabaseJWTSecret: getEnv("SUPABASE_JWT_SECRET", ""),
		SupabaseURL:       getEnv("SUPABASE_URL", ""),
		SupabaseServiceRole: getEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
		AIAPIURL:          getEnv("AI_API_URL", "https://platform.beeknoee.com/api/v1"),
		AIAPIKey:          getEnv("AI_API_KEY", "sk-bee-d32a3f4bc08544b4945bee85e9bb3ff8529b51458b6e46b19dfbfc4bba945179"),
		AIModel:           getEnv("AI_MODEL", "gemini-2.5-pro"),
		CORSOrigin:        getEnv("CORS_ORIGIN", "http://localhost:3000"),
		R2BaseURL:         getEnv("R2_BASE_URL", "https://pub-39cbea72738b4b959794efb735bf26b4.r2.dev"),
		R2AccountID:       getEnv("R2_ACCOUNT_ID", "b194e241517696696eba4c6c3f937b63"),
		R2AccessKeyID:     getEnv("R2_ACCESS_KEY_ID", "08aa51e5f50e40f63c400ff47f494bfd"),
		R2SecretAccessKey: getEnv("R2_SECRET_ACCESS_KEY", "c8b74765768732b2774fde3918271eea378ebc13484bae91219fce7821985f28"),
		R2BucketName:      getEnv("R2_BUCKET_NAME", "lmstest"),
		R2PublicURL:       getEnv("R2_PUBLIC_URL", "https://pub-39cbea72738b4b959794efb735bf26b4.r2.dev"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
