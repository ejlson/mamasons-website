// Every fact on the construction pages comes from here. Anything not confirmed by the owner
// is marked `placeholder: true`; audit before launch.

export const brand = {
  name: 'Mamasons',
  line: 'Dirty Ice Cream',
  group: 'Maginhawa',
  url: 'https://mamasonsdirtyicecream.com',
};

export const shops = [
  {
    id: 'kentish-town',
    area: 'Kentish Town',
    street: '91 Kentish Town Road',
    city: 'London',
    // Press reports this address; postcode and hours unconfirmed.
    placeholder: true,
  },
  {
    id: 'chinatown',
    area: 'Chinatown',
    street: '32 Newport Court',
    city: 'London',
    placeholder: true,
  },
] as const;

export const flavours = [
  { id: 'ube', name: 'Ube', note: 'purple yam, the one we are known for', colour: '#BA93C4' },
  { id: 'black-buko', name: 'Black buko', note: 'charcoal and young coconut', colour: '#3B3A3F' },
  { id: 'queso', name: 'Queso', note: 'sweet cheese, the street classic', colour: '#F6E3A6' },
  { id: 'kalamansi', name: 'Kalamansi', note: 'Filipino lime, sharp and bright', colour: '#BEDCB6' },
  { id: 'milo', name: 'Milo', note: 'malted chocolate, school-run nostalgia', colour: '#A9764F' },
] as const;

export const bilog = {
  name: 'Bilog',
  note: 'Ice cream sealed in a toasted milk bun',
};

export const social = {
  instagram: {
    label: 'Instagram',
    handle: '@mamasons_',
    href: 'https://www.instagram.com/mamasons_/',
  },
  careers: {
    label: 'Jobs',
    href: 'https://www.maginhawagroup.co.uk/careers',
  },
};

export const status = {
  // Shared truth: the shops trade while the website is built.
  open: 'Both shops are open while we build this.',
};
