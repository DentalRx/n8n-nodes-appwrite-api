import type { IDataObject, INodeParameters } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { createExecuteContext, node } from './helpers/mock-context';

/** Settings the Appwrite 2.6 spec added to indexes, topics, and buckets. */

async function run(parameters: INodeParameters, respond = () => ({ $id: 'x' }) as IDataObject) {
	const { context, requests } = createExecuteContext({ parameters, respond });
	await node.execute.call(context);
	return { requests, body: (index = 0) => requests[index].body as IDataObject };
}

describe('Index › trigram', () => {
	it('creates a trigram index', async () => {
		const { body } = await run({
			resource: 'index',
			operation: 'create',
			databaseId: 'db',
			tableId: 'tbl',
			key: 'by_name',
			indexType: 'trigram',
			columns: 'name',
		});
		expect(body().type).toBe('trigram');
	});
});

describe('Topic › description', () => {
	it('sends a description on create only when given', async () => {
		const given = await run({
			resource: 'topic',
			operation: 'create',
			name: 'News',
			description: 'Weekly news',
		});
		expect(given.body().description).toBe('Weekly news');

		const without = await run({ resource: 'topic', operation: 'create', name: 'News' });
		expect(without.body().description).toBeUndefined();
	});

	it('sends a description on update', async () => {
		const { body } = await run({
			resource: 'topic',
			operation: 'update',
			topicId: { __rl: true, mode: 'id', value: 't1' },
			updateFields: { description: 'New' },
		});
		expect(body().description).toBe('New');
	});
});

describe('Bucket › description and strip metadata', () => {
	const current = {
		$id: 'b1',
		name: 'Files',
		description: 'Old description',
		stripMetadata: true,
		enabled: true,
	};

	it('sends both on create', async () => {
		const { body } = await run({
			resource: 'bucket',
			operation: 'create',
			name: 'Files',
			options: { description: 'Docs', stripMetadata: true },
		});
		expect(body().description).toBe('Docs');
		expect(body().stripMetadata).toBe(true);
	});

	it('resends the current values on update when the user did not change them', async () => {
		const { requests, body } = await run(
			{
				resource: 'bucket',
				operation: 'update',
				bucketId: { __rl: true, mode: 'id', value: 'b1' },
				name: 'Renamed',
				options: {},
			},
			() => current,
		);
		expect(requests[1].method).toBe('PUT');
		expect(body(1).description).toBe('Old description');
		expect(body(1).stripMetadata).toBe(true);
	});

	it('lets the user change them on update', async () => {
		const { body } = await run(
			{
				resource: 'bucket',
				operation: 'update',
				bucketId: { __rl: true, mode: 'id', value: 'b1' },
				name: 'Files',
				options: { description: 'New', stripMetadata: false },
			},
			() => current,
		);
		expect(body(1).description).toBe('New');
		expect(body(1).stripMetadata).toBe(false);
	});
});
