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

/**
 * Products that run containers, and products that schedule them.
 *
 * endoflife.date files both under generic categories — Docker Engine is "app",
 * Kubernetes is "server-app" — so the distinction the estate actually cares
 * about has to be named here.
 */
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

/** Matched as a word inside the slug: amazon-msk is Kafka, amazon-mq-rabbitmq is RabbitMQ. */
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

/**
 * What kind of component a published product is.
 *
 * A suggestion, not a verdict: the form shows it and the engineer can change
 * it. Ordered most specific first, because a product can carry several tags —
 * Kubernetes is tagged both `cncf` and `server-app`.
 */
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
  // java-runtime, php-runtime, javascript-runtime, python-runtime, ruby-runtime
  if (tags.some((tag) => tag.endsWith('-runtime')) || product.category === 'lang') {
    return 'RUNTIME';
  }
  if (product.category === 'framework') {
    return 'FRAMEWORK';
  }
  return 'OTHER';
}

/**
 * Whether versions of this product map to a cycle by major or major.minor.
 *
 * Read from the cycles the product actually publishes rather than assumed:
 * MongoDB ships cycle "8.0", Docker ships "28". Getting this wrong puts a
 * component in a cycle that was never published, which is how a deployment
 * ends up with no end-of-life date.
 */
export function suggestCycleRule(
  cycles: string[],
): 'MAJOR' | 'MAJOR_MINOR' {
  if (cycles.length === 0) {
    return 'MAJOR_MINOR';
  }

  const dotted = cycles.filter((cycle) => cycle.includes('.')).length;
  return dotted > cycles.length / 2 ? 'MAJOR_MINOR' : 'MAJOR';
}

/** The Simple Icons logo for a product, when one exists. */
export function iconFor(
  slug: string,
): { iconSlug: string; iconColour: string } | null {
  const found = PRODUCT_ICONS[slug];
  return found ? { iconSlug: found[0], iconColour: found[1] } : null;
}
