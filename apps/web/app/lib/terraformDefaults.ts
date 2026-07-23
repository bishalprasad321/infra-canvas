export const DEFAULT_INSTANCE_PARAMS = {
  instanceName: 'web_server',
  amiId: '',
  instanceType: 't3.medium',
  subnetId: '',
  rootVolumeSize: 30,
  tags: [
    { key: 'Environment', value: 'prod' },
    { key: 'Role', value: 'web' },
  ],
};

export const DEFAULT_SG_PARAMS = {
  sgName: 'web_sg',
  httpPort: 80,
  httpsPort: 443,
  sshEnabled: true,
  allowedCidr: '0.0.0.0/0',
};
