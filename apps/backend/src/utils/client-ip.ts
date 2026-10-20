import net from 'node:net';
import type { NextFunction, Request, Response } from 'express';

/**
 * The visitor's real address.
 *
 * Behind Cloudflare, `req.ip` is a Cloudflare edge server, not the visitor —
 * every IP in the log was one (104.22–23.x, 172.64–71.x, 162.158–159.x…). So
 * the log could not tell two visitors apart, and every rate limit was shared
 * by everyone routed through the same edge: one bot trying passwords used up
 * the login allowance of every real user in Beirut.
 *
 * Cloudflare puts the visitor's address in `CF-Connecting-IP`. That header is
 * believed ONLY when the request really came from a Cloudflare address — a
 * request sent straight to the server (which is possible while the origin IP
 * is public) could set the header to anything it likes.
 *
 * Ranges from https://www.cloudflare.com/ips/ — they change rarely; update here.
 */
const CLOUDFLARE = new net.BlockList();
for (const range of [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
]) {
  const [address, prefix] = range.split('/');
  CLOUDFLARE.addSubnet(address, Number(prefix), 'ipv4');
}
for (const range of ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32']) {
  const [address, prefix] = range.split('/');
  CLOUDFLARE.addSubnet(address, Number(prefix), 'ipv6');
}

function fromCloudflare(ip: string): boolean {
  const plain = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const type = net.isIP(plain);
  return type !== 0 && CLOUDFLARE.check(plain, type === 4 ? 'ipv4' : 'ipv6');
}

/** Replace `req.ip` with the visitor's address, for the log and every rate limit after this. */
export function realClientIp(req: Request, _res: Response, next: NextFunction): void {
  const peer = req.ip;
  const visitor = req.get('cf-connecting-ip')?.trim();
  if (peer && visitor && net.isIP(visitor) && fromCloudflare(peer)) {
    Object.defineProperty(req, 'ip', { value: visitor, configurable: true, enumerable: true });
  }
  next();
}
