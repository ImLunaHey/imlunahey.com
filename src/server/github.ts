export function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'imlunahey.com',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
