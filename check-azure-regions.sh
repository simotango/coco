#!/bin/bash

# Azure Region Checker Script
# This script helps you find which regions are allowed for your Azure subscription

echo "🔍 Checking allowed regions for your Azure subscription..."

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first:"
    echo "   https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "🔐 Please log in to Azure:"
    az login
fi

echo "📋 Checking policy assignments for region restrictions..."

# Check for allowed locations policy
POLICIES=$(az policy assignment list --query "[?contains(displayName, 'Allowed locations') || contains(displayName, 'allowed locations') || contains(displayName, 'Allowed Locations')]" -o table)

if [ -z "$POLICIES" ] || [ "$POLICIES" = "DisplayName" ]; then
    echo "✅ No region restrictions found! You can deploy to any region."
    echo ""
    echo "🌍 Recommended regions for your app:"
    echo "   - East US (fastest for most users)"
    echo "   - West Europe (if you're in Europe)"
    echo "   - Southeast Asia (if you're in Asia)"
else
    echo "⚠️  Found region restrictions:"
    echo "$POLICIES"
    echo ""
    echo "🔧 To see allowed regions:"
    echo "1. Go to Azure Portal > Policy > Assignments"
    echo "2. Click on the 'Allowed locations' policy"
    echo "3. Check the 'Parameters' tab for allowed regions"
fi

echo ""
echo "🧪 Testing region availability..."

# Test common regions
REGIONS=("East US" "West US 2" "Central US" "North Europe" "West Europe" "Southeast Asia")

for region in "${REGIONS[@]}"; do
    echo -n "Testing $region... "
    
    # Try to create a temporary resource group to test the region
    TEST_RG="test-region-$(date +%s)"
    
    if az group create --name "$TEST_RG" --location "$region" --output none 2>/dev/null; then
        echo "✅ Available"
        az group delete --name "$TEST_RG" --yes --output none 2>/dev/null
    else
        echo "❌ Not available"
    fi
done

echo ""
echo "💡 Next steps:"
echo "1. Use one of the available regions above"
echo "2. Update deploy-azure.sh with the chosen region:"
echo "   LOCATION=\"Your Chosen Region\""
echo "3. Run ./deploy-azure.sh again"
