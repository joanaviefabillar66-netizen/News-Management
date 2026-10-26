const BASE = "/api/news";

async function request(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

export const getNews = (search = "") =>
  request(`${BASE}?search=${encodeURIComponent(search)}`);
export const addNews = (article) =>
  request(BASE, { method: "POST", body: JSON.stringify(article) });
export const updateNews = (id, article) =>
  request(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(article) });
export const deleteNews = (id) => request(`${BASE}/${id}`, { method: "DELETE" });
