export const DEFAULT_IP = '192.168.68.65';

export const ERROR_MESSAGE =
  'Check Wi-Fi, IP, and Local Network permission for Expo Go.';

export const INPUTS = [
  { label: 'CD', value: 'CD' },
  { label: 'PHONO', value: 'PHONO' },
  { label: 'TUNER', value: 'TUNER' },
  { label: 'USB', value: 'USB' },
  { label: 'NET RADIO', value: 'NET RADIO' },
  { label: 'SERVER', value: 'SERVER' },
  { label: 'LINE1', value: 'LINE1' },
  { label: 'LINE2', value: 'LINE2' },
  { label: 'LINE3', value: 'LINE3' },
  { label: 'COAX1', value: 'COAXIAL1' },
  { label: 'COAX2', value: 'COAXIAL2' },
  { label: 'OPT1', value: 'OPTICAL1' },
  { label: 'OPT2', value: 'OPTICAL2' },
];

const GET_STATUS =
  '<YAMAHA_AV cmd="GET"><Main_Zone><Basic_Status>GetParam</Basic_Status></Main_Zone></YAMAHA_AV>';

function powerBody(value) {
  return `<YAMAHA_AV cmd="PUT"><Main_Zone><Power_Control><Power>${value}</Power></Power_Control></Main_Zone></YAMAHA_AV>`;
}

function volumeBody(direction) {
  return `<YAMAHA_AV cmd="PUT"><Main_Zone><Volume><Lvl><Val>${direction}</Val><Exp></Exp><Unit></Unit></Lvl></Volume></Main_Zone></YAMAHA_AV>`;
}

function muteBody(value) {
  return `<YAMAHA_AV cmd="PUT"><Main_Zone><Volume><Mute>${value}</Mute></Volume></Main_Zone></YAMAHA_AV>`;
}

function inputBody(input) {
  return `<YAMAHA_AV cmd="PUT"><Main_Zone><Input><Input_Sel>${input}</Input_Sel></Input></Main_Zone></YAMAHA_AV>`;
}

function firstTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match ? match[1].trim() : null;
}

export function parseStatus(xml) {
  const power = firstTag(xml, 'Power');
  const mute = firstTag(xml, 'Mute');
  const input = firstTag(xml, 'Input_Sel');
  const val = firstTag(xml, 'Val');
  const parsedVal = val == null || val === '' ? NaN : Number(val);
  const volumeDb = Number.isFinite(parsedVal) ? parsedVal / 10 : null;

  return {
    power: power || '—',
    mute: mute || '—',
    input: input || '—',
    volumeDb,
  };
}

export function formatVolume(volumeDb) {
  if (volumeDb == null || !Number.isFinite(volumeDb)) {
    return '—';
  }
  return `${volumeDb.toFixed(1)} dB`;
}

export function formatInput(input) {
  const match = INPUTS.find((item) => item.value === input);
  return match ? match.label : input || '—';
}

async function postXml(ip, xml) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`http://${ip}/YamahaRemoteControl/ctrl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
      },
      body: xml,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Request failed');
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function getStatus(ip) {
  const xml = await postXml(ip, GET_STATUS);
  return parseStatus(xml);
}

export async function setPower(ip, value) {
  await postXml(ip, powerBody(value));
  return getStatus(ip);
}

export async function setVolume(ip, direction) {
  await postXml(ip, volumeBody(direction));
  return getStatus(ip);
}

export async function nudgeVolume(ip, direction) {
  await postXml(ip, volumeBody(direction));
}

export async function setMute(ip, value) {
  await postXml(ip, muteBody(value));
  return getStatus(ip);
}

export async function setInput(ip, input) {
  await postXml(ip, inputBody(input));
  return getStatus(ip);
}
