# Azure Deployment Guide for Zalagh Plancher

## Prerequisites

1. **Azure Account**: You need an active Azure subscription
2. **Node.js 18+**: Installed locally for testing
3. **Git**: For version control and deployment
4. **Azure CLI**: For command-line operations (optional but recommended)

## Step 1: Prepare Your Application

### 1.1 Update package.json
Your `package.json` already looks good, but ensure it has:
- `"start": "node server.js"` script
- All dependencies listed
- Node.js version specified

### 1.2 Environment Variables
Create a `.env` file based on `.env.example` with your actual values.

## Step 2: Set Up Azure Resources

### 2.1 Create Azure App Service
1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Web App"
4. Click "Create"
5. Fill in:
   - **Resource Group**: Create new or select existing
   - **Name**: `zalagh-plancher-app` (must be globally unique)
   - **Runtime stack**: Node 18 LTS
   - **Operating System**: Linux
   - **Region**: **IMPORTANT** - Check allowed regions first (see troubleshooting below)
   - **Pricing Plan**: Basic B1 (minimum for production)

### 2.2 Create Azure Database for PostgreSQL
1. In Azure Portal, click "Create a resource"
2. Search for "Azure Database for PostgreSQL"
3. Click "Create"
4. Choose "Flexible Server"
5. Fill in:
   - **Resource Group**: Same as App Service
   - **Server name**: `zalagh-postgres-server`
   - **Admin username**: `zalaghadmin`
   - **Password**: Generate strong password
   - **Location**: Same as App Service
   - **PostgreSQL version**: 13 or higher
   - **Compute + storage**: Burstable, B1ms (1 vCore, 2 GB RAM)

### 2.3 Configure Database
1. Go to your PostgreSQL server
2. Click "Connection security"
3. Add your IP address to firewall rules
4. Enable "Allow access to Azure services"
5. Note down the connection details

## Step 3: Deploy Your Application

### 3.1 Method 1: Azure CLI (Recommended)
```bash
# Install Azure CLI if not installed
# https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# Login to Azure
az login

# Create deployment user
az webapp deployment user set --user-name <your-username> --password <your-password>

# Configure local Git deployment
az webapp deployment source config-local-git --name zalagh-plancher-app --resource-group <your-resource-group>

# Add Azure remote to your Git repository
git remote add azure <deployment-url-from-previous-command>

# Deploy
git add .
git commit -m "Deploy to Azure"
git push azure main
```

### 3.2 Method 2: Visual Studio Code
1. Install "Azure App Service" extension
2. Sign in to Azure
3. Right-click on your app folder
4. Select "Deploy to Web App"
5. Choose your Azure subscription and App Service

### 3.3 Method 3: GitHub Actions (Advanced)
Create `.github/workflows/azure-deploy.yml`:
```yaml
name: Deploy to Azure
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Deploy to Azure
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'zalagh-plancher-app'
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
```

## Step 4: Configure Environment Variables

### 4.1 In Azure Portal
1. Go to your App Service
2. Click "Configuration" in the left menu
3. Click "New application setting" for each variable:
   - `DATABASE_URL`: `postgresql://zalaghadmin:your-password@zalagh-postgres-server.postgres.database.azure.com:5432/zalagh_plancher?sslmode=require`
   - `JWT_SECRET`: Generate a strong secret (32+ characters)
   - `DEFAULT_ADMIN_PASSWORD`: `admin123`
   - `GEMINI_API_KEY`: Your Gemini API key
   - `NODE_ENV`: `production`

### 4.2 Database Connection String Format
```
postgresql://username:password@hostname:port/database_name?sslmode=require
```

## Step 5: Initialize Database

### 5.1 Connect to Database
1. Go to your PostgreSQL server in Azure Portal
2. Click "Query editor"
3. Login with your admin credentials
4. Run the SQL from `db/schema.sql`
5. Run the SQL from `db/seed.sql`

### 5.2 Alternative: Use pgAdmin
1. Download pgAdmin
2. Add new server with Azure connection details
3. Create database: `zalagh_plancher`
4. Run schema and seed scripts

## Step 6: Configure File Storage

### 6.1 Azure Blob Storage (Recommended for production)
1. Create Storage Account in Azure
2. Create containers: `uploads`, `pdfs`, `pdfsigne`, `planjpg`
3. Update your code to use Azure Blob Storage instead of local files
4. Install `@azure/storage-blob` package

### 6.2 Alternative: Use App Service File System
- Files are stored in `/home/site/wwwroot/`
- Limited to 1GB for Basic plan
- Not recommended for production with file uploads

## Step 7: SSL Certificate

### 7.1 Custom Domain (Optional)
1. Go to your App Service
2. Click "Custom domains"
3. Add your domain
4. Configure DNS records
5. Enable SSL certificate (free with App Service)

## Step 8: Monitoring and Logs

### 8.1 Application Insights
1. Create Application Insights resource
2. Connect to your App Service
3. Monitor performance and errors

### 8.2 Log Streaming
1. Go to your App Service
2. Click "Log stream" to see real-time logs
3. Use "Advanced tools" > "Kudu" for file management

## Step 9: Testing Your Deployment

### 9.1 Health Check
Visit: `https://your-app-name.azurewebsites.net`

### 9.2 Test Endpoints
- Admin login: `POST /api/auth/login`
- Employee login: `POST /api/employee/login`
- Create demande: `POST /api/demandes`

## Step 10: Production Considerations

### 10.1 Security
- Change default admin password
- Use strong JWT secrets
- Enable HTTPS only
- Configure CORS properly
- Regular security updates

### 10.2 Performance
- Enable compression
- Use CDN for static files
- Optimize database queries
- Monitor memory usage

### 10.3 Backup
- Enable automated database backups
- Regular code backups
- Document deployment process

## Troubleshooting

### Region Policy Error (Most Common)
If you get "RequestDisallowedByAzure" error:

1. **Find Your Allowed Regions:**
   ```bash
   # Check allowed regions for your subscription
   az policy assignment list --query "[?contains(displayName, 'Allowed locations') || contains(displayName, 'allowed locations')]"
   
   # Or check in Azure Portal:
   # Go to Policy > Assignments > Look for "Allowed locations" policy
   ```

2. **Common Allowed Regions (try these in order):**
   - `East US`
   - `West US 2`
   - `Central US`
   - `North Europe`
   - `West Europe` (if allowed)

3. **Update Deployment Script:**
   ```bash
   # Edit deploy-azure.sh and change LOCATION to an allowed region
   LOCATION="East US"  # or your allowed region
   ```

4. **Manual Region Check:**
   - Go to Azure Portal
   - Try creating any resource (like a storage account)
   - See which regions are available in the dropdown

### Common Issues
1. **Database Connection**: Check connection string and firewall rules
2. **File Uploads**: Ensure proper permissions and storage configuration
3. **Environment Variables**: Verify all required variables are set
4. **Memory Issues**: Upgrade to higher App Service plan if needed

### Logs Location
- Application logs: `/home/LogFiles/`
- Error logs: App Service > Logs > Application Logs

## Cost Estimation

### Basic Setup (Monthly)
- App Service Basic B1: ~$13
- PostgreSQL Flexible Server B1ms: ~$25
- Storage Account: ~$1
- **Total**: ~$39/month

### Scaling Up
- App Service Standard S1: ~$75/month
- PostgreSQL General Purpose: ~$200/month
- **Total**: ~$275/month

## Support

If you encounter issues:
1. Check Azure Service Health
2. Review application logs
3. Check database connectivity
4. Verify environment variables
5. Contact Azure support if needed

---

**Next Steps**: After deployment, test all functionality and consider setting up CI/CD pipeline for automated deployments.
