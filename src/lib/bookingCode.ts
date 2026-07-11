import { customAlphabet } from "nanoid";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
const generate = customAlphabet(alphabet, 6);

export function generateBookingCode(): string {
  return `CM-${generate()}`;
}
