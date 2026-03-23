#!/bin/bash

# Phase 2 Multi-Tenancy Test Suite Runner
# 
# This script runs all Phase 2 workspace validation tests
# Usage: ./run-phase2-tests.sh [backend|frontend|migration|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test mode
MODE=${1:-all}

echo "========================================"
echo "Phase 2 Multi-Tenancy Test Suite"
echo "========================================"
echo ""

# Function to run backend tests
run_backend_tests() {
    echo -e "${YELLOW}Running Backend Tests...${NC}"
    cd "$PROJECT_ROOT/backend"
    
    # Run Phase 2 specific tests with increased memory and serial execution
    NODE_OPTIONS="--max-old-space-size=4096" npm test -- phase2-workspace-validation.test.ts --runInBand
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backend tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Backend tests failed${NC}"
        return 1
    fi
}

# Function to run frontend tests
run_frontend_tests() {
    echo -e "${YELLOW}Running Frontend Tests...${NC}"
    cd "$PROJECT_ROOT/frontend"
    
    # Run Phase 2 specific tests
    npm test -- phase2-workspace-validation.test.ts
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Frontend tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Frontend tests failed${NC}"
        return 1
    fi
}

# Function to verify migration
run_migration_verification() {
    echo -e "${YELLOW}Verifying Migration...${NC}"
    cd "$PROJECT_ROOT/backend"
    
    # Run migration verification queries with increased memory and serial execution
    NODE_OPTIONS="--max-old-space-size=4096" npm test -- phase2-workspace-validation.test.ts --testNamePattern="Migration Verification" --runInBand
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migration verification passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Migration verification failed${NC}"
        return 1
    fi
}

# Main execution
case $MODE in
    backend)
        run_backend_tests
        exit $?
        ;;
    frontend)
        run_frontend_tests
        exit $?
        ;;
    migration)
        run_migration_verification
        exit $?
        ;;
    all)
        BACKEND_RESULT=0
        FRONTEND_RESULT=0
        MIGRATION_RESULT=0
        
        run_backend_tests || BACKEND_RESULT=$?
        echo ""
        run_frontend_tests || FRONTEND_RESULT=$?
        echo ""
        run_migration_verification || MIGRATION_RESULT=$?
        
        echo ""
        echo "========================================"
        echo "Test Summary"
        echo "========================================"
        
        if [ $BACKEND_RESULT -eq 0 ]; then
            echo -e "${GREEN}✓ Backend Tests: PASSED${NC}"
        else
            echo -e "${RED}✗ Backend Tests: FAILED${NC}"
        fi
        
        if [ $FRONTEND_RESULT -eq 0 ]; then
            echo -e "${GREEN}✓ Frontend Tests: PASSED${NC}"
        else
            echo -e "${RED}✗ Frontend Tests: FAILED${NC}"
        fi
        
        if [ $MIGRATION_RESULT -eq 0 ]; then
            echo -e "${GREEN}✓ Migration Verification: PASSED${NC}"
        else
            echo -e "${RED}✗ Migration Verification: FAILED${NC}"
        fi
        
        if [ $BACKEND_RESULT -eq 0 ] && [ $FRONTEND_RESULT -eq 0 ] && [ $MIGRATION_RESULT -eq 0 ]; then
            echo ""
            echo -e "${GREEN}All Phase 2 tests passed! ✓${NC}"
            exit 0
        else
            echo ""
            echo -e "${RED}Some tests failed. Please review the output above.${NC}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [backend|frontend|migration|all]"
        exit 1
        ;;
esac
