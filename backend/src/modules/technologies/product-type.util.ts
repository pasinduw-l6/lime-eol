import { PRODUCT_ICONS } from './data/product-icons';

export type ComponentTypeName =
  | 'DATABASE'
  | 'RUNTIME'
  | 'FRAMEWORK'
  | 'OS'
  | 'CONTAINER'
  | 'ORCHESTRATION'
  | 'MESSAGING'
  | 'LIBRARY'
  | 'OTHER';

const CONTAINER = [
  'docker-engine',
  'docker-desktop',
  'containerd',
  'podman',
  'cri-o',
  'buildah',
];

const ORCHESTRATION = [
  'kubernetes',
  'amazon-eks',
  'azure-kubernetes-service',
  'google-kubernetes-engine',
  'alibaba-ack',
  'openshift',
  'rancher',
  'rke',
  'k3s',
  'nomad',
  'docker-swarm',
  'kubernetes-csi-node-driver-registrar',
];

const MESSAGING = [
  'kafka',
  'rabbitmq',
  'activemq',
  'artemis',
  'pulsar',
  'rocketmq',
  'nats',
  'mosquitto',
  'msk',
  'zeromq',
];

export function suggestComponentType(product: {
  slug: string;
  category: string;
  tags: string[];
}): ComponentTypeName {
  const slug = product.slug.toLowerCase();
  const tags = product.tags.map((tag) => tag.toLowerCase());

  if (CONTAINER.includes(slug)) {
    return 'CONTAINER';
  }
  if (ORCHESTRATION.includes(slug)) {
    return 'ORCHESTRATION';
  }
  if (MESSAGING.some((word) => slug.split('-').includes(word))) {
    return 'MESSAGING';
  }
  if (tags.includes('database') || product.category === 'database') {
    return 'DATABASE';
  }
  if (tags.includes('os') || tags.includes('linux-distribution') || product.category === 'os') {
    return 'OS';
  }
  if (tags.some((tag) => tag.endsWith('-runtime')) || product.category === 'lang') {
    return 'RUNTIME';
  }
  if (product.category === 'framework') {
    return 'FRAMEWORK';
  }
  return 'OTHER';
}

export function suggestCycleRule(
  cycles: string[],
): 'MAJOR' | 'MAJOR_MINOR' {
  if (cycles.length === 0) {
    return 'MAJOR_MINOR';
  }

  const dotted = cycles.filter((cycle) => cycle.includes('.')).length;
  return dotted > cycles.length / 2 ? 'MAJOR_MINOR' : 'MAJOR';
}

export function iconFor(
  slug: string,
): { iconSlug: string; iconColour: string } | null {
  const found = PRODUCT_ICONS[slug];
  return found ? { iconSlug: found[0], iconColour: found[1] } : null;
}
