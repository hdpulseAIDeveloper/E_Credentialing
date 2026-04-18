// Key Vault in RBAC mode. Two role assignments are wired up:
//   - the deployer (whoever runs `azd up`) gets Key Vault Administrator
//     so they can rotate secrets locally without going through the
//     portal.
//   - the application UAMI gets Key Vault Secrets User so the running
//     container can read (but not write) secrets at boot.

param location string
param tags object
param name string
param deployerPrincipalId string
param appPrincipalId string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Key Vault Administrator: 00482a5a-887f-4fb3-b363-3b7fe8e74483
resource kvAdmin 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerPrincipalId)) {
  name: guid(kv.id, deployerPrincipalId, 'KeyVaultAdministrator')
  scope: kv
  properties: {
    principalId: deployerPrincipalId
    principalType: 'User'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '00482a5a-887f-4fb3-b363-3b7fe8e74483',
    )
  }
}

// Key Vault Secrets User: 4633458b-17de-408a-b874-0445c86b69e6
resource kvAppRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, appPrincipalId, 'KeyVaultSecretsUser')
  scope: kv
  properties: {
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6',
    )
  }
}

output id string = kv.id
output name string = kv.name
output endpoint string = kv.properties.vaultUri
