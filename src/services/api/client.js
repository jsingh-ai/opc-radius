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

export async function apiPost(path) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message || "The server returned an error while updating data.";
    throw new Error(message);
  }

  return payload;
}
