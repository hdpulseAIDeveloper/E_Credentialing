// =============================================================================
// E-Credentialing CVO platform — root Bicep template (subscription scope).
//
// Wave 4.5 — wires `azd up` to a single-resource-group deployment that
// stands up:
//
//   - Log Analytics workspace + Application Insights (telemetry sink)
//   - User-assigned managed identity (UAMI) — pulls images from ACR,
//     reads secrets from Key Vault, and is the Postgres AAD admin.
//   - Azure Container Registry (Premium SKU for ACR Tasks + geo-rep)
//   - Container Apps environment (workload-profile = Consumption)
//   - Azure Database for PostgreSQL Flexible Server (with `ecred_app` DB)
//   - Azure Cache for Redis (Standard SKU C1)
//   - Azure Storage Account (private blob containers for documents)
//   - Azure Key Vault (RBAC mode; UAMI gets Key Vault Secrets User)
//   - 2 Container Apps: `web` (Next.js) and `worker` (BullMQ)
//
// Out of scope here, intentionally:
//   - Azure Front Door / CDN          → add when multi-region lands.
//   - DNS zone bindings               → managed in the customer tenant.
//   - Service Bus / Event Grid        → not used by the current arch.
//
// All cost-sensitive SKUs are deliberately on the *low* end so a
// solo-deployer can `azd up` against a fresh subscription without
// triggering a quota request. Production deployments must override the
// SKU params via main.parameters.json before running `azd up`.
// =============================================================================
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment. Becomes a suffix on every Azure resource so multiple envs (dev/staging/prod) can co-exist.')
param environmentName string

@minLength(1)
@description('Primary Azure region for all resources.')
param location string

@description('Object ID of the principal (user/SP) running azd. Granted Key Vault Administrator + Storage Blob Data Owner.')
param principalId string = ''

@description('Postgres flexible-server admin login.')
@secure()
param postgresAdminLogin string

@description('Postgres flexible-server admin password.')
@secure()
param postgresAdminPassword string

@description('Auth.js (NextAuth) signing secret.')
@secure()
param appAuthSecret string

@description('32-byte base64 PHI encryption key (AES-256-GCM).')
@secure()
param appPhiEncryptionKey string

@description('Public NEXTAUTH_URL (e.g. https://app.example.com). Container Apps will mint its own *.azurecontainerapps.io FQDN — set this if you front the app with a custom domain.')
param appNextAuthUrl string

@description('Container image for the web service. azd overrides this on every deploy; the default is a placeholder so the first `azd provision` succeeds.')
param containerImageWeb string

@description('Container image for the worker service.')
param containerImageWorker string

var abbrs = loadJsonContent('./abbreviations.json')
var tags = {
  'azd-env-name': environmentName
  'workload': 'ecred-cvo'
  'application': 'e-credentialing'
}

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    tags: tags
    logAnalyticsName: '${abbrs.logAnalyticsWorkspace}${resourceToken}'
    appInsightsName: '${abbrs.applicationInsights}${resourceToken}'
  }
}

module identity './modules/identity.bicep' = {
  name: 'identity'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.userAssignedIdentity}${resourceToken}'
  }
}

module registry './modules/registry.bicep' = {
  name: 'registry'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.containerRegistry}${resourceToken}'
    pullerPrincipalId: identity.outputs.principalId
  }
}

module keyVault './modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.keyVault}${resourceToken}'
    deployerPrincipalId: principalId
    appPrincipalId: identity.outputs.principalId
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.storageAccount}${resourceToken}'
    appPrincipalId: identity.outputs.principalId
    deployerPrincipalId: principalId
  }
}

module postgres './modules/postgres.bicep' = {
  name: 'postgres'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.dbForPostgreSqlFlexible}${resourceToken}'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
  }
}

module redis './modules/redis.bicep' = {
  name: 'redis'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.redisCache}${resourceToken}'
  }
}

// Persist the top-tier secrets into Key Vault so the apps can mount them
// at boot without azd needing to re-template every deploy.
module secretsSeed './modules/keyvault-secrets.bicep' = {
  name: 'secrets-seed'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.name
    secrets: [
      {
        name: 'database-url'
        value: postgres.outputs.connectionString
      }
      {
        name: 'redis-url'
        value: redis.outputs.connectionString
      }
      {
        name: 'storage-connection-string'
        value: storage.outputs.connectionString
      }
      {
        name: 'auth-secret'
        value: appAuthSecret
      }
      {
        name: 'encryption-key'
        value: appPhiEncryptionKey
      }
      {
        name: 'applicationinsights-connection-string'
        value: monitoring.outputs.appInsightsConnectionString
      }
    ]
  }
}

module env './modules/container-apps-env.bicep' = {
  name: 'aca-env'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.containerAppsEnvironment}${resourceToken}'
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsSharedKey: monitoring.outputs.logAnalyticsSharedKey
  }
}

module web './modules/container-app.bicep' = {
  name: 'app-web'
  scope: rg
  params: {
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    name: '${abbrs.containerApp}web-${resourceToken}'
    environmentId: env.outputs.id
    identityId: identity.outputs.id
    registryServer: registry.outputs.loginServer
    image: containerImageWeb
    targetPort: 6015
    external: true
    minReplicas: 1
    maxReplicas: 5
    cpu: '0.5'
    memory: '1.0Gi'
    keyVaultName: keyVault.outputs.name
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    serviceName: 'web'
    extraEnv: [
      {
        name: 'NEXTAUTH_URL'
        value: appNextAuthUrl
      }
      {
        name: 'AZURE_STORAGE_CONTAINER'
        value: storage.outputs.documentsContainer
      }
    ]
  }
  dependsOn: [
    secretsSeed
  ]
}

module worker './modules/container-app.bicep' = {
  name: 'app-worker'
  scope: rg
  params: {
    location: location
    tags: union(tags, { 'azd-service-name': 'worker' })
    name: '${abbrs.containerApp}worker-${resourceToken}'
    environmentId: env.outputs.id
    identityId: identity.outputs.id
    registryServer: registry.outputs.loginServer
    image: containerImageWorker
    targetPort: 6016
    external: false
    minReplicas: 1
    maxReplicas: 3
    cpu: '0.5'
    memory: '1.0Gi'
    keyVaultName: keyVault.outputs.name
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    serviceName: 'worker'
    extraEnv: [
      {
        name: 'AZURE_STORAGE_CONTAINER'
        value: storage.outputs.documentsContainer
      }
    ]
  }
  dependsOn: [
    secretsSeed
  ]
}

// =============================================================================
// Outputs — consumed by `azd env get-values` and the GitHub Actions
// pipeline so post-deploy smoke tests have everything they need.
// =============================================================================
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = subscription().tenantId
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = registry.outputs.name
output AZURE_CONTAINER_APPS_ENVIRONMENT_ID string = env.outputs.id
output AZURE_KEY_VAULT_NAME string = keyVault.outputs.name
output AZURE_KEY_VAULT_ENDPOINT string = keyVault.outputs.endpoint
output AZURE_STORAGE_ACCOUNT_NAME string = storage.outputs.name
output AZURE_STORAGE_DOCUMENTS_CONTAINER string = storage.outputs.documentsContainer
output AZURE_POSTGRES_HOST string = postgres.outputs.fqdn
output AZURE_REDIS_HOST string = redis.outputs.host
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.appInsightsConnectionString
output WEB_APP_URI string = web.outputs.fqdn
output WORKER_APP_NAME string = worker.outputs.name
