// Azure Cache for Redis — Standard C1 (1GB, replicated). Smallest SKU
// that supports the BullMQ replication semantics (Basic has no replica
// and breaks queue persistence on failover).

param location string
param tags object
param name string

resource redis 'Microsoft.Cache/Redis@2024-04-01-preview' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'Standard'
      family: 'C'
      capacity: 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

output id string = redis.id
output name string = redis.name
output host string = redis.properties.hostName
#disable-next-line outputs-should-not-contain-secrets
output connectionString string = 'rediss://:${redis.listKeys().primaryKey}@${redis.properties.hostName}:${redis.properties.sslPort}'
