// Reusable Container App definition. Used for both the web (external
// ingress on 6015) and the worker (internal ingress on 6016).
//
// Secrets are pulled from Key Vault via the keyVaultUrl secret type
// so rotating a secret is a single `az keyvault secret set` away —
// no app redeploy required.

param location string
param tags object
param name string
param environmentId string
param identityId string
param registryServer string
param image string
param targetPort int
param external bool
param minReplicas int = 1
param maxReplicas int = 5
param cpu string = '0.5'
param memory string = '1.0Gi'
param keyVaultName string
param appInsightsConnectionString string
param serviceName string

@description('Additional non-secret env vars to inject.')
param extraEnv array = []

var keyVaultBase = 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets'

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: external
        targetPort: targetPort
        transport: 'Auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        corsPolicy: external ? {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          maxAge: 600
        } : null
      }
      registries: [
        {
          server: registryServer
          identity: identityId
        }
      ]
      secrets: [
        {
          name: 'database-url'
          identity: identityId
          keyVaultUrl: '${keyVaultBase}/database-url'
        }
        {
          name: 'redis-url'
          identity: identityId
          keyVaultUrl: '${keyVaultBase}/redis-url'
        }
        {
          name: 'storage-connection-string'
          identity: identityId
          keyVaultUrl: '${keyVaultBase}/storage-connection-string'
        }
        {
          name: 'auth-secret'
          identity: identityId
          keyVaultUrl: '${keyVaultBase}/auth-secret'
        }
        {
          name: 'encryption-key'
          identity: identityId
          keyVaultUrl: '${keyVaultBase}/encryption-key'
        }
      ]
    }
    template: {
      revisionSuffix: 'r${substring(uniqueString(resourceGroup().id, image), 0, 6)}'
      containers: [
        {
          name: serviceName
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: union(
            [
              {
                name: 'NODE_ENV'
                value: 'production'
              }
              {
                name: 'DATABASE_URL'
                secretRef: 'database-url'
              }
              {
                name: 'REDIS_URL'
                secretRef: 'redis-url'
              }
              {
                name: 'AZURE_STORAGE_CONNECTION_STRING'
                secretRef: 'storage-connection-string'
              }
              {
                name: 'AUTH_SECRET'
                secretRef: 'auth-secret'
              }
              {
                name: 'ENCRYPTION_KEY'
                secretRef: 'encryption-key'
              }
              {
                name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
                value: appInsightsConnectionString
              }
              {
                name: 'PORT'
                value: string(targetPort)
              }
            ],
            extraEnv,
          )
          probes: external ? [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/live'
                port: targetPort
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/ready'
                port: targetPort
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ] : []
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: external ? [
          {
            name: 'http-rps'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ] : [
          {
            name: 'cpu'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '70'
              }
            }
          }
        ]
      }
    }
  }
}

output id string = app.id
output name string = app.name
output fqdn string = external ? 'https://${app.properties.configuration.ingress.fqdn}' : ''
