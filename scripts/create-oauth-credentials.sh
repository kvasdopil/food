#!/bin/bash
# Script to create OAuth 2.0 credentials for Recipe Thing

set -e

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No project set. Run: gcloud config set project <project-id>"
  exit 1
fi

echo "Using project: $PROJECT_ID"

# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Create OAuth consent screen configuration (this needs to be done first via console)
echo ""
echo "Step 1: Configure OAuth Consent Screen"
echo "Visit: https://console.cloud.google.com/apis/credentials/consent/edit?project=$PROJECT_ID"
echo "Set up the consent screen with:"
echo "  - Application name: Recipe Thing"
echo "  - Support email: your-email@gmail.com"
echo "  - Scopes: email, profile, openid"
echo ""
read -p "Press Enter after you've configured the consent screen..."

# Create OAuth 2.0 Client ID
echo ""
echo "Step 2: Creating OAuth 2.0 Client ID..."

RESPONSE=$(curl -s -X POST \
  "https://iamcredentials.googleapis.com/v1/projects/$PROJECT_ID/serviceAccounts?oauthClient" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oauthClient": {
      "displayName": "Recipe Thing Web Client",
      "type": "web",
      "redirectUris": [
        "http://localhost:3000/auth/callback",
        "https://recipe-thing-9wi8kpslr-alexey-guskovs-projects.vercel.app/auth/callback"
      ]
    }
  }' 2>&1)

# Try alternative API endpoint
if echo "$RESPONSE" | grep -q "error\|404\|not found"; then
  echo "Trying alternative method using Google APIs..."
  
  # Use the Google Cloud Console API
  RESPONSE=$(curl -s -X POST \
    "https://console.cloud.google.com/apis/api/iam.googleapis.com/oauthClients?project=$PROJECT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "displayName": "Recipe Thing Web Client",
      "type": "web",
      "redirectUris": [
        "http://localhost:3000/auth/callback",
        "https://recipe-thing-9wi8kpslr-alexey-guskovs-projects.vercel.app/auth/callback"
      ]
    }' 2>&1)
fi

echo "$RESPONSE"

# If still fails, provide manual instructions
if echo "$RESPONSE" | grep -q "error\|404\|not found"; then
  echo ""
  echo "The API method didn't work. Please create credentials manually:"
  echo ""
  echo "1. Visit: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
  echo "2. Click 'Create Credentials' -> 'OAuth client ID'"
  echo "3. Application type: Web application"
  echo "4. Name: Recipe Thing Web Client"
  echo "5. Authorized redirect URIs:"
  echo "   - http://localhost:3000/auth/callback"
  echo "   - https://recipe-thing-9wi8kpslr-alexey-guskovs-projects.vercel.app/auth/callback"
  echo "6. Click Create"
  echo "7. Copy the Client ID and Client Secret"
  exit 1
fi

echo ""
echo "OAuth credentials created successfully!"
echo "Please copy the Client ID and Client Secret above."

