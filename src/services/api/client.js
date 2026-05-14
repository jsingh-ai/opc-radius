export async function apiGet(path) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message || "The server returned an error while fetching data.";
    throw new Error(message);
  }

  return payload;
}
