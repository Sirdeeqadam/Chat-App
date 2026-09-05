export const isStrongPassword = (password) => {
  const value = String(password || "");

  return (
    value.length >= 6 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
};

export const passwordRequirementsMessage =
  "Password must be at least 6 characters and include a letter, a number, and a special character.";
