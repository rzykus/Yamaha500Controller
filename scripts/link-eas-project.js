const fs = require('fs');
const path = require('path');

const SLUG = 'yamaha500-controller';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

function updatesUrl(projectId) {
  return new URL(projectId, 'https://u.expo.dev').href;
}

function findProjects(accounts, slug) {
  const matches = [];
  for (const account of accounts || []) {
    for (const app of account.apps || []) {
      if (app.slug === slug) {
        matches.push({
          id: app.id,
          slug: app.slug,
          accountName: account.name,
        });
      }
    }
  }
  return matches;
}

function applyProject(config, project) {
  const expo = config.expo;
  const url = updatesUrl(project.id);
  const currentId = expo.extra?.eas?.projectId;
  const currentUrl = expo.updates?.url;
  if (currentId === project.id && currentUrl === url) {
    return false;
  }
  if (currentId && currentId !== project.id) {
    throw new Error(
      `app.json extra.eas.projectId (${currentId}) nesutampa su Expo projektu @${project.accountName}/${project.slug} (${project.id}).`
    );
  }
  expo.updates = { ...expo.updates, url };
  expo.extra = { ...expo.extra, eas: { ...expo.extra?.eas, projectId: project.id } };
  return true;
}

async function graphql(token, query, variables) {
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.errors) {
    const message = body?.errors?.map((error) => error.message).join('; ');
    throw new Error(
      message || `Expo API atsakė ${response.status}. Patikrinkite, ar EXPO_TOKEN galioja.`
    );
  }
  return body.data;
}

async function loadAccounts(token) {
  const accountsById = new Map();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await graphql(
      token,
      `query MeApps($offset: Int!, $limit: Int!) {
        meActor {
          accounts {
            id
            name
            apps(offset: $offset, limit: $limit) {
              id
              slug
            }
          }
        }
      }`,
      { offset: page * PAGE_SIZE, limit: PAGE_SIZE }
    );
    const actor = data.meActor;
    if (!actor) {
      throw new Error(
        'EXPO_TOKEN nepriimtas. Sukurkite naują Expo access token ir įrašykite jį kaip GitHub secret EXPO_TOKEN.'
      );
    }
    let fullPage = false;
    for (const account of actor.accounts || []) {
      const known = accountsById.get(account.id) || {
        id: account.id,
        name: account.name,
        apps: [],
      };
      known.apps.push(...(account.apps || []));
      accountsById.set(account.id, known);
      if ((account.apps || []).length === PAGE_SIZE) {
        fullPage = true;
      }
    }
    if (!fullPage) {
      return [...accountsById.values()];
    }
  }
  throw new Error('Expo paskyroje per daug projektų, todėl yamaha500-controller nepavyko vienareikšmiškai rasti.');
}

async function main() {
  const token = process.env.EXPO_TOKEN;
  if (!token) {
    throw new Error(
      'Trūksta EXPO_TOKEN. Sukurkite Expo access token (expo.dev → Account settings → Access tokens) ir įrašykite jį kaip GitHub repository secret EXPO_TOKEN.'
    );
  }

  const appJsonPath = path.join(process.cwd(), 'app.json');
  const config = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const accounts = await loadAccounts(token);
  const matches = findProjects(accounts, SLUG);
  if (matches.length === 0) {
    const names = accounts.map((account) => account.name).join(', ') || '(nėra paskyrų)';
    throw new Error(
      `EXPO_TOKEN paskyrose nėra Expo projekto su slug „${SLUG}“. Matomos paskyros: ${names}.`
    );
  }
  if (matches.length > 1) {
    const list = matches
      .map((project) => `@${project.accountName}/${project.slug} (${project.id})`)
      .join(', ');
    throw new Error(`Rasti keli projektai „${SLUG}“: ${list}.`);
  }

  const changed = applyProject(config, matches[0]);
  if (changed) {
    fs.writeFileSync(appJsonPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(
      `Susieta su Expo projektu @${matches[0].accountName}/${matches[0].slug} (${matches[0].id}).`
    );
  } else {
    console.log(`app.json jau nurodo Expo projektą ${matches[0].id}.`);
  }
}

module.exports = { findProjects, applyProject, updatesUrl };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
