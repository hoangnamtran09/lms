#!/bin/bash
set -euo pipefail

RESOURCE_GROUP="lms-rg"
LOCATION="southeastasia"
ACR_NAME="lmsacr"
APP_NAME="lms-backend"
ENV_NAME="lms-env"

echo "=== 1. Login Azure ==="
az login

echo "=== 2. T?o Resource Group ==="
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "=== 3. T?o Container Registry ==="
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

echo "=== 4. Login registry & push Docker image ==="
az acr login --name $ACR_NAME
docker build --platform linux/amd64 -t "${ACR_NAME}.azurecr.io/lms-backend:latest" -f Dockerfile .
docker push "${ACR_NAME}.azurecr.io/lms-backend:latest"

echo "=== 5. T?o Container App environment ==="
az containerapp env create --name $ENV_NAME --resource-group $RESOURCE_GROUP --location $LOCATION

echo "=== 6. Deploy Container App ==="
if az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP >/dev/null 2>&1; then
  az containerapp update \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --image "${ACR_NAME}.azurecr.io/lms-backend:latest" \
    --set-env-vars \
      PORT="8080" \
      DATABASE_URL="${DATABASE_URL:-}" \
      JWT_SECRET="${JWT_SECRET:-}" \
      SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-}" \
      SUPABASE_URL="${SUPABASE_URL:-}" \
      SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}" \
      AI_API_URL="${AI_API_URL:-}" \
      AI_API_KEY="${AI_API_KEY:-}" \
      AI_MODEL="${AI_MODEL:-}" \
      CORS_ORIGIN="${CORS_ORIGIN:-}" \
      R2_BASE_URL="${R2_BASE_URL:-}" \
      R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}" \
      R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}" \
      R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}" \
      R2_BUCKET_NAME="${R2_BUCKET_NAME:-}" \
      R2_PUBLIC_URL="${R2_PUBLIC_URL:-}"
else
  az containerapp create \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --image "${ACR_NAME}.azurecr.io/lms-backend:latest" \
    --environment $ENV_NAME \
    --ingress external \
    --target-port 8080 \
    --cpu 0.25 --memory 0.5Gi \
    --min-replicas 0 --max-replicas 1 \
    --env-vars \
      PORT="8080" \
      DATABASE_URL="${DATABASE_URL:-}" \
      JWT_SECRET="${JWT_SECRET:-}" \
      SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-}" \
      SUPABASE_URL="${SUPABASE_URL:-}" \
      SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}" \
      AI_API_URL="${AI_API_URL:-}" \
      AI_API_KEY="${AI_API_KEY:-}" \
      AI_MODEL="${AI_MODEL:-}" \
      CORS_ORIGIN="${CORS_ORIGIN:-}" \
      R2_BASE_URL="${R2_BASE_URL:-}" \
      R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}" \
      R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}" \
      R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}" \
      R2_BUCKET_NAME="${R2_BUCKET_NAME:-}" \
      R2_PUBLIC_URL="${R2_PUBLIC_URL:-}"
fi

URL=$(az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
echo "=== Deployed! URL: https://$URL ==="

