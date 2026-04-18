// Azure Container Registry (Premium SKU — required for ACR Tasks
// remote-build mode used by `azd deploy`).
//
// The UAMI is granted AcrPull so Container Apps can pull images
// without credentials.

param location string
param tags object
param name string
param pullerPrincipalId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
    policies: {
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }
    }
  }
}

// AcrPull built-in role: 7f951dda-4ed3-4680-a7ca-43fe172d538d
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, pullerPrincipalId, 'AcrPull')
  scope: acr
  properties: {
    principalId: pullerPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d',
    )
  }
}

output id string = acr.id
output name string = acr.name
output loginServer string = acr.properties.loginServer
