// Installed AnimePlex clients sync CloudStream selections using repo.json URLs.
const cncBuilds = 'https://raw.githubusercontent.com/Abhishekred/CNCVerse-Cloud-Stream-Extension/';
const cncManifest = cncBuilds + 'refs/heads/builds/repo.json';

export function managedManifestUrl(value) {
  const url = String(value ?? '').trim();
  if (url === cncBuilds + 'refs/heads/builds/CNC.json' ||
      url === cncBuilds + 'builds/CNC.json' ||
      url === cncBuilds + 'builds/repo.json') return cncManifest;
  return url;
}
