const assert = require('node:assert/strict');
const test = require('node:test');
const { findProjects, loadAccounts, PAGE_SIZE, MAX_PAGES } = require('./link-eas-project');

test('Expo apps limit stays within the API maximum of 50', () => {
  assert.equal(PAGE_SIZE, 50);
  assert.ok(PAGE_SIZE <= 50);
  assert.ok(MAX_PAGES >= 1);
});

test('loadAccounts pages with limit 50 and keeps a project past the first page', async () => {
  const calls = [];
  const accounts = await loadAccounts('test-token', async (_token, _query, variables) => {
    calls.push(variables);
    assert.ok(variables.limit <= 50);
    const count = variables.offset === 0 ? PAGE_SIZE : 1;
    const apps = Array.from({ length: count }, (_, index) => {
      const idNumber = variables.offset + index;
      return {
        id: `id-${idNumber}`,
        slug: idNumber === PAGE_SIZE ? 'yamaha500-controller' : `other-${idNumber}`,
      };
    });
    return {
      meActor: {
        accounts: [{ id: 'acc', name: 'home', apps }],
      },
    };
  });

  assert.deepEqual(
    calls.map((call) => call.limit),
    [50, 50]
  );
  assert.deepEqual(
    calls.map((call) => call.offset),
    [0, 50]
  );
  const matches = findProjects(accounts, 'yamaha500-controller');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'id-50');
  assert.equal(matches[0].accountName, 'home');
  assert.equal(accounts[0].apps.length, 51);
});

test('loadAccounts stops when a page is shorter than 50', async () => {
  const calls = [];
  await loadAccounts('test-token', async (_token, _query, variables) => {
    calls.push(variables);
    return {
      meActor: {
        accounts: [
          {
            id: 'acc',
            name: 'home',
            apps: [{ id: 'only', slug: 'yamaha500-controller' }],
          },
        ],
      },
    };
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].limit, 50);
  assert.equal(calls[0].offset, 0);
});
