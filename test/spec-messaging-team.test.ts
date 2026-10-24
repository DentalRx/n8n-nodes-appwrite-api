import type { IDataObject, INodeParameters } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { BASE_URL, createExecuteContext, node } from './helpers/mock-context';

/** Settings the Appwrite 2.6 spec added to messages, team memberships, sessions, and restorations. */

async function run(parameters: INodeParameters, respond = () => ({ $id: 'x' }) as IDataObject) {
	const { context, requests } = createExecuteContext({ parameters, respond });
	const [output] = await node.execute.call(context);
	return { output, requests, body: (index = 0) => requests[index].body as IDataObject };
}

describe('Message › emails and channel ID', () => {
	it('sends emails as an array when creating an email, and counts them as recipients', async () => {
		const { body } = await run({
			resource: 'message',
			operation: 'createEmail',
			messageId: 'm1',
			subject: 'Hi',
			content: 'Hello',
			options: { emails: 'a@example.com, b@example.com' },
		});
		expect(body().emails).toEqual(['a@example.com', 'b@example.com']);
	});

	it('still requires some recipient for a non-draft email', async () => {
		const { context, requests } = createExecuteContext({
			parameters: {
				resource: 'message',
				operation: 'createEmail',
				subject: 'Hi',
				content: 'Hello',
				options: {},
			},
		});
		await expect(node.execute.call(context)).rejects.toThrow(NodeOperationError);
		expect(requests).toHaveLength(0);
	});

	it('leaves emails out unless added, and sends them on update', async () => {
		const without = await run({
			resource: 'message',
			operation: 'updateEmail',
			messageId: 'm1',
			updateFields: { subject: 'New' },
		});
		expect(without.body()).not.toHaveProperty('emails');

		const withEmails = await run({
			resource: 'message',
			operation: 'updateEmail',
			messageId: 'm1',
			updateFields: { emails: '["a@example.com"]' },
		});
		expect(withEmails.body().emails).toEqual(['a@example.com']);
	});

	it('sends the channel ID of a push notification on create and update', async () => {
		const created = await run({
			resource: 'message',
			operation: 'createPush',
			messageId: 'm1',
			title: 'T',
			body: 'B',
			users: 'u1',
			options: { channelId: 'alerts' },
		});
		expect(created.body().channelId).toBe('alerts');

		const updated = await run({
			resource: 'message',
			operation: 'updatePush',
			messageId: 'm1',
			updateFields: { channelId: 'news' },
		});
		expect(updated.body().channelId).toBe('news');
		expect(updated.requests[0].url).toBe(`${BASE_URL}/messaging/messages/push/m1`);

		const omitted = await run({
			resource: 'message',
			operation: 'updatePush',
			messageId: 'm1',
			updateFields: { title: 'Only title' },
		});
		expect(omitted.body()).not.toHaveProperty('channelId');
	});
});

describe('Team › custom membership ID', () => {
	const create = (options: INodeParameters) =>
		run({
			resource: 'team',
			operation: 'createMembership',
			teamId: { __rl: true, mode: 'id', value: 't1' },
			roles: 'member',
			email: 'a@example.com',
			options,
		});

	it('sends the membership ID the user chose', async () => {
		const { body, requests } = await create({ membershipId: 'my-membership' });
		expect(requests[0].url).toBe(`${BASE_URL}/teams/t1/memberships`);
		expect(body().membershipId).toBe('my-membership');
	});

	it('generates an ID for unique() and sends none when left out', async () => {
		const generated = await create({ membershipId: 'unique()' });
		expect(generated.body().membershipId).toMatch(/^[a-zA-Z0-9]+$/);
		expect(generated.body().membershipId).not.toBe('unique()');

		const omitted = await create({});
		expect(omitted.body()).not.toHaveProperty('membershipId');
	});
});

describe('Account › email session duration', () => {
	const createSession = (options: INodeParameters) =>
		run({
			resource: 'account',
			operation: 'createEmailPasswordSession',
			email: 'a@example.com',
			password: 'password-1234',
			options,
		});

	it('sends the session duration when added', async () => {
		const { body, requests } = await createSession({ duration: 3600 });
		expect(requests[0].url).toBe(`${BASE_URL}/account/sessions/email`);
		expect(body()).toEqual({
			email: 'a@example.com',
			password: 'password-1234',
			duration: 3600,
		});
	});

	it('leaves it out so the project maximum applies', async () => {
		const { body } = await createSession({});
		expect(body()).not.toHaveProperty('duration');
	});
});

describe('Dedicated Database › restoration options', () => {
	it.each([
		['mongodb', '/mongo'],
		['mysql', '/mysql'],
		['postgresql', '/postgresql'],
	])(
		'sends the restore mode, target name, and auto-promote on %s',
		async (databaseEngine, prefix) => {
			const { body, requests } = await run({
				resource: 'dedicatedDatabase',
				operation: 'restore',
				databaseEngine,
				dedicatedDatabaseId: 'orders',
				restorationType: 'pitr',
				restorationTargetTime: '2026-09-01T12:00:00.000Z',
				options: { restoreMode: 'clone', targetName: 'Orders copy', autoPromote: false },
			});
			expect(requests[0].url).toBe(`${BASE_URL}${prefix}/orders/restorations`);
			expect(body()).toEqual({
				type: 'pitr',
				targetTime: '2026-09-01T12:00:00.000Z',
				restoreMode: 'clone',
				targetName: 'Orders copy',
				autoPromote: false,
			});
		},
	);
});
