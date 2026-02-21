const state = {
  rooms: [],
  equipment: [],
  schedules: []
};

const roomForm = document.querySelector('#roomForm');
const roomName = document.querySelector('#roomName');
const roomList = document.querySelector('#roomList');

const equipmentForm = document.querySelector('#equipmentForm');
const equipmentName = document.querySelector('#equipmentName');
const equipmentList = document.querySelector('#equipmentList');

const scheduleForm = document.querySelector('#scheduleForm');
const scheduleType = document.querySelector('#scheduleType');
const resourceId = document.querySelector('#resourceId');
const scheduleTitle = document.querySelector('#scheduleTitle');
const startTime = document.querySelector('#startTime');
const endTime = document.querySelector('#endTime');
const scheduleList = document.querySelector('#scheduleList');

const message = document.querySelector('#message');

function notify(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#b42318' : '#4b5563';
}

async function sendJson(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

function renderResources() {
  roomList.innerHTML = state.rooms.map((room) => `<li>${room.name}</li>`).join('');
  equipmentList.innerHTML = state.equipment.map((item) => `<li>${item.name}</li>`).join('');
  renderResourceOptions();
}

function renderResourceOptions() {
  const resources = scheduleType.value === 'room' ? state.rooms : state.equipment;
  resourceId.innerHTML = resources
    .map((item) => `<option value="${item.id}">${item.name}</option>`)
    .join('');
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function renderSchedules() {
  if (state.schedules.length === 0) {
    scheduleList.innerHTML = '<li class="muted">No schedule entries yet.</li>';
    return;
  }

  scheduleList.innerHTML = state.schedules
    .map(
      (entry) =>
        `<li>
          <div class="row">
            <div>
              <strong>${entry.title}</strong> - ${entry.resourceName} (${entry.resourceType})<br />
              <span class="muted">${formatDate(entry.startTime)} to ${formatDate(entry.endTime)}</span>
            </div>
            <button class="danger" data-id="${entry.id}">Delete</button>
          </div>
        </li>`
    )
    .join('');
}

async function loadAll() {
  const [resourcePayload, schedulePayload] = await Promise.all([
    fetch('/api/resources').then((res) => res.json()),
    fetch('/api/schedules').then((res) => res.json())
  ]);

  state.rooms = resourcePayload.rooms;
  state.equipment = resourcePayload.equipment;
  state.schedules = schedulePayload.schedules;

  renderResources();
  renderSchedules();
}

roomForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await sendJson('/api/rooms', 'POST', { name: roomName.value });
    roomName.value = '';
    await loadAll();
    notify('Room added.');
  } catch (error) {
    notify(error.message, true);
  }
});

equipmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await sendJson('/api/equipment', 'POST', { name: equipmentName.value });
    equipmentName.value = '';
    await loadAll();
    notify('Equipment added.');
  } catch (error) {
    notify(error.message, true);
  }
});

scheduleType.addEventListener('change', renderResourceOptions);

scheduleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await sendJson('/api/schedules', 'POST', {
      resourceType: scheduleType.value,
      resourceId: Number(resourceId.value),
      title: scheduleTitle.value,
      startTime: startTime.value,
      endTime: endTime.value
    });
    scheduleTitle.value = '';
    await loadAll();
    notify('Schedule created.');
  } catch (error) {
    notify(error.message, true);
  }
});

scheduleList.addEventListener('click', async (event) => {
  const id = event.target.dataset.id;
  if (!id) {
    return;
  }

  try {
    const response = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Delete failed');
    }
    await loadAll();
    notify('Schedule removed.');
  } catch (error) {
    notify(error.message, true);
  }
});

loadAll().catch((error) => {
  notify(error.message, true);
});
