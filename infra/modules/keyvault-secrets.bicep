// Bulk-seeds named secrets into an existing Key Vault. Used by main.bicep
// to push generated/secured values (DB connection strings, etc.) at
// provision time without exposing them via parameters or outputs.

param keyVaultName string

@description('Array of { name, value } objects.')
@secure()
param secrets array

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [
  for s in secrets: {
    parent: kv
    name: s.name
    properties: {
      value: s.value
      attributes: {
        enabled: true
      }
    }
  }
]
