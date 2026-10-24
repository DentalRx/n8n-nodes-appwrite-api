// A minimal stand-in for the Appwrite API, for trying the node in a real n8n.
// Logs every request as a JSON line to $MOCK_LOG (default /tmp/mock-requests.log)
// and answers with a small JSON body. Listens on port 4010.
// Usage: node scripts/mock-appwrite.mjs
import http from 'node:http';
import fs from 'node:fs';
http
	.createServer((req, res) => {
		let b = '';
		req.on('data', (c) => (b += c));
		req.on('end', () => {
			fs.appendFileSync(
				process.env.MOCK_LOG ?? '/tmp/mock-requests.log',
				JSON.stringify({ method: req.method, url: req.url, body: b ? JSON.parse(b) : null }) + '\n',
			);
			res.setHeader('content-type', 'application/json');
			if (req.method === 'GET' && req.url.startsWith('/v1/project/platforms/p1'))
				return res.end(
					JSON.stringify({
						$id: 'p1',
						type: 'android',
						name: 'Old',
						applicationId: 'com.old',
						fingerprints: ['AA:BB'],
					}),
				);
			res.end(JSON.stringify({ $id: 'x', ok: true }));
		});
	})
	.listen(4010);
