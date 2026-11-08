/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-outbound',
      severity: 'error',
      comment: 'domain/ imports nothing outside itself or Node builtins.',
      from: { path: '^server/src/domain', pathNot: '\\.test\\.ts$' },
      to: {
        pathNot: '^server/src/domain',
        dependencyTypesNot: ['core', 'type-only'],
      },
    },
    {
      name: 'application-no-adapters',
      severity: 'error',
      comment: 'application/ may import domain and ports only.',
      from: { path: '^server/src/application' },
      to: { path: '^server/src/adapters' },
    },
    {
      name: 'adapters-no-cross-import',
      severity: 'error',
      comment: 'Engine adapters must not import each other.',
      from: { path: '^server/src/adapters/([^/]+)', pathNot: '\\.test\\.ts$' },
      to: {
        path: '^server/src/adapters/([^/]+)',
        pathNot: '^server/src/adapters/$1',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
  },
};
