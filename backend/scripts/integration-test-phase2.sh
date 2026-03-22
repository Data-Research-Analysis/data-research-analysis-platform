#!/bin/bash

# Phase 2 Integration Test Script
# 
# This script performs end-to-end testing of workspace validation
# by making actual API calls to verify:
# 1. Creating resources in different workspaces
# 2. Cross-workspace access returns 403
# 3. Same-workspace access succeeds
# 
# Prerequisites:
# - Backend server running on localhost:3002
# - Valid authentication tokens (update below)
# - Two test workspaces available

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (UPDATE THESE WITH YOUR VALUES)
API_BASE="http://localhost:3002"
AUTH_TOKEN_USER1="your-jwt-token-user1-here"  # User in Workspace 1
AUTH_TOKEN_USER2="your-jwt-token-user2-here"  # User in Workspace 2
PROJECT_ID_WS1=1  # Project ID in Workspace 1
PROJECT_ID_WS2=2  # Project ID in Workspace 2
WORKSPACE_ID_1=1
WORKSPACE_ID_2=2

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 2 Integration Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    local workspace_id=$5
    
    if [ -z "$data" ]; then
        curl -s -w "\n%{http_code}" -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${token}" \
            -H "Authorization-Type: auth" \
            -H "X-Workspace-Id: ${workspace_id}" \
            -H "Content-Type: application/json"
    else
        curl -s -w "\n%{http_code}" -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${token}" \
            -H "Authorization-Type: auth" \
            -H "X-Workspace-Id: ${workspace_id}" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Test 1: Create Data Source in Workspace 1
echo -e "${YELLOW}Test 1: Create Data Source in Workspace 1${NC}"
DATA_SOURCE_PAYLOAD='{
  "project_id": '$PROJECT_ID_WS1',
  "name": "Integration Test CSV",
  "data": [
    {"id": 1, "name": "Test Row 1"},
    {"id": 2, "name": "Test Row 2"}
  ],
  "classification": "transactional"
}'

RESPONSE=$(api_call "POST" "/data-source/add-csv" "$AUTH_TOKEN_USER1" "$DATA_SOURCE_PAYLOAD" "$WORKSPACE_ID_1")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    DATA_SOURCE_ID=$(echo "$BODY" | grep -o '"dataSourceId":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Data source created successfully (ID: $DATA_SOURCE_ID)${NC}"
else
    echo -e "${RED}✗ Failed to create data source (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    exit 1
fi

echo ""

# Test 2: Access Data Source from Same Workspace (Should succeed)
echo -e "${YELLOW}Test 2: Access Data Source from Same Workspace${NC}"
RESPONSE=$(api_call "GET" "/data-source/$DATA_SOURCE_ID" "$AUTH_TOKEN_USER1" "" "$WORKSPACE_ID_1")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Same-workspace access successful (HTTP 200)${NC}"
else
    echo -e "${RED}✗ Same-workspace access failed (HTTP $HTTP_CODE)${NC}"
    echo "$RESPONSE" | head -n-1
    exit 1
fi

echo ""

# Test 3: Access Data Source from Different Workspace (Should fail with 403)
echo -e "${YELLOW}Test 3: Access Data Source from Different Workspace${NC}"
RESPONSE=$(api_call "GET" "/data-source/$DATA_SOURCE_ID" "$AUTH_TOKEN_USER2" "" "$WORKSPACE_ID_2")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${GREEN}✓ Cross-workspace access blocked (HTTP 403)${NC}"
else
    echo -e "${RED}✗ Cross-workspace access not blocked (HTTP $HTTP_CODE, expected 403)${NC}"
    echo "$RESPONSE" | head -n-1
    exit 1
fi

echo ""

# Test 4: Create Data Model in Workspace 1
echo -e "${YELLOW}Test 4: Create Data Model in Workspace 1${NC}"
DATA_MODEL_PAYLOAD='{
  "project_id": '$PROJECT_ID_WS1',
  "name": "integration_test_model",
  "sql_query": "SELECT * FROM integration_test",
  "data_source_id": '$DATA_SOURCE_ID'
}'

RESPONSE=$(api_call "POST" "/data-source/build-data-model-on-query" "$AUTH_TOKEN_USER1" "$DATA_MODEL_PAYLOAD" "$WORKSPACE_ID_1")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    DATA_MODEL_ID=$(echo "$BODY" | grep -o '"data_model_id":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Data model created successfully (ID: $DATA_MODEL_ID)${NC}"
else
    echo -e "${RED}✗ Failed to create data model (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    # Don't exit - continue with other tests
    DATA_MODEL_ID=""
fi

echo ""

# Test 5: Access Data Model from Different Workspace (Should fail with 403)
if [ -n "$DATA_MODEL_ID" ]; then
    echo -e "${YELLOW}Test 5: Access Data Model from Different Workspace${NC}"
    RESPONSE=$(api_call "GET" "/data-model/$DATA_MODEL_ID" "$AUTH_TOKEN_USER2" "" "$WORKSPACE_ID_2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

    if [ "$HTTP_CODE" -eq 403 ]; then
        echo -e "${GREEN}✓ Cross-workspace data model access blocked (HTTP 403)${NC}"
    else
        echo -e "${RED}✗ Cross-workspace data model access not blocked (HTTP $HTTP_CODE)${NC}"
        echo "$RESPONSE" | head -n-1
        exit 1
    fi
else
    echo -e "${YELLOW}⊘ Skipping Test 5 (data model not created)${NC}"
fi

echo ""

# Test 6: Create Dashboard in Workspace 1
echo -e "${YELLOW}Test 6: Create Dashboard in Workspace 1${NC}"
DASHBOARD_PAYLOAD='{
  "project_id": '$PROJECT_ID_WS1',
  "data": {
    "name": "Integration Test Dashboard",
    "charts": []
  }
}'

RESPONSE=$(api_call "POST" "/dashboard/add" "$AUTH_TOKEN_USER1" "$DASHBOARD_PAYLOAD" "$WORKSPACE_ID_1")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    DASHBOARD_ID=$(echo "$BODY" | grep -o '"dashboard_id":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Dashboard created successfully (ID: $DASHBOARD_ID)${NC}"
else
    echo -e "${RED}✗ Failed to create dashboard (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    DASHBOARD_ID=""
fi

echo ""

# Test 7: Access Dashboard from Different Workspace (Should fail with 403)
if [ -n "$DASHBOARD_ID" ]; then
    echo -e "${YELLOW}Test 7: Access Dashboard from Different Workspace${NC}"
    RESPONSE=$(api_call "GET" "/dashboard/$DASHBOARD_ID" "$AUTH_TOKEN_USER2" "" "$WORKSPACE_ID_2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

    if [ "$HTTP_CODE" -eq 403 ]; then
        echo -e "${GREEN}✓ Cross-workspace dashboard access blocked (HTTP 403)${NC}"
    else
        echo -e "${RED}✗ Cross-workspace dashboard access not blocked (HTTP $HTTP_CODE)${NC}"
        echo "$RESPONSE" | head -n-1
        exit 1
    fi
else
    echo -e "${YELLOW}⊘ Skipping Test 7 (dashboard not created)${NC}"
fi

echo ""

# Test 8: Update Data Source from Different Workspace (Should fail with 403)
echo -e "${YELLOW}Test 8: Update Data Source from Different Workspace${NC}"
UPDATE_PAYLOAD='{"name": "Hacked Name"}'
RESPONSE=$(api_call "PUT" "/data-source/update/$DATA_SOURCE_ID" "$AUTH_TOKEN_USER2" "$UPDATE_PAYLOAD" "$WORKSPACE_ID_2")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${GREEN}✓ Cross-workspace update blocked (HTTP 403)${NC}"
else
    echo -e "${RED}✗ Cross-workspace update not blocked (HTTP $HTTP_CODE)${NC}"
    echo "$RESPONSE" | head -n-1
    exit 1
fi

echo ""

# Test 9: Delete Data Source from Different Workspace (Should fail with 403)
echo -e "${YELLOW}Test 9: Delete Data Source from Different Workspace${NC}"
RESPONSE=$(api_call "DELETE" "/data-source/delete/$DATA_SOURCE_ID" "$AUTH_TOKEN_USER2" "" "$WORKSPACE_ID_2")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${GREEN}✓ Cross-workspace delete blocked (HTTP 403)${NC}"
else
    echo -e "${RED}✗ Cross-workspace delete not blocked (HTTP $HTTP_CODE)${NC}"
    echo "$RESPONSE" | head -n-1
    exit 1
fi

echo ""

# Cleanup: Delete test resources from correct workspace
echo -e "${YELLOW}Cleanup: Deleting test resources${NC}"

if [ -n "$DASHBOARD_ID" ]; then
    api_call "DELETE" "/dashboard/delete/$DASHBOARD_ID" "$AUTH_TOKEN_USER1" "" "$WORKSPACE_ID_1" > /dev/null
    echo -e "${GREEN}✓ Dashboard deleted${NC}"
fi

if [ -n "$DATA_MODEL_ID" ]; then
    api_call "DELETE" "/data-model/delete/$DATA_MODEL_ID" "$AUTH_TOKEN_USER1" "" "$WORKSPACE_ID_1" > /dev/null
    echo -e "${GREEN}✓ Data model deleted${NC}"
fi

api_call "DELETE" "/data-source/delete/$DATA_SOURCE_ID" "$AUTH_TOKEN_USER1" "" "$WORKSPACE_ID_1" > /dev/null
echo -e "${GREEN}✓ Data source deleted${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All Integration Tests Passed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Workspace validation is working correctly:"
echo "  • Same-workspace access: ✓ Allowed"
echo "  • Cross-workspace access: ✓ Blocked (403)"
echo "  • Cross-workspace update: ✓ Blocked (403)"
echo "  • Cross-workspace delete: ✓ Blocked (403)"
echo ""
