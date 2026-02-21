import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

import { resetState, startServer } from '../server.mjs';

let server;
let baseUrl;

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = {};

  if (text) {
    body = JSON.parse(text);
  }

  return { status: response.status, body };
}

test.before(async () => {
  resetState();
  server = await startServer(0);
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  server.close();
  await once(server, 'close');
});

test('happy path: can add room/equipment and schedule each resource type', async () => {
  resetState();

  const roomRes = await jsonRequest('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A-101' })
  });
  assert.equal(roomRes.status, 201);
  assert.equal(roomRes.body.name, 'A-101');

  const equipmentRes = await jsonRequest('/api/equipment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Projector 1' })
  });
  assert.equal(equipmentRes.status, 201);
  assert.equal(equipmentRes.body.name, 'Projector 1');

  const roomScheduleRes = await jsonRequest('/api/schedules', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resourceType: 'room',
      resourceId: roomRes.body.id,
      title: 'Design Review',
      startTime: '2026-02-21T09:00:00.000Z',
      endTime: '2026-02-21T10:00:00.000Z'
    })
  });
  assert.equal(roomScheduleRes.status, 201);
  assert.equal(roomScheduleRes.body.resourceName, 'A-101');

  const equipmentScheduleRes = await jsonRequest('/api/schedules', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resourceType: 'equipment',
      resourceId: equipmentRes.body.id,
      title: 'Client Demo',
      startTime: '2026-02-21T09:30:00.000Z',
      endTime: '2026-02-21T11:00:00.000Z'
    })
  });
  assert.equal(equipmentScheduleRes.status, 201);
  assert.equal(equipmentScheduleRes.body.resourceType, 'equipment');

  const listRes = await jsonRequest('/api/schedules');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.schedules.length, 2);
});

test('error path: rejects invalid or duplicate resources and invalid JSON', async () => {
  resetState();

  const missingName = await jsonRequest('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '   ' })
  });
  assert.equal(missingName.status, 400);
  assert.match(missingName.body.error, /required/i);

  const first = await jsonRequest('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Board Room' })
  });
  assert.equal(first.status, 201);

  const duplicate = await jsonRequest('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'board room' })
  });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body.error, /already exists/i);

  const invalidJsonResponse = await fetch(`${baseUrl}/api/equipment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad json'
  });
  assert.equal(invalidJsonResponse.status, 400);
  const invalidJsonBody = await invalidJsonResponse.json();
  assert.match(invalidJsonBody.error, /valid json/i);
});

test('edge and failure paths: overlap rejected, boundary no-overlap accepted, delete lifecycle works', async () => {
  resetState();

  const room = await jsonRequest('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'War Room' })
  });

  const firstSchedule = await jsonRequest('/api/schedules', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resourceType: 'room',
      resourceId: room.body.id,
      title: 'Sprint Planning',
      startTime: '2026-02-21T13:00:00.000Z',
      endTime: '2026-02-21T14:00:00.000Z'
    })
  });
  assert.equal(firstSchedule.status, 201);

  const overlap = await jsonRequest('/api/schedules', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resourceType: 'room',
      resourceId: room.body.id,
      title: 'Overlapping Meeting',
      startTime: '2026-02-21T13:30:00.000Z',
      endTime: '2026-02-21T14:30:00.000Z'
    })
  });
  assert.equal(overlap.status, 400);
  assert.match(overlap.body.error, /overlaps/i);

  const boundary = await jsonRequest('/api/schedules', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resourceType: 'room',
      resourceId: room.body.id,
      title: 'Exactly After',
      startTime: '2026-02-21T14:00:00.000Z',
      endTime: '2026-02-21T14:30:00.000Z'
    })
  });
  assert.equal(boundary.status, 201);

  const deleteFirst = await jsonRequest(`/api/schedules/${firstSchedule.body.id}`, {
    method: 'DELETE'
  });
  assert.equal(deleteFirst.status, 204);

  const deleteMissing = await jsonRequest(`/api/schedules/${firstSchedule.body.id}`, {
    method: 'DELETE'
  });
  assert.equal(deleteMissing.status, 404);

  const invalidId = await jsonRequest('/api/schedules/not-a-number', {
    method: 'DELETE'
  });
  assert.equal(invalidId.status, 400);
});
