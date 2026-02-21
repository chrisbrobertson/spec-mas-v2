import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(rootDir, 'public');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const state = {
  rooms: [],
  equipment: [],
  schedules: [],
  nextResourceId: 1,
  nextScheduleId: 1
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error('invalid_json');
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createResource(type, body) {
  const name = normalizeText(body.name);
  if (!name) {
    return { error: 'Name is required.' };
  }

  const collection = type === 'room' ? state.rooms : state.equipment;
  const exists = collection.some((item) => item.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return { error: `${type === 'room' ? 'Room' : 'Equipment'} already exists.` };
  }

  const resource = {
    id: state.nextResourceId++,
    type,
    name
  };
  collection.push(resource);
  return { resource };
}

function hasOverlap(resourceId, startTime, endTime) {
  return state.schedules.some((entry) => {
    if (entry.resourceId !== resourceId) {
      return false;
    }

    return startTime < entry.endMs && endTime > entry.startMs;
  });
}

function createSchedule(body) {
  const resourceType = normalizeText(body.resourceType);
  const title = normalizeText(body.title);
  const startTime = normalizeText(body.startTime);
  const endTime = normalizeText(body.endTime);
  const resourceId = Number(body.resourceId);

  if (!['room', 'equipment'].includes(resourceType)) {
    return { error: 'resourceType must be room or equipment.' };
  }

  if (!Number.isInteger(resourceId) || resourceId <= 0) {
    return { error: 'resourceId must be a positive integer.' };
  }

  if (!title) {
    return { error: 'title is required.' };
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: 'startTime and endTime must be valid dates.' };
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (endMs <= startMs) {
    return { error: 'endTime must be after startTime.' };
  }

  const resources = resourceType === 'room' ? state.rooms : state.equipment;
  const resource = resources.find((item) => item.id === resourceId);
  if (!resource) {
    return { error: 'resource does not exist.' };
  }

  if (hasOverlap(resourceId, startMs, endMs)) {
    return { error: 'schedule overlaps with an existing entry.' };
  }

  const schedule = {
    id: state.nextScheduleId++,
    resourceType,
    resourceId,
    resourceName: resource.name,
    title,
    startTime,
    endTime,
    startMs,
    endMs
  };

  state.schedules.push(schedule);
  state.schedules.sort((a, b) => a.startMs - b.startMs);
  return { schedule };
}

function removeSchedule(id) {
  const index = state.schedules.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return false;
  }

  state.schedules.splice(index, 1);
  return true;
}

function toClientSchedule(entry) {
  return {
    id: entry.id,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    resourceName: entry.resourceName,
    title: entry.title,
    startTime: entry.startTime,
    endTime: entry.endTime
  };
}

async function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const normalized = normalize(relativePath).replace(/^([.]{2}[\\/])+/, '');
  const filePath = join(publicDir, normalized);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const content = await readFile(filePath);
    const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': contentType });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

function makeHandler() {
  return async (req, res) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    const { pathname } = requestUrl;

    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/resources' && req.method === 'GET') {
      sendJson(res, 200, { rooms: state.rooms, equipment: state.equipment });
      return;
    }

    if (pathname === '/api/rooms' && req.method === 'POST') {
      try {
        const result = createResource('room', await readJson(req));
        if (result.error) {
          sendJson(res, 400, { error: result.error });
          return;
        }
        sendJson(res, 201, result.resource);
      } catch (error) {
        if (error.message === 'invalid_json') {
          sendJson(res, 400, { error: 'Body must be valid JSON.' });
          return;
        }
        sendJson(res, 500, { error: 'Unexpected server error.' });
      }
      return;
    }

    if (pathname === '/api/equipment' && req.method === 'POST') {
      try {
        const result = createResource('equipment', await readJson(req));
        if (result.error) {
          sendJson(res, 400, { error: result.error });
          return;
        }
        sendJson(res, 201, result.resource);
      } catch (error) {
        if (error.message === 'invalid_json') {
          sendJson(res, 400, { error: 'Body must be valid JSON.' });
          return;
        }
        sendJson(res, 500, { error: 'Unexpected server error.' });
      }
      return;
    }

    if (pathname === '/api/schedules' && req.method === 'GET') {
      sendJson(res, 200, { schedules: state.schedules.map(toClientSchedule) });
      return;
    }

    if (pathname === '/api/schedules' && req.method === 'POST') {
      try {
        const result = createSchedule(await readJson(req));
        if (result.error) {
          sendJson(res, 400, { error: result.error });
          return;
        }
        sendJson(res, 201, toClientSchedule(result.schedule));
      } catch (error) {
        if (error.message === 'invalid_json') {
          sendJson(res, 400, { error: 'Body must be valid JSON.' });
          return;
        }
        sendJson(res, 500, { error: 'Unexpected server error.' });
      }
      return;
    }

    if (pathname.startsWith('/api/schedules/') && req.method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: 'Invalid schedule id.' });
        return;
      }

      if (!removeSchedule(id)) {
        sendJson(res, 404, { error: 'Schedule not found.' });
        return;
      }

      sendJson(res, 204, {});
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'API route not found.' });
      return;
    }

    await serveStatic(req, res, pathname);
  };
}

export function resetState() {
  state.rooms = [];
  state.equipment = [];
  state.schedules = [];
  state.nextResourceId = 1;
  state.nextScheduleId = 1;
}

export function startServer(port = Number(process.env.PORT) || 3000) {
  const server = createServer(makeHandler());
  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  startServer(port).then(() => {
    // eslint-disable-next-line no-console
    console.log(`Resource schedule app running at http://localhost:${port}`);
  });
}
