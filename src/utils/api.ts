const API = "http://127.0.0.1:8000";

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("spotify_token");
  
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const newOptions = { ...options, headers };
  
  let response = await fetch(url, newOptions);

  if (response.status === 401) {
    const refreshToken = localStorage.getItem("spotify_refresh");
    if (!refreshToken) {
      localStorage.removeItem("spotify_token");
      window.location.href = "/";
      return response;
    }

    try {
      const refreshRes = await fetch(`${API}/refresh?refresh_token=${refreshToken}`);
      if (!refreshRes.ok) throw new Error("Refresh failed");
      
      const refreshData = await refreshRes.json();
      const newAccessToken = refreshData.access_token;
      
      if (!newAccessToken) throw new Error("No token returned");

      // Save new token
      localStorage.setItem("spotify_token", newAccessToken);

      // Retry original request
      headers.set("Authorization", `Bearer ${newAccessToken}`);
      newOptions.headers = headers;
      response = await fetch(url, newOptions);
    } catch (error) {
      // Refresh failed, clear tokens and redirect to login/home
      localStorage.removeItem("spotify_token");
      localStorage.removeItem("spotify_refresh");
      window.location.href = "/";
    }
  }

  return response;
}
