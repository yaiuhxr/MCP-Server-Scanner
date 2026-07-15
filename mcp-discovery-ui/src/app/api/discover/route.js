import { Bonjour } from 'bonjour-service';

export async function GET() {
  try {
    const bonjour = new Bonjour();
    const services = [];

    return new Promise((resolve) => {
      const browser = bonjour.find({ type: 'mcp', protocol: 'tcp' });

      browser.on('up', (service) => {
        if (!services.some(s => s.name === service.name)) {
          const props = {};
          if (service.txt) {
            for (const [key, value] of Object.entries(service.txt)) {
              props[key] = typeof value === 'string' ? value : value.toString('utf8');
            }
          }

          // Sort addresses so IPv4 comes first
          const sortedAddresses = [...(service.addresses || [])].sort((a, b) => {
            const aIsIpv4 = a.includes('.') ? 1 : 0;
            const bIsIpv4 = b.includes('.') ? 1 : 0;
            return bIsIpv4 - aIsIpv4;
          });

          services.push({
            name: service.name,
            host: service.host,
            addresses: sortedAddresses,
            port: service.port,
            type: props.type || 'unknown',
            transport: props.transport || 'streamable-http',
            path: props.path || '/mcp',
            properties: props,
          });
        }
      });

      browser.on('error', (err) => {
        console.error('Browser error:', err);
      });

      setTimeout(() => {
        try {
          browser.stop();
          bonjour.destroy();
        } catch (e) {
          console.error('Error during Bonjour cleanup:', e);
        }
        resolve(Response.json(services, {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          }
        }));
      }, 2000);
    });
  } catch (error) {
    console.error('Failed to initialize Bonjour:', error);
    return Response.json({ error: error.message, services: [] }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
