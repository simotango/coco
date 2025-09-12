#!/bin/bash

# Azure Deployment Script for Zalagh Plancher
# Run this script to deploy your application to Azure

echo "🚀 Starting Azure deployment for Zalagh Plancher..."

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

# Set variables (modify these for your setup)
RESOURCE_GROUP="zalagh-plancher-rg"
APP_NAME="zalagh-plancher-app"

# Region confirmed as allowed for your subscription
LOCATION="East US"  # ✅ CONFIRMED ALLOWED

SKU="B1"

echo "📋 Configuration:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   App Name: $APP_NAME"
echo "   Location: $LOCATION"
echo "   SKU: $SKU"

# Create resource group
echo "📦 Creating resource group..."
az group create --name $RESOURCE_GROUP --location "$LOCATION"

# Create App Service plan
echo "🏗️ Creating App Service plan..."
az appservice plan create \
    --name "${APP_NAME}-plan" \
    --resource-group $RESOURCE_GROUP \
    --location "$LOCATION" \
    --sku $SKU \
    --is-linux

# Create web app
echo "🌐 Creating web app..."
az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan "${APP_NAME}-plan" \
    --name $APP_NAME \
    --runtime "NODE|18-lts"

# Configure app settings
echo "⚙️ Configuring app settings..."
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
        NODE_ENV=production \
        WEBSITE_NODE_DEFAULT_VERSION=18.17.0

# Enable logging
echo "📝 Enabling logging..."
az webapp log config \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --application-logging true \
    --level information

echo "✅ Azure App Service created successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Set up your PostgreSQL database in Azure"
echo "2. Configure environment variables in the Azure Portal"
echo "3. Deploy your code using one of these methods:"
echo "   - Azure CLI: git push azure main"
echo "   - VS Code: Right-click folder > Deploy to Web App"
echo "   - Azure Portal: Go to Deployment Center"
echo ""
echo "🌐 Your app will be available at: https://$APP_NAME.azurewebsites.net"
echo ""
echo "📚 For detailed instructions, see azure-deploy.md"
