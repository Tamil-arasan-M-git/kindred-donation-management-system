import api from "../../api/client";

export async function loadCurrentNgo(userEmail) {
  const ngos = await api.get("/api/ngos");
  const currentNgo = ngos.find((ngo) => ngo.contact_email === userEmail);
  if (!currentNgo) {
    throw new Error("Your organization profile is not available yet.");
  }
  return currentNgo;
}
