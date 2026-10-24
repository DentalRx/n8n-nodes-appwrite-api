import type { IDataObject, IHttpRequestOptions, INodeParameters } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import api from './fixtures/appwrite-api.json';
import { BASE_URL, createExecuteContext, node } from './helpers/mock-context';

/** TablesDB settings added in Appwrite 2.6: the optional `description` on databases, tables, indexes and columns. */

const operations = api.operations as Record<string, { body: Record<string, unknown> }>;
const DATABASE = { __rl: true, mode: 'id', value: 'main' };
const TABLE = { __rl: true, mode: 'id', value: 'users' };

async function run(
	parameters: INodeParameters,
	respond: (request: IHttpRequestOptions) => unknown = () => ({}),
) {
	const { context, requests } = createExecuteContext({ parameters, respond });
	await node.execute.call(context);
	return { requests, body: (index = 0) => requests[index].body as IDataObject };
}

describe('TablesDB description', () => {
	it('the spec accepts a description on every endpoint these tests send one to', () => {
		for (const endpoint of [
			'POST /tablesdb',
			'PUT /tablesdb/{databaseId}',
			'POST /tablesdb/{databaseId}/tables',
			'PUT /tablesdb/{databaseId}/tables/{tableId}',
			'POST /tablesdb/{databaseId}/tables/{tableId}/indexes',
			'POST /tablesdb/{databaseId}/tables/{tableId}/columns/string',
			'PATCH /tablesdb/{databaseId}/tables/{tableId}/columns/string/{key}',
			'POST /tablesdb/{databaseId}/tables/{tableId}/columns/relationship',
			'PATCH /tablesdb/{databaseId}/tables/{tableId}/columns/relationship/{key}',
		]) {
			expect(Object.keys(operations[endpoint].body), endpoint).toContain('description');
		}
	});

	describe('Database', () => {
		it('sends the description on create, and leaves it out when empty', async () => {
			const withText = await run({
				resource: 'database',
				operation: 'create',
				name: 'Main',
				description: 'Customer data',
			});
			expect(withText.requests[0].url).toBe(`${BASE_URL}/tablesdb`);
			expect(withText.body().description).toBe('Customer data');

			const without = await run({ resource: 'database', operation: 'create', name: 'Main' });
			expect(without.body()).not.toHaveProperty('description');
		});

		it('keeps the current description on update unless the user sets one', async () => {
			const current = { $id: 'main', name: 'Old', enabled: true, description: 'Kept' };
			const kept = await run(
				{ resource: 'database', operation: 'update', databaseId: DATABASE, name: 'New' },
				() => current,
			);
			expect(kept.requests[1].method).toBe('PUT');
			expect(kept.body(1)).toEqual({ name: 'New', enabled: true, description: 'Kept' });

			const changed = await run(
				{
					resource: 'database',
					operation: 'update',
					databaseId: DATABASE,
					name: 'New',
					updateFields: { description: 'Changed', enabled: false },
				},
				() => current,
			);
			expect(changed.requests).toHaveLength(1);
			expect(changed.body()).toEqual({ name: 'New', enabled: false, description: 'Changed' });

			const cleared = await run(
				{
					resource: 'database',
					operation: 'update',
					databaseId: DATABASE,
					name: 'New',
					updateFields: { description: '', enabled: true },
				},
				() => current,
			);
			expect(cleared.body().description).toBe('');
		});
	});

	describe('Table', () => {
		it('sends the description on create', async () => {
			const { requests, body } = await run({
				resource: 'table',
				operation: 'create',
				databaseId: DATABASE,
				name: 'Users',
				description: 'Who signed up',
			});
			expect(requests[0].url).toBe(`${BASE_URL}/tablesdb/main/tables`);
			expect(body().description).toBe('Who signed up');
		});

		it('keeps the current description on update unless the user sets one', async () => {
			const current = {
				$id: 'users',
				enabled: true,
				rowSecurity: false,
				description: 'Kept',
			};
			const kept = await run(
				{
					resource: 'table',
					operation: 'update',
					databaseId: DATABASE,
					tableId: TABLE,
					name: 'Renamed',
				},
				() => current,
			);
			expect(kept.body(1).description).toBe('Kept');
			expect(kept.body(1).enabled).toBe(true);

			const changed = await run(
				{
					resource: 'table',
					operation: 'update',
					databaseId: DATABASE,
					tableId: TABLE,
					name: 'Renamed',
					updateFields: { description: 'Changed' },
				},
				() => current,
			);
			expect(changed.body(1).description).toBe('Changed');
		});
	});

	describe('Index', () => {
		it('sends the description from Options, and leaves it out when empty', async () => {
			const base = {
				resource: 'index',
				operation: 'create',
				databaseId: DATABASE,
				tableId: TABLE,
				key: 'by_email',
				indexType: 'key',
				columns: 'email',
			};
			const withText = await run({ ...base, options: { description: 'Lookup by email' } });
			expect(withText.body().description).toBe('Lookup by email');

			const without = await run(base);
			expect(without.body()).not.toHaveProperty('description');
		});
	});

	describe('Column', () => {
		const base = { resource: 'column', databaseId: DATABASE, tableId: TABLE, key: 'name' };

		it('sends the description when creating a scalar column', async () => {
			const { requests, body } = await run({
				...base,
				operation: 'create',
				columnType: 'string',
				size: 64,
				options: { description: 'Display name' },
			});
			expect(requests[0].url).toBe(`${BASE_URL}/tablesdb/main/tables/users/columns/string`);
			expect(body().description).toBe('Display name');
		});

		it('sends the description when creating a relationship column', async () => {
			const { body } = await run({
				...base,
				operation: 'create',
				columnType: 'relationship',
				relatedTableId: { __rl: true, mode: 'id', value: 'orders' },
				relationshipType: 'oneToMany',
				options: { description: 'Orders of the user' },
			});
			expect(body().description).toBe('Orders of the user');
		});

		it('keeps the current description when updating a scalar column', async () => {
			const current = { key: 'name', required: false, default: null, description: 'Kept' };
			const kept = await run(
				{ ...base, operation: 'update', columnType: 'string', options: { newKey: 'title' } },
				() => current,
			);
			expect(kept.requests[1].method).toBe('PATCH');
			expect(kept.body(1).description).toBe('Kept');

			const changed = await run(
				{
					...base,
					operation: 'update',
					columnType: 'string',
					options: { description: 'Changed' },
				},
				() => current,
			);
			expect(changed.body(1).description).toBe('Changed');
		});

		it('sends a relationship column description on update only when the user sets one', async () => {
			const params = { ...base, operation: 'update', columnType: 'relationship' };
			const kept = await run({ ...params, options: { onDelete: 'cascade' } });
			expect(kept.body()).not.toHaveProperty('description');

			const changed = await run({ ...params, options: { description: 'Changed' } });
			expect(changed.body().description).toBe('Changed');
		});
	});
});
