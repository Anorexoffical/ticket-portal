const API_URL = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { data: null, error: { message: body.message || 'Request failed' } };
  return { data: body.data ?? body, error: null, count: body.count };
}

async function uploadFile(path, file) {
  const form = new FormData();
  form.append('file', file);
  form.append('path', path);
  const response = await fetch(`${API_URL}/uploads`, { method: 'POST', credentials: 'include', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { error: { message: body.message || 'Upload failed' } };
  return { error: null, data: body };
}

async function deleteFile(path) {
  const response = await fetch(`${API_URL}/uploads`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { error: { message: body.message || 'Delete failed' } };
  return { error: null };
}

class Query {
  constructor(table, method = 'GET', payload = null) {
    this.table = table;
    this.method = method;
    this.payload = payload;
    this.filters = [];
    this._order = null;
    this._limit = null;
    this._select = '*';
  }
  select(columns = '*', options = {}) { this._select = columns; return options.count === 'exact' ? this : this; }
  insert(value) { return request(`/resources/${this.table}`, { method: 'POST', body: JSON.stringify(value) }); }
  update(value) { this.method = 'PATCH'; this.payload = value; return this; }
  delete() { this.method = 'DELETE'; return this; }
  eq(column, value) { this.filters.push([column, value]); return this; }
  neq(column, value) { this.filters.push([column, value, 'neq']); return this; }
  gt(column, value) { this.filters.push([column, value, 'gt']); return this; }
  gte(column, value) { this.filters.push([column, value, 'gte']); return this; }
  in(column, values) { this.filters.push([column, values, 'in']); return this; }
  order(column, options = {}) { this._order = column; return this; }
  limit(value) { this._limit = value; return this; }
  single() { return this.execute(true); }
  maybeSingle() { return this.execute(true); }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute(single = false) {
    const idFilter = this.filters.find(f => f[0] === 'id');
    let path = `/resources/${this.table}`;
    if ((this.method === 'PATCH' || this.method === 'DELETE') && idFilter) {
      path += `/${idFilter[1]}`;
    } else if (this.filters.length) {
      const params = new URLSearchParams();
      for (const [key, value, op] of this.filters) {
        if (op === 'in') params.set(`${key}__in`, Array.isArray(value) ? value.join(',') : value);
        else if (op) params.set(`${key}__${op}`, value);
        else params.set(key, value);
      }
      path += `?${params}`;
    }
    if (this.method === 'GET' || !this.method) return request(path);
    const options = { method: this.method, body: this.payload == null ? undefined : JSON.stringify(this.payload) };
    const result = await request(path, options);
    if (result.error) return result;
    if (single) result.data = Array.isArray(result.data) ? result.data[0] : result.data;
    return result;
  }
}

export const db = {
  from: table => new Query(table),
  rpc: async (name, args = {}) => request(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }),
  auth: {
    getSession: () => request('/auth/me').then(r => ({ data: { session: r.error ? null : { user: r.data } }, error: r.error })),
    getUser: () => request('/auth/me').then(r => ({ data: { user: r.error ? null : r.data }, error: r.error })),
    signInWithPassword: async ({ email, password }) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    signUp: async ({ email, password, options }) => request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, agencyName: options?.data?.agency_name, phone: options?.data?.phone, whatsapp: options?.data?.whatsapp }) }),
    signOut: () => request('/auth/logout', { method: 'POST' }),
    updateUser: async ({ password }) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ password }) }),
  },
  storage: {
    upload: (path, file) => uploadFile(path, file),
    remove: (paths) => Promise.all((Array.isArray(paths) ? paths : [paths]).map(deleteFile)).then(() => ({ error: null })),
    getUrl: (path) => `${API_URL}/uploads/file?path=${encodeURIComponent(path)}`,
  },
};

// keep old name working so we don't miss any import
export const supabase = db;
