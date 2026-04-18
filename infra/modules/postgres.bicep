// Azure Database for PostgreSQL — Flexible Server. Burstable B1ms is
// the smallest production-grade SKU and is fine for dev/staging; bump
// to GeneralPurpose D2s_v3 for production by editing the params.

param location string
param tags object
param name string

@secure()
param administratorLogin string

@secure()
param administratorLoginPassword string

@description('Postgres major version. 16 is the current Azure default.')
param version string = '16'

@description('Application database created on top of the server.')
param appDatabaseName string = 'ecred_app'

@description('Storage size (GB). Burstable B1ms supports 32–32768.')
param storageSizeGB int = 32

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Disabled'
    }
  }
}

// Allow Azure-internal services (incl. Container Apps egress) to reach
// the server. For production, swap this for VNet integration.
resource fwAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: server
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource appDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: appDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output id string = server.id
output name string = server.name
output fqdn string = server.properties.fullyQualifiedDomainName
#disable-next-line outputs-should-not-contain-secrets
output connectionString string = 'postgresql://${administratorLogin}:${administratorLoginPassword}@${server.properties.fullyQualifiedDomainName}:5432/${appDatabaseName}?sslmode=require'
