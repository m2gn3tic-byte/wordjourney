import { existsSync } from 'node:fs';
// Java does not inherit HTTP(S)_PROXY automatically. Only use the host/port;
// authentication values remain with the platform proxy and are never printed.
const value = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (value) {
  const proxy = new URL(value);
  if (['http:', 'https:'].includes(proxy.protocol)) for (const protocol of ['http', 'https']) {
    console.log(`-D${protocol}.proxyHost=${proxy.hostname}`);
    console.log(`-D${protocol}.proxyPort=${proxy.port || (proxy.protocol === 'https:' ? '443' : '80')}`);
  }
}
if(existsSync('/etc/ssl/certs/java/cacerts')) console.log('-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts');
