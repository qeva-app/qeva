const SECURITY_QUOTES = [
  'Security is not a product, but a process. - Bruce Schneier',
  'The only truly secure system is one that is powered off. - Gene Spafford',
  'Passwords are like underwear: change them often, keep them private. - Unknown',
  'There are two types of companies: those that have been hacked, and those who don\'t yet know they have been hacked. - John Chambers',
  'Security is always excessive until it\'s not enough. - Robbie Sinclair',
  'The best way to keep a secret is to never have one. - Julian Assange',
  'If you think technology can solve your security problems, then you don\'t understand the problems and you don\'t understand the technology. - Bruce Schneier',
  'A chain is only as strong as its weakest link. - Thomas Reid',
  'Trust, but verify. - Ronald Reagan',
  'Privacy is not something that I\'m merely entitled to, it\'s an absolute prerequisite. - Marlon Brando',
  'It takes 20 years to build a reputation and a few minutes of cyber-incident to ruin it. - Stephane Nappo',
  'Data is a precious thing and will last longer than the systems themselves. - Tim Berners-Lee',
  'The more you sweat in training, the less you bleed in combat. - Richard Marcinko',
  'In the digital world, there are only two types of data: data that has been stolen, and data that will be stolen. - Unknown',
  'Convenience is the enemy of security. - Unknown',
  'Encryption works. Properly implemented strong crypto systems are one of the few things that you can rely on. - Edward Snowden',
  'The user\'s going to pick dancing pigs over security every time. - Bruce Schneier',
  'Complexity is the worst enemy of security. - Bruce Schneier',
  'Hardware is easy to protect: lock it in a room. Data is harder to protect. - Bruce Schneier',
  'You can\'t hold firewalls and intrusion detection systems accountable. You can only hold people accountable. - Daryl White',
  'Information security is a marathon, not a sprint. - Unknown',
  'Think before you click. - Unknown',
  'Security is a journey, not a destination. - Unknown',
  'Better safe than sorry when it comes to your digital identity. - Unknown',
  'Strong passwords today prevent breaches tomorrow. - Unknown',
  'Your security posture defines your risk profile. - Unknown',
  'Defense in depth: never rely on a single control. - Unknown',
  'Assume breach and plan accordingly. - Unknown',
  'The best incident response is not needing one. - Unknown',
  'Security awareness is the first line of defense. - Unknown',
];

export function getSecurityQuote(): string {
  const index = Math.floor(Math.random() * SECURITY_QUOTES.length);
  return SECURITY_QUOTES[index];
}

export function getSecurityQuoteByDay(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return SECURITY_QUOTES[dayOfYear % SECURITY_QUOTES.length];
}
