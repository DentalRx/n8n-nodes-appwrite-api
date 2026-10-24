import type { IDataObject, INodeParameters } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { BASE_URL, createExecuteContext, node } from './helpers/mock-context';

/**
 * Settings Appwrite 2.6 added to functions, sites, their variables, project
 * variables, webhooks and API keys: a description on each, plus a schedule
 * interval and email triggering on functions.
 */

async function run(parameters: INodeParameters, respond: (index: number) => unknown = () => ({})) {
	let call = 0;
	const { context, requests } = createExecuteContext({
		parameters,
		respond: () => respond(call++),
	});
	await node.execute.call(context);
	return { requests, body: (index = 0) => requests[index].body as IDataObject };
}

const locator = (value: string) => ({ __rl: true, mode: 'id', value });

const FUNCTION = {
	$id: 'f1',
	name: 'Sync',
	runtime: 'node-22',
	schedule: '0 * * * *',
	description: 'Hourly sync',
	emailEnabled: true,
	interval: 0,
};

describe('Function → description, interval and email triggering', () => {
	it('sends a description on create, and the interval when set', async () => {
		const { body } = await run({
			resource: 'function',
			operation: 'create',
			name: 'Sync',
			runtime: 'node-22',
			functionId: 'f1',
			options: { description: 'Hourly sync', interval: 30 },
		});
		expect(body()).toMatchObject({ description: 'Hourly sync', interval: 30, schedule: '' });
		expect(body()).not.toHaveProperty('emailEnabled');
	});

	it('offers email triggering on update only', () => {
		const optionsFor = (operation: string) =>
			node.description.properties
				.filter(
					(property) =>
						property.name === 'options' &&
						(property.displayOptions?.show?.resource as string[] | undefined)?.includes(
							'function',
						) &&
						(property.displayOptions?.show?.operation as string[] | undefined)?.includes(operation),
				)
				.flatMap((property) => (property.options ?? []) as Array<{ name: string }>)
				.map((option) => option.name);
		expect(optionsFor('create')).toContain('description');
		expect(optionsFor('create')).not.toContain('emailEnabled');
		expect(optionsFor('update')).toEqual(expect.arrayContaining(['description', 'emailEnabled']));
	});

	it('resends the current description and email setting on update, and leaves the interval out', async () => {
		const { body } = await run(
			{ resource: 'function', operation: 'update', functionId: locator('f1'), name: 'Renamed' },
			() => FUNCTION,
		);
		expect(body(1)).toMatchObject({
			description: 'Hourly sync',
			emailEnabled: true,
			schedule: '0 * * * *',
		});
		expect(body(1)).not.toHaveProperty('interval');
	});

	it('replaces the schedule when only an interval is set, and the interval when a schedule is', async () => {
		const interval = await run(
			{
				resource: 'function',
				operation: 'update',
				functionId: locator('f1'),
				name: 'Sync',
				options: { interval: 15, emailEnabled: false, description: 'New' },
			},
			() => FUNCTION,
		);
		expect(interval.body(1)).toMatchObject({
			interval: 15,
			schedule: '',
			emailEnabled: false,
			description: 'New',
		});

		const schedule = await run(
			{
				resource: 'function',
				operation: 'update',
				functionId: locator('f1'),
				name: 'Sync',
				options: { schedule: '*/5 * * * *' },
			},
			() => FUNCTION,
		);
		expect(schedule.body(1)).toMatchObject({ schedule: '*/5 * * * *' });
		expect(schedule.body(1)).not.toHaveProperty('interval');
	});
});

describe('Site → description', () => {
	it('sends it on create and keeps the current one on update', async () => {
		const created = await run({
			resource: 'site',
			operation: 'create',
			name: 'Shop',
			siteId: 'shop',
			siteFramework: 'nextjs',
			buildRuntime: 'node-22',
			options: { description: 'Storefront' },
		});
		expect(created.body().description).toBe('Storefront');

		const kept = await run(
			{ resource: 'site', operation: 'update', siteId: locator('shop'), name: 'Shop' },
			() => ({ $id: 'shop', name: 'Shop', framework: 'nextjs', description: 'Storefront' }),
		);
		expect(kept.body(1).description).toBe('Storefront');

		const changed = await run(
			{
				resource: 'site',
				operation: 'update',
				siteId: locator('shop'),
				name: 'Shop',
				options: { description: 'New' },
			},
			() => ({ $id: 'shop', name: 'Shop', framework: 'nextjs', description: 'Storefront' }),
		);
		expect(changed.body(1).description).toBe('New');
	});
});

describe.each([
	['function', 'functions', 'functionId'],
	['site', 'sites', 'siteId'],
])('%s variables → description', (resource, path, idParameter) => {
	it('sends it on create and update, leaving it out when blank', async () => {
		const created = await run({
			resource,
			operation: 'createVariable',
			[idParameter]: locator('r1'),
			key: 'API_URL',
			value: 'x',
			description: 'Base URL',
		});
		expect(created.requests[0].url).toBe(`${BASE_URL}/${path}/r1/variables`);
		expect(created.body().description).toBe('Base URL');

		const blank = await run({
			resource,
			operation: 'createVariable',
			[idParameter]: locator('r1'),
			key: 'API_URL',
			value: 'x',
		});
		expect(blank.body()).not.toHaveProperty('description');

		const updated = await run({
			resource,
			operation: 'updateVariable',
			[idParameter]: locator('r1'),
			variableId: 'v1',
			description: 'New',
		});
		expect(updated.requests[0].method).toBe('PUT');
		expect(updated.body().description).toBe('New');

		const untouched = await run({
			resource,
			operation: 'updateVariable',
			[idParameter]: locator('r1'),
			variableId: 'v1',
			key: 'RENAMED',
		});
		expect(untouched.body()).not.toHaveProperty('description');
	});
});

describe('Project variable → description', () => {
	it('sends it on create and update', async () => {
		const created = await run({
			resource: 'projectVariable',
			operation: 'create',
			key: 'K',
			value: 'v',
			description: 'Why',
		});
		expect(created.body().description).toBe('Why');

		const updated = await run({
			resource: 'projectVariable',
			operation: 'update',
			variableId: 'v1',
			updateFields: { description: 'Because' },
		});
		expect(updated.body()).toEqual({ description: 'Because' });
	});
});

describe('Webhook → description', () => {
	const CURRENT = {
		name: 'Hook',
		url: 'https://example.com',
		events: ['users.*.create'],
		enabled: true,
		tls: true,
		description: 'Orders',
	};

	it('sends it on create', async () => {
		const { body } = await run({
			resource: 'webhook',
			operation: 'create',
			name: 'Hook',
			url: 'https://example.com',
			webhookEvents: 'users.*.create',
			options: { description: 'Orders' },
		});
		expect(body().description).toBe('Orders');
	});

	it('keeps the current description on update unless changed', async () => {
		const kept = await run(
			{ resource: 'webhook', operation: 'update', webhookId: locator('w1'), updateFields: {} },
			() => CURRENT,
		);
		expect(kept.body(1).description).toBe('Orders');

		const changed = await run(
			{
				resource: 'webhook',
				operation: 'update',
				webhookId: locator('w1'),
				updateFields: { description: 'Billing' },
			},
			() => CURRENT,
		);
		expect(changed.body(1).description).toBe('Billing');
	});
});

describe.each([
	[
		'API key',
		{ resource: 'apiKey', operation: 'update', apiKeyId: locator('k1') },
		`${BASE_URL}/project/keys/k1`,
	],
	[
		'organization project key',
		{
			resource: 'organizationProject',
			operation: 'updateKey',
			organizationProjectId: locator('shop'),
			organizationProjectKeyId: locator('k1'),
		},
		`${BASE_URL}/organization/projects/shop/keys/k1`,
	],
])('%s → description', (_name, parameters, url) => {
	const CURRENT = {
		$id: 'k1',
		name: 'Old',
		scopes: ['users.read'],
		expire: null,
		description: 'CI',
	};

	it('resends the current description and replaces it when changed', async () => {
		const kept = await run({ ...parameters, updateFields: { name: 'Renamed' } }, () => CURRENT);
		expect(kept.requests[1].url).toBe(url);
		expect(kept.body(1).description).toBe('CI');

		const changed = await run(
			{ ...parameters, updateFields: { description: 'Deploys' } },
			() => CURRENT,
		);
		expect(changed.body(1).description).toBe('Deploys');
	});
});
