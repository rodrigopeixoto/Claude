export const FIRST_NAMES = [
  'Sofia', 'Lucas', 'Amanda', 'Rafael', 'Julia', 'Bruno', 'Marina', 'Thiago',
  'Camila', 'Diego', 'Isabela', 'Felipe', 'Larissa', 'Gustavo', 'Mariana', 'Pedro',
];

export const LAST_NAMES = [
  'Silva', 'Costa', 'Almeida', 'Souza', 'Ferreira', 'Rodrigues', 'Carvalho', 'Gomes',
  'Martins', 'Barbosa', 'Ribeiro', 'Pereira', 'Nunes', 'Araujo', 'Teixeira', 'Melo',
];

export const COMPANY_PREFIXES = [
  'Nimbus', 'Vertex', 'Orbital', 'Northwind', 'Bluepeak', 'Cascade', 'Ironclad',
  'Meridian', 'Skyline', 'Anchor', 'Brightline', 'Coreflow', 'Datastream', 'Elevate',
];

export const COMPANY_SUFFIXES = ['Labs', 'Systems', 'Tech', 'Software', 'Analytics', 'Cloud', 'Digital', 'Works'];

export const TITLES_BY_ROLE: Record<string, string[]> = {
  sales: ['VP of Sales', 'Head of Revenue', 'Sales Director', 'Account Executive'],
  marketing: ['CMO', 'Head of Growth', 'Marketing Director', 'Demand Gen Manager'],
  ops: ['COO', 'VP of Operations', 'Revenue Operations Manager'],
  eng: ['CTO', 'VP of Engineering', 'Head of Product'],
  founder: ['CEO', 'Co-founder', 'Founder'],
};

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export const INDUSTRIES = [
  'SaaS', 'Fintech', 'E-commerce', 'Healthtech', 'Martech', 'Cybersecurity',
  'Logistics', 'HR Tech', 'Real Estate Tech', 'EdTech',
];

export const LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Lisbon, Portugal',
  'São Paulo, Brazil', 'London, UK', 'Berlin, Germany', 'Toronto, Canada',
];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
