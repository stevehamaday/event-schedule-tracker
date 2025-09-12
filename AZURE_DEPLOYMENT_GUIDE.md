# Azure Deployment Guide for Event Schedule Tracker

## Prerequisites
- Azure subscription (you have this via Microsoft)
- Azure CLI installed
- Node.js 16+ installed locally

## Deployment Steps

### 1. Install Azure CLI (if not already installed)
```bash
# Windows (PowerShell as Administrator)
winget install Microsoft.AzureCLI
```

### 2. Login to Azure
```bash
az login
```

### 3. Create Resource Group
```bash
az group create --name rg-event-tracker --location "East US"
```

### 4. Create Azure Web App
```bash
az webapp create \
  --resource-group rg-event-tracker \
  --plan asp-event-tracker \
  --name event-schedule-tracker-[YOUR-UNIQUE-ID] \
  --runtime "NODE|18-lts" \
  --sku B1
```

### 5. Configure App Settings
```bash
# Set Node.js version
az webapp config appsettings set \
  --resource-group rg-event-tracker \
  --name event-schedule-tracker-[YOUR-UNIQUE-ID] \
  --settings WEBSITE_NODE_DEFAULT_VERSION="18.17.0"

# Set startup command
az webapp config set \
  --resource-group rg-event-tracker \
  --name event-schedule-tracker-[YOUR-UNIQUE-ID] \
  --startup-file "server/index.js"
```

### 6. Deploy from GitHub (Recommended)
```bash
# Configure GitHub deployment
az webapp deployment source config \
  --resource-group rg-event-tracker \
  --name event-schedule-tracker-[YOUR-UNIQUE-ID] \
  --repo-url https://github.com/stevehamaday/event-schedule-tracker \
  --branch master \
  --manual-integration
```

### 7. Alternative: Deploy via ZIP
```bash
# Build the application first
npm run build

# Create deployment package (run from project root)
zip -r deploy.zip . -x "*.git*" "node_modules/*" ".env*"

# Deploy ZIP file
az webapp deployment source config-zip \
  --resource-group rg-event-tracker \
  --name event-schedule-tracker-[YOUR-UNIQUE-ID] \
  --src deploy.zip
```

## Environment Variables
In Azure Portal > App Service > Configuration > Application Settings:

- `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint (if using)
- `AZURE_OPENAI_KEY`: Your Azure OpenAI key (if using)
- `NODE_ENV`: production

## Shared Features Available After Deployment
- `/api/events` - List all shared events
- `/api/events/:eventId` - Get/Create specific event
- Real-time collaboration on event schedules
- Persistent storage across team members
- Microsoft SSO integration (future enhancement)

## Access Your App
Your app will be available at:
https://event-schedule-tracker-[YOUR-UNIQUE-ID].azurewebsites.net

## Database Upgrade (Optional)
For production use with many users, consider upgrading from in-memory storage to:
- Azure SQL Database
- Azure Cosmos DB
- Azure Database for PostgreSQL
