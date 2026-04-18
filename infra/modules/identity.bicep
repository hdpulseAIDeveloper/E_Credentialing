// User-assigned managed identity (UAMI). Single identity is shared by
// the web + worker container apps so RBAC, ACR pulls, and Key Vault
// access are configured exactly once.

param location string
param tags object
param name string

resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: name
  location: location
  tags: tags
}

output id string = uami.id
output principalId string = uami.properties.principalId
output clientId string = uami.properties.clientId
output name string = uami.name
