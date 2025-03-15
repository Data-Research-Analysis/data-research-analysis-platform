export function validateEmail(email: string) {
  return /[A-Za-z0-9\._%+\-]+@[A-Za-z0-9\.\-]+\.[A-Za-z]{2,}/.test(email);
}
export function validatePassword(password: string) {
  return /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/.test(password);
}
export function validateRequired(value: string) {
  return value.length > 0;
}
export function validateSamePassword(password: string, secondPassword: string) {
  return password === secondPassword;
}
export function validate(
  value: string,
  secondValue: string,
  validators: ((value: string, secondValue: string) => boolean)[],
) {
  return validators.every((validator) => validator(value, secondValue));
}
